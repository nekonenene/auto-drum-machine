export const effectDefaults = {
  compressor: { enabled: true, threshold: -20, ratio: 6.5, makeup: 7 },
  filter: { enabled: true, type: 'lowpass', frequency: 14000, resonance: 70, motion: 'off', beats: 16, depth: 2 },
  chorus: { enabled: true, mix: .3, rate: .8, depth: .004 },
  reverb: { enabled: true, mix: .05, room: 'room' },
};

/**
 * フィルターの動きを可聴域内の対数的な周波数範囲に収める
 *
 * @param {object} filter フィルター設定
 * @param {number} sampleRate 音声のサンプルレート
 * @returns {{center: number, cents: number}} 中心周波数と変化幅
 */
export function filterRange(filter, sampleRate) {
  const maximum = Math.min(18000, sampleRate * .45);
  const low = Math.max(40, Math.min(maximum, filter.frequency / 2 ** filter.depth));
  const high = Math.max(low, Math.min(maximum, filter.frequency * 2 ** filter.depth));

  return { center: Math.sqrt(low * high), cents: 600 * Math.log2(high / low) };
}

/**
 * 共鳴の操作量をQへ変換し、ローパス／ハイパスのdB単位に合わせる
 *
 * @param {string} type フィルターの種類
 * @param {number} resonance 0〜100の共鳴の強さ
 * @returns {number} BiquadFilterNodeへ渡すQパラメーター
 */
export function filterResonanceQ(type, resonance) {
  const amount = Math.max(0, Math.min(100, resonance)) / 100;
  const quality = Math.SQRT1_2 * (20 / Math.SQRT1_2) ** amount;

  return type === 'lowpass' || type === 'highpass' ? 20 * Math.log10(quality) : quality;
}

/**
 * 同じ設定で再現できる、短い初期反射と減衰するステレオ残響を作る
 *
 * @param {BaseAudioContext} context 音声コンテキスト
 * @param {string} room 空間の種類
 * @returns {AudioBuffer} インパルス応答
 */
export function createReverbImpulse(context, room) {
  const duration = { small: .45, room: 1.2, hall: 2.8 }[room];
  const buffer = context.createBuffer(2, Math.ceil(context.sampleRate * duration), context.sampleRate);
  let seed = 21733;

  // 左右で異なる反射を作り、尾を無音へ滑らかに減衰させる
  for (let channel = 0; channel < 2; channel++) {
    const samples = buffer.getChannelData(channel);
    let damped = 0;

    // 高域を抑えたノイズへ初期反射を足し、打撃の後に空間を広げる
    for (let index = 0; index < samples.length; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      damped = damped * .55 + (seed / 4294967296 * 2 - 1) * .45;
      const time = index / context.sampleRate;
      const fadeIn = Math.min(1, Math.max(0, (time - .009) / .015));
      samples[index] = damped * fadeIn * Math.exp(-7 * time / duration) * (1 - index / samples.length);
    }

    [.013, .029, .047, .071].forEach((time, index) => {
      samples[Math.floor((time + channel * .003) * context.sampleRate)] += .6 / (index + 1);
    });
  }

  return buffer;
}

/**
 * 演奏全体へ掛ける音声経路と、BPMに同期するフィルターを管理する
 */
export class EffectRack {
  /**
   * 音源が接続する入口を固定し、設定と空間のバッファを保持する
   *
   * @param {AudioContext} context 音声コンテキスト
   * @param {AudioNode} destination 音量調整へ続く接続先
   * @returns {EffectRack}
   */
  constructor(context, destination) {
    this.context = context;
    this.destination = destination;
    this.input = context.createGain();
    this.settings = structuredClone(effectDefaults);
    this.bypassed = false;
    this.bpm = 120;
    this.graph = null;
    this.impulses = new Map();
  }

  /**
   * 再生ごとに新しい経路を作り、前回の残響が混ざることを防ぐ
   *
   * @param {number} time 最初の拍の音声時刻
   * @param {number} bpm テンポ
   * @returns {void}
   */
  start(time, bpm) {
    this.stop();
    this.bpm = bpm;
    const context = this.context;
    const nodes = [];

    /**
     * 作成したノードを停止時の後片付けに登録する
     *
     * @param {string} method 音声ノードの作成メソッド
     * @returns {AudioNode} 作成したノード
     */
    const make = (method) => {
      const node = context[method]();
      nodes.push(node);

      return node;
    };
    const graph = { nodes, oscillators: [] };
    graph.dry = make('createGain');
    graph.wet = make('createGain');
    graph.output = make('createGain');
    this.input.connect(graph.dry).connect(graph.output);
    graph.wet.connect(graph.output).connect(this.destination);

    graph.filter = make('createBiquadFilter');
    graph.filterDry = make('createGain');
    graph.filterWet = make('createGain');
    const filtered = make('createGain');
    this.input.connect(graph.filterDry).connect(filtered);
    this.input.connect(graph.filter).connect(graph.filterWet).connect(filtered);
    graph.inputNodes = [graph.dry, graph.filterDry, graph.filter];
    graph.filterLfo = make('createOscillator');
    graph.filterDepth = make('createGain');
    graph.filterLfo.connect(graph.filterDepth).connect(graph.filter.detune);
    graph.oscillators.push(graph.filterLfo);

    graph.compressor = make('createDynamicsCompressor');
    graph.compressor.knee.value = 12;
    graph.compressor.attack.value = .008;
    graph.compressor.release.value = .12;
    graph.compressorDry = make('createGain');
    graph.compressorWet = make('createGain');
    const compressed = make('createGain');
    filtered.connect(graph.compressorDry).connect(compressed);
    filtered.connect(graph.compressor).connect(graph.compressorWet).connect(compressed);

    graph.chorusDry = make('createGain');
    graph.chorusWet = make('createGain');
    const chorused = make('createGain');
    const merger = context.createChannelMerger(2);
    nodes.push(merger);
    compressed.connect(graph.chorusDry).connect(chorused);
    merger.connect(graph.chorusWet).connect(chorused);
    graph.chorusLfos = [];
    graph.chorusDepths = [];

    // 左右の短いディレイを異なる速度で揺らし、ステレオに広げる
    for (let channel = 0; channel < 2; channel++) {
      const delay = make('createDelay');
      delay.delayTime.value = .018 + channel * .006;
      compressed.connect(delay);
      delay.connect(merger, 0, channel);
      const oscillator = make('createOscillator');
      const depth = make('createGain');
      oscillator.connect(depth).connect(delay.delayTime);
      graph.chorusLfos.push(oscillator);
      graph.chorusDepths.push(depth);
      graph.oscillators.push(oscillator);
    }

    graph.reverb = make('createConvolver');
    graph.reverbSend = make('createGain');
    graph.reverbDry = make('createGain');
    graph.reverbWet = make('createGain');
    chorused.connect(graph.reverbDry).connect(graph.wet);
    chorused.connect(graph.reverbSend).connect(graph.reverb).connect(graph.reverbWet).connect(graph.wet);
    this.graph = graph;
    this.apply(true);
    graph.oscillators.forEach((oscillator) => oscillator.start(time));
  }

