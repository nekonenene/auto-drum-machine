import { TICKS_PER_BEAT, soundByKey } from './pattern-model.js';

/**
 * 打撃は本来の速度を保ち、助走音は全体を拍長へ伸縮して次の頭に収める
 *
 * @param {object} event 保存された打撃
 * @param {number} bpm テンポ
 * @param {number} [sourceDuration] PCM全体の長さ（秒）
 * @returns {{duration: number, playbackRate: number}} 発音長と再生速度
 */
export function voiceTiming(event, bpm, sourceDuration = soundByKey.get(event.soundKey).duration) {
  const gateSeconds = event.gateTicks / TICKS_PER_BEAT * 60 / bpm;
  const swell = soundByKey.get(event.soundKey).tags.attack === 'swell';

  return swell ? { duration: gateSeconds, playbackRate: sourceDuration / gateSeconds }
    : { duration: Math.min(sourceDuration, gateSeconds), playbackRate: 1 };
}

/**
 * フレーズ列を連続した拍位置へ変換する
 *
 * @param {object[]} sequence 保存パターン列
 * @returns {{events: object[], lengthBeats: number}} 発音列と総拍数
 */
function sequenceTimeline(sequence) {
  const events = [];
  let lengthBeats = 0;

  // 各フレーズの開始拍を加算し、同時打ちを保って並べる
  for (const pattern of sequence) {
    const offset = lengthBeats;
    events.push(...pattern.events.map((event) => ({ ...event, beat: offset + event.tick / TICKS_PER_BEAT, patternId: pattern.id })));
    lengthBeats += pattern.meter * pattern.bars;
  }

  events.sort((first, second) => first.beat - second.beat);

  return { events, lengthBeats };
}

/**
 * 拍を基準に先読み予約し、停止とテンポ変更時に未来の予約を取り消す
 */
export class PatternTransport {
  /**
   * 音声実装と独立した予約機構を作る
   *
   * @param {{now: Function, schedule: Function, cancel: Function, tail: Function}} audio 音声操作
   * @returns {PatternTransport}
   */
  constructor(audio) {
    this.audio = audio;
    this.bpm = 110;
    this.playing = false;
    this.loop = false;
    this.nextIndex = 0;
    this.anchorBeat = 0;
    this.anchorTime = 0;
    this.sequence = [];
    this.events = [];
    this.onNext = null;
    this.pending = null;
  }

  /**
   * 再生位置を拍で返す
   *
   * @param {number} [time] 音声時刻
   * @returns {number}
   */
  beatAt(time = this.audio.now()) {

    return this.anchorBeat + (time - this.anchorTime) * this.bpm / 60;
  }

  /**
   * 単発またはループするフレーズ列を開始する
   *
   * @param {object[]} sequence 再生する保存パターン
   * @param {boolean} [loop=false] ループするか
   * @returns {void}
   */
  start(sequence, loop = false) {
    this.stop();
    this.sequence = sequence;
    this.loop = loop;
    this.anchorBeat = 0;
    this.anchorTime = this.audio.now() + .06;
    this.nextIndex = 0;
    Object.assign(this, sequenceTimeline(sequence));
    this.playing = true;
    this.pump();
  }

  /**
   * 現在のフレーズの直後に切り替える。選び直した場合は予約を置き換える
   *
   * @param {object[]} sequence 次に演奏する保存パターン列
   * @param {boolean} [loop=false] 切り替え後にループするか
   * @returns {void}
   */
  queue(sequence, loop = false) {
    this.onNext = null;
    this.pump();

    if (!this.playing) {
      this.start(sequence, loop);

      return;
    }

    const currentBeat = Math.max(0, this.beatAt());
    const cycle = this.loop ? Math.floor(currentBeat / this.lengthBeats) : 0;
    let boundaryBeat = cycle * this.lengthBeats;

    // 接続列全体ではなく、今鳴っているフレーズの末尾を探す
    for (const pattern of this.sequence) {
      boundaryBeat += pattern.meter * pattern.bars;

      if (boundaryBeat > currentBeat) {
        break;
      }
    }

    boundaryBeat = Math.max(currentBeat, boundaryBeat);
    const boundaryTime = this.anchorTime + (boundaryBeat - this.anchorBeat) * 60 / this.bpm;
    this.audio.cancel(boundaryTime, true);
    this.pending = { sequence, loop, boundaryBeat, nextIndex: 0, ...sequenceTimeline(sequence) };
    this.pump();
  }

  /**
   * 現在の拍を保ったままBPMを変更し、未来の打撃を再予約する
   *
   * @param {number} bpm 40〜240のテンポ
   * @returns {void}
   */
  setBpm(bpm) {
    this.pump();
    const time = this.audio.now();
    const currentBeat = this.playing ? this.beatAt(time) : 0;
    this.anchorBeat = currentBeat;
    this.anchorTime = time;
    this.bpm = Math.max(40, Math.min(240, bpm));

    if (this.playing) {
      this.audio.cancel(time, true);
      const cycle = Math.max(0, Math.floor(currentBeat / this.lengthBeats));
      const localBeat = currentBeat - cycle * this.lengthBeats;
      const index = this.events.findIndex((event) => event.beat > localBeat + 1e-7);
      this.nextIndex = cycle * this.events.length + (index < 0 ? this.events.length : index);

      if (this.pending) {
        this.pending.nextIndex = 0;
      }

      this.pump();
    }
  }

  /**
   * 120ms先まで予約し、単発では余韻が消えてから終了する
   *
   * @returns {void}
   */
  pump() {
    if (!this.playing) {

      return;
    }

    const now = this.audio.now();
    const pendingTime = this.pending
      ? this.anchorTime + (this.pending.boundaryBeat - this.anchorBeat) * 60 / this.bpm : null;

    if (this.pending && now >= pendingTime) {
      const { sequence, loop, events, lengthBeats, nextIndex } = this.pending;
      Object.assign(this, { sequence, loop, events, lengthBeats, nextIndex, anchorTime: pendingTime, anchorBeat: 0 });
      this.pending = null;
    }

    // 同時打ち・三連符・細かな連打をAudioContextの時刻で予約する
    while (this.loop || this.nextIndex < this.events.length) {
      const cycle = Math.floor(this.nextIndex / this.events.length);

      if (this.onNext && cycle >= 4) {
        const boundary = this.anchorTime + (4 * this.lengthBeats - this.anchorBeat) * 60 / this.bpm;

        if (boundary > now + .12) {
          break;
        }

        const next = this.onNext();
        this.sequence = [next];
        this.lengthBeats = next.meter * next.bars;
        this.events = next.events.map((event) => ({ ...event, beat: event.tick / TICKS_PER_BEAT, patternId: next.id }));
        this.nextIndex = 0;
        this.anchorTime = boundary;
        this.anchorBeat = 0;
        continue;
      }

      const event = this.events[this.nextIndex % this.events.length];
      const beat = event.beat + cycle * this.lengthBeats;
      const time = this.anchorTime + (beat - this.anchorBeat) * 60 / this.bpm;

      if (time > now + .12 || (this.pending && beat >= this.pending.boundaryBeat)) {
        break;
      }

      if (time >= now - .04) {
        this.audio.schedule(event, Math.max(now, time), this.bpm);
      }

      this.nextIndex++;
    }

    if (this.pending) {
      const pending = this.pending;

      // 切り替え先も先読みし、冒頭の休符と境界の同時打ちを正確に保つ
      while (pending.loop || pending.nextIndex < pending.events.length) {
        const cycle = Math.floor(pending.nextIndex / pending.events.length);
        const event = pending.events[pending.nextIndex % pending.events.length];
        const time = pendingTime + (event.beat + cycle * pending.lengthBeats) * 60 / this.bpm;

        if (time > now + .12) {
          break;
        }

        if (time >= now - .04) {
          this.audio.schedule(event, Math.max(now, time), this.bpm);
        }

        pending.nextIndex++;
      }

      return;
    }

    const endingBeat = this.beatAt(now);
    const finalTime = Math.max(this.anchorTime + (this.lengthBeats - this.anchorBeat) * 60 / this.bpm,
      ...this.events.map((event) => this.anchorTime + (event.beat - this.anchorBeat) * 60 / this.bpm + this.audio.tail(event, this.bpm)));

    if (!this.loop && endingBeat >= this.lengthBeats && now >= finalTime) {
      this.playing = false;
    }
  }

  /**
   * 未来の予約も現在の余韻も停止する
   *
   * @returns {void}
   */
  stop() {
    this.audio.cancel(this.audio.now(), false);
    this.playing = false;
    this.pending = null;
  }

  /**
   * 再生中のフレーズと、その中の拍位置を返す
   *
   * @returns {{pattern: object, beat: number, cycle: number} | null}
   */
  position() {
    if (!this.sequence.length) {

      return null;
    }

    const absoluteBeat = Math.max(0, this.beatAt());
    const cycle = Math.floor(absoluteBeat / this.lengthBeats);
    let beat = this.loop ? absoluteBeat % this.lengthBeats : Math.min(absoluteBeat, this.lengthBeats - 1e-6);

    // 接続試聴でも、今鳴っているフレーズの位置を表示する
    for (const pattern of this.sequence) {
      const length = pattern.meter * pattern.bars;

      if (beat < length) {

        return { pattern, beat, cycle };
      }

      beat -= length;
    }

    return null;
  }
}

/**
 * 出だし→基本、基本→展開フィル→基本の接続列を作る
 *
 * @param {object} selected 選択したパターン
 * @param {object[]} library 保存ライブラリ
 * @param {boolean} connected 接続試聴するか
 * @returns {object[]}
 */
export function auditionSequence(selected, library, connected) {
  if (!connected || selected.purpose === 'basic') {

    return [selected];
  }

  const base = library.find((pattern) => pattern.id === selected.derivedFrom);

  return selected.purpose === 'intro' ? [selected, base] : [base, selected, base];
}