  /**
   * 音を短くフェードし、残響と変調用の発振器も停止する
   *
   * @returns {void}
   */
  stop() {
    if (!this.graph) {

      return;
    }

    const graph = this.graph;
    const time = this.context.currentTime;
    graph.output.gain.cancelAndHoldAtTime(time);
    graph.output.gain.linearRampToValueAtTime(0, time + .015);
    graph.oscillators.forEach((oscillator) => oscillator.stop(time + .02));
    setTimeout(() => {
      graph.inputNodes.forEach((node) => this.input.disconnect(node));
      graph.nodes.forEach((node) => node.disconnect());
    }, 30);
    this.graph = null;
  }

  /**
   * 位相を保ってテンポを変更する
   *
   * @param {number} bpm テンポ
   * @returns {void}
   */
  setBpm(bpm) {
    this.bpm = bpm;
    this.apply();
  }

  /**
   * スライダーとオン／オフの設定をクリック音が出ないように反映する
   *
   * @param {boolean} [immediate=false] 初期化として即時設定するか
   * @returns {void}
   */
  apply(immediate = false) {
    const graph = this.graph;

    if (!graph) {

      return;
    }

    const time = this.context.currentTime;

    /**
     * 操作途中の値から短く滑らかにパラメーターを動かす
     *
     * @param {AudioParam} parameter 変更する音声パラメーター
     * @param {number} value 次の値
     * @returns {void}
     */
    const set = (parameter, value) => {
      parameter.cancelAndHoldAtTime(time);

      if (immediate) {
        parameter.setValueAtTime(value, time);
      } else {
        parameter.setTargetAtTime(value, time, .015);
      }
    };
    const { filter, compressor, chorus, reverb } = this.settings;
    set(graph.dry.gain, this.bypassed ? 1 : 0);
    set(graph.wet.gain, this.bypassed ? 0 : 1);
    const range = filterRange(filter, this.context.sampleRate);
    graph.filter.type = filter.type;
    set(graph.filter.frequency, filter.motion === 'off' ? filter.frequency : range.center);
    set(graph.filter.Q, filterResonanceQ(filter.type, filter.resonance));
    set(graph.filterDry.gain, filter.enabled ? 0 : 1);
    set(graph.filterWet.gain, filter.enabled ? 1 : 0);
    graph.filterLfo.type = filter.motion === 'off' ? 'sine' : filter.motion;
    graph.filterLfo.frequency.setValueAtTime(this.bpm / 60 / filter.beats, time);
    set(graph.filterDepth.gain, filter.enabled && filter.motion !== 'off' ? range.cents : 0);
    set(graph.compressor.threshold, compressor.threshold);
    set(graph.compressor.ratio, compressor.ratio);
    set(graph.compressorDry.gain, compressor.enabled ? 0 : 1);
    set(graph.compressorWet.gain, compressor.enabled ? 10 ** (compressor.makeup / 20) : 0);
    const chorusMix = chorus.enabled ? chorus.mix : 0;
    set(graph.chorusDry.gain, 1 - chorusMix * .5);
    set(graph.chorusWet.gain, chorusMix * .7);
    graph.chorusLfos.forEach((oscillator, index) => set(oscillator.frequency, chorus.rate * (index ? 1.07 : 1)));
    graph.chorusDepths.forEach((depth) => set(depth.gain, chorus.depth));
    const reverbMix = reverb.enabled ? reverb.mix : 0;
    set(graph.reverbDry.gain, 1 - reverbMix * .4);
    set(graph.reverbWet.gain, reverbMix);
    set(graph.reverbSend.gain, reverb.enabled && !this.bypassed ? 1 : 0);

    if (graph.room !== reverb.room) {
      if (!this.impulses.has(reverb.room)) {
        this.impulses.set(reverb.room, createReverbImpulse(this.context, reverb.room));
      }

      graph.reverb.buffer = this.impulses.get(reverb.room);
      graph.room = reverb.room;
    }
  }

  /**
   * 単発再生を自然終了させるため、追加の余韻の長さを返す
   *
   * @returns {number} 秒数
   */
  tailSeconds() {
    const { chorus, reverb } = this.settings;

    return this.bypassed ? 0 : (chorus.enabled ? .04 : 0)
      + (reverb.enabled && reverb.mix > 0 ? { small: .45, room: 1.2, hall: 2.8 }[reverb.room] : 0);
  }
}
