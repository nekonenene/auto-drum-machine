import { patterns } from './patterns-data.js';
import { sounds } from './sounds.js';
import { soundTagLabels } from './sound-tags.js';
import { renderSound } from './synth.js';
import { loadSampleSources } from './samples.js';
import { TICKS_PER_BEAT, CLASSIFICATION_VERSION, purposes, centers, grooves, tagLabels, scoreCriteria,
  soundByKey, finalizePattern, rhythmFingerprint, rhythmSimilarity, trivialVariant, createVariation, validatePatterns } from './pattern-model.js';
import { PatternTransport, auditionSequence, voiceTiming } from './pattern-player.js';
import { AutomaticPerformance } from './pattern-performance.js';

/**
 * この画面の要素を取得する
 *
 * @param {string} selector CSSセレクター
 * @returns {Element}
 */
const query = (selector) => document.querySelector(selector);

/**
 * 保存データの文字列をHTML表示用にエスケープする
 *
 * @param {unknown} value 表示する値
 * @returns {string}
 */
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

const libraryById = new Map(patterns.map((pattern) => [pattern.id, pattern]));
const buffersByKey = new Map();
const activeVoices = new Set();
let sampleSources = new Map();
let selectedPattern = patterns[0];
let lastAuditionPattern;
let purposeFilter = 'all';
let context;
let masterGain;
let transport;
let playbackToken = 0;
let pumpInterval;
let animationFrame;
let autoMode = false;
let performance = null;
let ready = false;
let toastTimer;
let generationSerial = readGenerationSerial();
const generated = readGenerated();

/**
 * 保存領域が使えない場合も、生成番号を安全に用意する
 *
 * @returns {number}
 */
function readGenerationSerial() {
  try {
    const serial = Number(localStorage.getItem('auto-drum-generation-serial') || 0);

    return Number.isSafeInteger(serial) && serial >= 0 ? serial : 0;
  } catch {

    return 0;
  }
}

/**
 * 保存済みの生成案を読み、古い分類も現行の共通基準で再評価する
 *
 * @returns {object[]}
 */
function readGenerated() {
  try {
    const data = JSON.parse(localStorage.getItem('auto-drum-generated-v1') || '[]');
    const restored = data.filter((pattern) => pattern.id?.startsWith('auto-') && libraryById.has(pattern.derivedFrom))
      .slice(-200).map((pattern) => finalizePattern(pattern));
    validatePatterns([...patterns, ...restored]);

    return restored;
  } catch {

    return [];
  }
}

/**
 * 再生内容をブラウザに保存し、失敗した場合は画面に知らせる
 *
 * @returns {void}
 */
function saveGenerated() {
  try {
    localStorage.setItem('auto-drum-generated-v1', JSON.stringify(generated));
    localStorage.setItem('auto-drum-generation-serial', String(generationSerial));
    query('#storage-status').textContent = '直近200案をこのブラウザに保存。残したい案はJSONで書き出せます';
  } catch {
    query('#storage-status').textContent = 'ブラウザ保存ができません。この画面では保持しています。JSONで書き出してください';
  }
}

/**
 * 操作の結果やエラーを短く通知する
 *
 * @param {string} message メッセージ
 * @returns {void}
 */
function notify(message) {
  clearTimeout(toastTimer);
  query('#pattern-toast').textContent = message;
  query('#pattern-toast').hidden = false;
  toastTimer = setTimeout(() => { query('#pattern-toast').hidden = true; }, 4500);
}

/**
 * フィルターを組み合わせて保存ライブラリを絞り込む
 *
 * @returns {object[]}
 */
function visiblePatterns() {
  const searchTerms = query('#pattern-search').value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);

  return patterns.filter((pattern) => {
    const searchable = `${pattern.id} ${pattern.name} ${pattern.intent} ${grooves[pattern.groove]} ${pattern.tags.map((tag) => tagLabels[tag]).join(' ')} ${pattern.usedSoundKeys.map((key) => {
      const sound = soundByKey.get(key);

      return `${sound.name} ${soundTagLabels(sound).join(' ')}`;
    }).join(' ')}`.toLocaleLowerCase();

    return (purposeFilter === 'all' || pattern.purpose === purposeFilter)
      && ['intensity', 'metallic', 'center', 'groove'].every((field) => query(`#filter-${field}`).value === 'all' || String(pattern[field]) === query(`#filter-${field}`).value)
      && searchTerms.every((term) => searchable.includes(term));
  });
}

/**
 * 強弱と拍位置の小さな見取り図を作る
 *
 * @param {object} pattern 演奏データ
 * @returns {string}
 */
function miniRhythm(pattern) {
  const length = pattern.meter * pattern.bars * TICKS_PER_BEAT;

  return `<svg class="mini-rhythm" viewBox="0 0 260 24" aria-hidden="true"><path d="M0 21H260" stroke="#dfe4d3"/>${pattern.events.map((event) => `<line x1="${event.tick / length * 258 + 1}" x2="${event.tick / length * 258 + 1}" y1="${21 - event.velocity * 17}" y2="21" stroke="#82956c" stroke-width="2" opacity="${.25 + event.velocity * .65}"/>`).join('')}</svg>`;
}

/**
 * 選択状態と一致件数を含めてリストを描画する
 *
 * @returns {void}
 */
function renderList() {
  const visible = visiblePatterns();
  query('#pattern-count').textContent = `${visible.length} / ${patterns.length} phrases`;
  query('#empty-patterns').hidden = visible.length > 0;
  query('#filter-indicator').textContent = ['intensity', 'metallic', 'center', 'groove'].some((field) => query(`#filter-${field}`).value !== 'all') ? '●' : '';
  query('#pattern-list').innerHTML = visible.map((pattern) => `<button class="pattern-card" type="button" data-audition="${pattern.id}" aria-label="${escapeHtml(pattern.name)}を試聴" aria-pressed="${pattern.id === selectedPattern.id}" ${ready ? '' : 'disabled'}>
    <span class="card-meta"><span>${pattern.id}</span><span>${purposes[pattern.purpose]} · ${pattern.bars}小節</span></span><strong><span class="card-play" aria-hidden="true">▶</span>${escapeHtml(pattern.name)}</strong>${miniRhythm(pattern)}
    <span class="card-groove">${grooves[pattern.groove]} · ${centers[pattern.center]}</span><span class="card-scores"><span>激しさ <b>${pattern.intensity}</b></span><span>メタリック <b>${pattern.metallic}</b></span></span></button>`).join('');
  document.querySelectorAll('[data-purpose]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.purpose === purposeFilter)));
  updateSelection();
}

/**
 * 一覧を作り直さずに選択表示と固定プレイヤーを更新する
 *
 * @returns {void}
 */
function updateSelection() {
  document.querySelectorAll('.pattern-card').forEach((card) => card.setAttribute('aria-pressed', String(card.dataset.audition === selectedPattern.id)));
  query('#dock-pattern-name').textContent = selectedPattern.name;
  query('#dock-pattern-info').textContent = `${purposes[selectedPattern.purpose]} · ${selectedPattern.bars}小節 · 激しさ ${selectedPattern.intensity} / 金属 ${selectedPattern.metallic}`;
  const visible = visiblePatterns();
  const index = visible.findIndex((pattern) => pattern.id === selectedPattern.id);
  query('#previous-pattern').disabled = !ready || visible.length === 0 || index === 0;
  query('#next-pattern').disabled = !ready || visible.length === 0 || index === visible.length - 1;
  const meter = selectedPattern.meter;
  Array.from(query('#auto-intensity').options).forEach((option) => {
    option.disabled = option.value !== 'all' && !patterns.some((pattern) => pattern.purpose === 'basic'
      && pattern.meter === meter && pattern.intensity === Number(option.value));
  });

  if (query('#auto-intensity').selectedOptions[0].disabled) {
    query('#auto-intensity').value = 'all';
  }
}

/**
 * 絞り込み中の一覧で前後へ移動し、同じBPM・音量で試聴する
 *
 * @param {number} direction 移動方向（-1または1）
 * @returns {void}
 */
function auditionAdjacent(direction) {
  const visible = visiblePatterns();
  const index = visible.findIndex((pattern) => pattern.id === selectedPattern.id);
  const nextIndex = index < 0 ? (direction > 0 ? 0 : visible.length - 1) : index + direction;
  const next = visible[nextIndex];

  if (next && ready) {
    selectPattern(next);
    playPattern();
  }
}

/**
 * SVGで正確な発音位置・強弱・余韻・フィル範囲を描画する
 *
 * @param {object} pattern 演奏データ
 * @returns {void}
 */
function renderTimeline(pattern) {
  const keys = pattern.usedSoundKeys;
  const beats = pattern.meter * pattern.bars;
  const lengthTicks = beats * TICKS_PER_BEAT;
  const height = 36 + keys.length * 29;
  const left = 160;
  const width = 640;
  const bpm = Number(query('#pattern-bpm').value) || 120;
  let svg = `<svg viewBox="0 0 816 ${height}" role="img" aria-label="${escapeHtml(pattern.name)}の発音位置、強弱と余韻"><rect x="${left}" y="25" width="640" height="${height - 25}" fill="#f6f8ef"/>`;

  if (pattern.fillRange) {
    const start = pattern.fillRange.startTick / lengthTicks * width;
    svg += `<rect x="${left + start}" y="25" width="${(pattern.fillRange.endTick - pattern.fillRange.startTick) / lengthTicks * width}" height="${height - 25}" fill="#e5ebd5"/>`;
  }

  // 64分音符の位置まで保った点を、16分の補助線と拍の目盛りに重ねる
  for (let division = 0; division <= beats * 4; division++) {
    const x = left + division / (beats * 4) * width;
    const isBeat = division % 4 === 0;
    svg += `<line x1="${x}" x2="${x}" y1="25" y2="${height}" stroke="${isBeat ? '#cad4b9' : '#e8ecdf'}" stroke-width="${division % 16 === 0 ? 2 : 1}"/>`;

    if (isBeat && division < beats * 4) {
      svg += `<text x="${x + 4}" y="16" font-size="10">${Math.floor(division / 16) + 1}小節 / ${division / 4 % pattern.meter + 1}</text>`;
    }
  }

  keys.forEach((key, index) => {
    const y = 43 + index * 29;
    const sound = soundByKey.get(key);
    svg += `<text x="10" y="${y + 3}" font-size="9">${sound.id} ${escapeHtml(sound.name)}</text><line x1="${left}" x2="800" y1="${y + 12}" y2="${y + 12}" stroke="#e5e9dc"/>`;
    pattern.events.filter((event) => event.soundKey === key).forEach((event) => {
      const x = left + event.tick / lengthTicks * width;
      const gate = Math.min(event.gateTicks, sound.duration * bpm / 60 * TICKS_PER_BEAT);
      const tailWidth = Math.min(gate, lengthTicks - event.tick) / lengthTicks * width;
      svg += `<g><title>${escapeHtml(sound.name)} / ${(event.tick / TICKS_PER_BEAT + 1).toFixed(3)}拍 / 強さ${Math.round(event.velocity * 100)}%</title><line x1="${x}" x2="${x + tailWidth}" y1="${y}" y2="${y}" stroke="#7d9461" stroke-width="2" opacity=".25"/><circle cx="${x}" cy="${y}" r="${2 + event.velocity * 2.6}" fill="#728951" opacity="${.25 + event.velocity * .75}"/></g>`;
    });
  });
  svg += `<line id="playhead" x1="160" x2="160" y1="25" y2="${height}" stroke="#bc785c" stroke-width="2" visibility="hidden"/></svg>`;
  query('#timeline').innerHTML = svg;
  query('#fill-caption').textContent = pattern.fillRange
    ? `フィル範囲：${formatPosition(pattern.fillRange.startTick, pattern.meter)} → ${formatPosition(pattern.fillRange.endTick, pattern.meter)}。細かな点は32分・64分音符や三連符の位置もそのまま表示`
    : 'ループ用の基本パターン。16分の補助線に加え、細かな連打と三連符の正確な位置を表示';
}

/**
 * 0始まりの保存位置を、小節・拍・拍内の位置へ変換する
 *
 * @param {number} tick 保存位置
 * @param {number} meter 拍子数
 * @returns {string}
 */
function formatPosition(tick, meter) {
  const beat = tick / TICKS_PER_BEAT;

  return `${Math.floor(beat / meter) + 1}小節目 ${((beat % meter) + 1).toFixed(2)}拍`;
}

/**
 * 選択したフレーズの演奏・評価・派生関係を表示する
 *
 * @param {object} [pattern=selectedPattern] 表示するフレーズ
 * @returns {void}
 */
function renderDetail(pattern = selectedPattern) {
  query('#pattern-label').textContent = `4 / 4 · ${purposes[pattern.purpose]} · ${pattern.bars} BAR${pattern.bars === 2 ? 'S' : ''}`;
  query('#pattern-name').textContent = pattern.name;
  query('#pattern-id').textContent = `${pattern.id} · 保存済み演奏 · 分類 v${pattern.classificationVersion}`;
  query('#pattern-badges').innerHTML = [grooves[pattern.groove], ...pattern.tags.map((tag) => tagLabels[tag])].map((label) => `<span>${label}</span>`).join('');
  query('#pattern-intent').textContent = pattern.intent;
  query('#intensity-score').textContent = pattern.intensity;
  query('#metallic-score').textContent = pattern.metallic;
  query('#center-label').textContent = `音色の中心：${centers[pattern.center]}`;
  query('#pattern-metadata').innerHTML = `<div class="pattern-sound-list">${pattern.usedSoundKeys.map((key) => {
    const sound = soundByKey.get(key);

    return `<div class="pattern-sound"><b>${sound.id} ${escapeHtml(sound.name)}</b><span>${soundTagLabels(sound).map(escapeHtml).join(' / ')}</span></div>`;
  }).join('')}</div><p><b>スコアの理由</b><br>${escapeHtml(pattern.scoreReason)}</p><p><b>タグの理由</b><br>${escapeHtml(pattern.tagReason)}</p>`;
  const baseId = pattern.purpose === 'basic' ? pattern.derivedFrom || pattern.id : pattern.derivedFrom;
  const relatives = patterns.filter((other) => other.id === baseId || other.derivedFrom === baseId);
  query('#derived-links').innerHTML = relatives.filter((other) => other.id !== pattern.id).map((other) => `<button type="button" data-audition="${other.id}">${purposes[other.purpose]}を聴く</button>`).join('');
  const nearest = patterns.filter((other) => other.id !== pattern.id).map((other) => ({ pattern: other, similarity: rhythmSimilarity(pattern, other) }))
    .sort((first, second) => second.similarity - first.similarity).slice(0, 4);
  query('#similar-patterns').innerHTML = nearest.map(({ pattern: other, similarity }) => `<div class="similar-item"><span>${escapeHtml(other.name)}<br><small>${purposes[other.purpose]} · ${other.id}</small></span><b>${Math.round(similarity * 100)}%</b><button type="button" data-audition="${other.id}" aria-label="${escapeHtml(other.name)}と比較して試聴">聴く</button></div>`).join('');
  renderTimeline(pattern);
  updateSequenceLabel();
}

/**
 * 接続試聴の順序を明示する
 *
 * @returns {void}
 */
function updateSequenceLabel() {
  if (performance) {
    query('#sequence-label').textContent = '出だし → 基本6小節 → 展開フィル → 次の基本（激しさが下がるときは次の出だしを挟む）';

    return;
  }

  if (autoMode) {
    query('#sequence-label').textContent = `${selectedPattern.name} / 4回ごとに生成した次の案へ`;

    return;
  }

  const sequence = auditionSequence(selectedPattern, patterns, query('#connect-pattern').checked);
  query('#sequence-label').textContent = sequence.map((pattern) => pattern.name).join(' → ')
    + (query('#pattern-loop').checked ? ' / 繰り返し' : ' / 1回だけ、余韻を残して終了');
}

/**
 * 演奏を保ったままパターンを選択する
 *
 * @param {object} pattern 選択するパターン
 * @returns {void}
 */
function selectPattern(pattern) {
  selectedPattern = pattern;
  updateSelection();
  renderDetail();
}

/**
 * 音色の共通PCMを音声バッファとして保持する
 *
 * @param {number} key 音色キー
 * @returns {AudioBuffer}
 */
function audioBuffer(key) {
  if (!buffersByKey.has(key)) {
    const sound = soundByKey.get(key);
    const samples = renderSound(sound, 48000, sampleSources.get(sound.sample));
    const buffer = context.createBuffer(1, samples.length, 48000);
    buffer.copyToChannel(samples, 0);
    buffersByKey.set(key, buffer);
  }

  return buffersByKey.get(key);
}

/**
 * 音ごとの強弱と余韻を保って予約する（同時打ちを間引かない）
 *
 * @param {object} event 保存された打撃
 * @param {number} time 再生時刻
 * @param {number} bpm 予約時点のテンポ
 * @returns {void}
 */
function scheduleVoice(event, time, bpm) {
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = audioBuffer(event.soundKey);
  source.connect(gain).connect(masterGain);
  const { duration, playbackRate } = voiceTiming(event, bpm, source.buffer.duration);
  source.playbackRate.setValueAtTime(playbackRate, time);
  const fade = Math.min(.012, duration / 4);
  gain.gain.setValueAtTime(event.velocity, time);
  gain.gain.setValueAtTime(event.velocity, time + duration - fade);
  gain.gain.linearRampToValueAtTime(0, time + duration);
  const voice = { source, gain, time };
  activeVoices.add(voice);
  source.onended = () => {
    activeVoices.delete(voice);
    source.disconnect();
    gain.disconnect();
  };
  source.start(time);
  source.stop(time + duration + .001);
}

/**
 * BPM変更なら未来だけ、停止なら余韻も含めてキャンセルする
 *
 * @param {number} time 取消時刻
 * @param {boolean} futureOnly 未来の音だけを消すか
 * @returns {void}
 */
function cancelVoices(time, futureOnly) {

  // 予約済みの音と再生中の音を区別し、短いフェードでクリックを防ぐ
  for (const voice of activeVoices) {
    if (futureOnly && voice.time < time) {
      continue;
    }

    if (futureOnly) {
      voice.source.stop(time);
      continue;
    }

    voice.gain.gain.cancelScheduledValues(time);
    voice.gain.gain.setTargetAtTime(0, time, .003);
    voice.source.stop(time + .015);
  }
}

/**
 * ユーザー操作から音声を準備し、共通の音量と出力保護を使う
 *
 * @returns {Promise<void>}
 */
async function initializeAudio() {
  if (!context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error('このブラウザは音声再生に対応していません');
    }

    context = new AudioContextClass();
    masterGain = context.createGain();
    masterGain.gain.value = Number(query('#pattern-volume').value) / 100 * .6;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 10;
    limiter.ratio.value = 10;
    limiter.attack.value = .001;
    limiter.release.value = .08;
    masterGain.connect(limiter).connect(context.destination);
    transport = new PatternTransport({ now: () => context.currentTime, schedule: scheduleVoice, cancel: cancelVoices,
      tail: (event, bpm) => voiceTiming(event, bpm).duration });
  }

  await context.resume();

  if (context.state !== 'running') {
    throw new Error('音声を開始できませんでした。再生ボタンをもう一度押してください');
  }
}

/**
 * 停止し、表示を選択した保存パターンへ戻す
 *
 * @returns {void}
 */
function stopPlayback() {
  playbackToken++;
  clearInterval(pumpInterval);
  cancelAnimationFrame(animationFrame);
  transport?.stop();
  autoMode = false;
  performance = null;
  query('#auto-play').textContent = '▶ 自動演奏';
  query('#auto-play').setAttribute('aria-pressed', 'false');
  query('#pattern-loop').disabled = false;
  query('#connect-pattern').disabled = false;
  query('#play-state').textContent = '停止中';
  query('#now-playing').textContent = 'クリックで試聴・再生中は次に予約 · ダブルクリックで即再生 · ← → で前・次';
  query('#pattern-play').textContent = '▶ 試聴';
  document.querySelectorAll('.pattern-card').forEach((card) => card.classList.remove('is-playing', 'is-queued'));
  query('#auto-generate').textContent = '自動連続生成';
  query('#auto-generate').setAttribute('aria-pressed', 'false');
  updateSequenceLabel();
  const playhead = query('#playhead');
  playhead?.setAttribute('visibility', 'hidden');
}

/**
 * 再生位置を可視化し、自然終了時は予約を閉じる
 *
 * @returns {void}
 */
function animate() {
  if (!transport?.playing) {
    stopPlayback();

    return;
  }

  const position = transport.position();

  if (position) {
    if (performance && selectedPattern.id !== position.pattern.id) {
      selectPattern(position.pattern);
    }

    const x = 160 + position.beat / (position.pattern.bars * position.pattern.meter) * 640;
    const playhead = query('#playhead');
    playhead?.setAttribute('x1', String(x));
    playhead?.setAttribute('x2', String(x));
    playhead?.setAttribute('visibility', position.pattern.id === selectedPattern.id ? 'visible' : 'hidden');
    const phraseBar = Math.floor(position.beat / position.pattern.meter) + 1;
    const basicOffset = transport.sequence[0].purpose === 'intro' ? 1 : 0;
    const basicBar = (position.sequenceIndex - basicOffset) * 2 + phraseBar;
    query('#play-state').textContent = `${performance ? '自動 · ' : autoMode ? '生成中 · ' : ''}`
      + `${performance && position.pattern.purpose === 'basic' ? `${basicBar}/6` : phraseBar}小節 ${Math.floor(position.beat % position.pattern.meter) + 1}拍`;
    const pending = transport.pending?.sequence[0];
    query('#now-playing').textContent = `${purposes[position.pattern.purpose]}：${position.pattern.name}`
      + (pending ? ` → 次：${pending.name}` : '');
    document.querySelectorAll('.pattern-card').forEach((card) => {
      card.classList.toggle('is-playing', card.dataset.audition === position.pattern.id);
      card.classList.toggle('is-queued', card.dataset.audition === pending?.id);
    });
  }

  animationFrame = requestAnimationFrame(animate);
}

/**
 * 選択したパターンを次のフレーズに予約し、即再生なら割り込む
 *
 * @param {boolean} [immediate=false] 現在の演奏を止めてすぐ再生するか
 * @returns {Promise<void>}
 */
async function playPattern(immediate = false) {
  if (transport?.playing && !immediate) {
    transport.queue(auditionSequence(selectedPattern, patterns, query('#connect-pattern').checked), query('#pattern-loop').checked);
    autoMode = false;
    performance = null;
    query('#auto-play').textContent = '▶ 自動演奏';
    query('#auto-play').setAttribute('aria-pressed', 'false');
    query('#pattern-loop').disabled = false;
    query('#connect-pattern').disabled = false;
    query('#auto-generate').textContent = '自動連続生成';
    query('#auto-generate').setAttribute('aria-pressed', 'false');
    query('#pattern-play').textContent = '▶ 次に再生';
    updateSequenceLabel();

    return;
  }

  stopPlayback();
  const token = playbackToken;

  try {
    await initializeAudio();

    if (token !== playbackToken) {

      return;
    }

    transport.onNext = null;
    transport.setBpm(Number(query('#pattern-bpm').value));
    transport.start(auditionSequence(selectedPattern, patterns, query('#connect-pattern').checked), query('#pattern-loop').checked);
    query('#pattern-play').textContent = '▶ 次に再生';
    document.querySelectorAll('.pattern-card').forEach((card) => card.classList.toggle('is-playing', card.dataset.audition === selectedPattern.id));
    pumpInterval = setInterval(() => transport.pump(), 25);
    animate();
  } catch (error) {
    stopPlayback();
    notify(error.message);
  }
}

/**
 * 出だしから基本6小節とフィルをつなぎ、保存パターンを自動で巡る
 *
 * @returns {Promise<void>}
 */
async function startAutomaticPerformance() {
  if (performance) {
    stopPlayback();

    return;
  }

  const selected = selectedPattern;
  stopPlayback();
  const token = playbackToken;

  try {
    const arrangement = new AutomaticPerformance(patterns);
    const sequence = arrangement.start(selected);
    await initializeAudio();

    if (token !== playbackToken) {

      return;
    }

    performance = arrangement;
    query('#pattern-loop').disabled = true;
    query('#connect-pattern').disabled = true;
    query('#auto-play').textContent = '■ 自動演奏を停止';
    query('#auto-play').setAttribute('aria-pressed', 'true');
    transport.onNext = null;
    transport.setBpm(Number(query('#pattern-bpm').value));
    transport.start(sequence, false, () => arrangement.next(query('#auto-intensity').value));
    updateSequenceLabel();
    pumpInterval = setInterval(() => {
      try {
        transport.pump();
      } catch (error) {
        stopPlayback();
        notify(error.message);
      }
    }, 25);
    animate();
  } catch (error) {
    stopPlayback();
    notify(error.message);
  }
}

/**
 * 新しい案を重複判定し、保存して選択する
 *
 * @param {object} base 元の基本パターン
 * @returns {object}
 */
function generateNext(base) {
  let next;
  const comparison = [...patterns, ...generated];

  // 同じリズム、音色差分、微小な強弱差分だけの案を採用しない
  for (let attempt = 0; attempt < 300; attempt++) {
    next = createVariation(base, ++generationSerial);

    if (!comparison.some((pattern) => rhythmFingerprint(pattern) === rhythmFingerprint(next) || trivialVariant(pattern, next))) {
      break;
    }

    next = null;
  }

  if (!next) {
    throw new Error('この骨格の新しい案が見つかりません。別の基本パターンを選んでください');
  }

  generated.push(next);

  if (generated.length > 200) {
    generated.shift();
  }

  saveGenerated();
  selectedPattern = next;
  renderDetail();
  updateSelection();
  renderGenerated();

  return next;
}

/**
 * 4回ごとに次の案を作り、演奏の境界で継ぎ目なく移る
 *
 * @returns {Promise<void>}
 */
async function startAutoGeneration() {
  if (autoMode) {
    stopPlayback();

    return;
  }

  const base = libraryById.get(selectedPattern.derivedFrom || selectedPattern.id);
  stopPlayback();
  const token = playbackToken;

  try {
    await initializeAudio();

    if (token !== playbackToken) {

      return;
    }

    const first = generateNext(base);
    autoMode = true;
    updateSequenceLabel();
    query('#pattern-loop').disabled = true;
    query('#connect-pattern').disabled = true;
    query('#auto-generate').textContent = '生成を停止';
    query('#auto-generate').setAttribute('aria-pressed', 'true');
    transport.setBpm(Number(query('#pattern-bpm').value));
    transport.onNext = () => generateNext(base);
    transport.start([first], true);
    pumpInterval = setInterval(() => {
      try {
        transport.pump();
      } catch (error) {
        stopPlayback();
        notify(error.message);
      }
    }, 25);
    animate();
  } catch (error) {
    stopPlayback();
    notify(error.message);
  }
}

/**
 * 生成案の保存件数と再試聴ボタンを表示する
 *
 * @returns {void}
 */
function renderGenerated() {
  query('#generated-summary').textContent = `生成した案 ${generated.length}件（保存${patterns.length}種類とは別）`;
  query('#generated-list').innerHTML = [...generated].reverse().map((pattern) => `<div class="similar-item"><span>${escapeHtml(pattern.name)}<br><small>${escapeHtml(pattern.id)}</small></span><button type="button" data-audition="${escapeHtml(pattern.id)}" aria-label="${escapeHtml(pattern.name)}を再試聴">再試聴</button></div>`).join('');
}

/**
 * 共通基準と25通りのスコア分布を表示する
 *
 * @returns {void}
 */
function renderCriteria() {
  let table = '<table class="criteria-table"><thead><tr><th>段階</th><th>激しさ</th><th>メタリックさ</th></tr></thead><tbody>';
  scoreCriteria.intensity.forEach((criterion, index) => { table += `<tr><th>${index + 1}</th><td>${criterion}</td><td>${scoreCriteria.metallic[index]}</td></tr>`; });
  table += '</tbody></table>';
  let matrix = '<div class="score-matrix"><span>激 / 金</span>' + [1, 2, 3, 4, 5].map((number) => `<span>${number}</span>`).join('');

  // 激しさと金属感の25組を表示し、数の偏りと不足を見えるようにする
  for (let intensity = 1; intensity <= 5; intensity++) {
    matrix += `<span>${intensity}</span>`;

    // 同じ激しさの行に、金属感1〜5の保存件数を並べる
    for (let metallic = 1; metallic <= 5; metallic++) {
      const count = patterns.filter((pattern) => pattern.intensity === intensity && pattern.metallic === metallic).length;
      matrix += `<button type="button" data-score="${intensity},${metallic}" aria-label="激しさ${intensity}・メタリックさ${metallic}の${count}種類" ${count ? '' : 'disabled'}>${count}</button>`;
    }

  }

  query('#criteria').innerHTML = table + '<p class="fine-print">激しさは1拍あたりの密度・短い連打・相対アクセント・同時打ちで評価。全体の音量は正規化して除外します。金属感は音色の金属度・相対強度・各拍の存在感・120BPMでの余韻から独立して評価します。電子音を一律に金属と判定しません。</p>'
    + '<p class="fine-print">激しさの指標：密度/8を上限1として58%、連打率18%、アクセント率10%、重なり/3を上限1として14%で合成。閾値0.21 / 0.36 / 0.52 / 0.68で1〜5に分けます。金属感の指標：相対強度での金属割合55%、各拍の金属の存在感30%、金属の余韻15%で合成。閾値0.10 / 0.27 / 0.47 / 0.67で1〜5に分けます。</p>'
    + matrix + '</div><p class="fine-print">マスを押すと、その組み合わせを絞り込めます。ノリの選択肢：ストレート／スウィング／シャッフル／三連基調。部分的な三連符は別タグで区別します。基準変更時は全件を同じ版で再評価します。</p>';
}

/**
 * 演奏と評価理由を含むJSONを書き出す
 *
 * @param {unknown} data 書き出すデータ
 * @param {string} filename ファイル名
 * @returns {void}
 */
function exportData(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ classificationVersion: CLASSIFICATION_VERSION, ticksPerBeat: TICKS_PER_BEAT,
    defaultBpm: 120, defaultVolume: 80, data }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('演奏データを書き出しました');
}

/**
 * 同梱実音を読み、失敗時は再取得できるようにする
 *
 * @returns {Promise<void>}
 */
async function loadLibrary() {
  ready = false;
  query('#pattern-play').disabled = true;
  query('#auto-play').disabled = true;
  query('#auto-generate').disabled = true;
  query('#audio-status').hidden = false;
  query('#audio-status').textContent = '実音素材を読み込んでいます…';
  renderList();

  try {
    sampleSources = await loadSampleSources(sounds);
    ready = true;
    query('#audio-status').textContent = '';
    query('#audio-status').hidden = true;
    query('#pattern-play').disabled = false;
    query('#auto-play').disabled = false;
    query('#auto-generate').disabled = false;
    renderList();
  } catch (error) {
    query('#audio-status').textContent = error.message;
    const retry = document.createElement('button');
    retry.textContent = '素材を再読み込み';
    retry.addEventListener('click', loadLibrary);
    query('#audio-status').append(retry);
  }
}

document.addEventListener('click', (event) => {
  const selection = event.target.closest('[data-audition]');

  if (selection) {
    const id = selection.dataset.audition;
    // 詳細の比較ボタンが描き直されても、ダブルクリックは最初に押したパターンを再生する
    const pattern = event.detail >= 2 && lastAuditionPattern ? lastAuditionPattern
      : libraryById.get(id) || generated.find((item) => item.id === id);
    lastAuditionPattern = pattern;
    selectPattern(pattern);

    if (ready) {
      playPattern(event.detail >= 2);
    }
  }

  const purpose = event.target.closest('[data-purpose]');

  if (purpose) {
    purposeFilter = purpose.dataset.purpose;
    renderList();
  }

  const score = event.target.closest('[data-score]');

  if (score) {
    const [intensity, metallic] = score.dataset.score.split(',');
    purposeFilter = 'all';
    query('#pattern-search').value = '';
    ['center', 'groove'].forEach((field) => { query(`#filter-${field}`).value = 'all'; });
    query('#filter-intensity').value = intensity;
    query('#filter-metallic').value = metallic;
    query('.filter-details').open = true;
    renderList();
    query('#pattern-details').close();
  }
});

query('#pattern-play').addEventListener('click', (event) => playPattern(event.detail >= 2));
query('#pattern-stop').addEventListener('click', stopPlayback);
query('#detail-stop').addEventListener('click', stopPlayback);
query('#previous-pattern').addEventListener('click', () => auditionAdjacent(-1));
query('#next-pattern').addEventListener('click', () => auditionAdjacent(1));
query('#open-details').addEventListener('click', () => query('#pattern-details').showModal());
query('#close-details').addEventListener('click', () => query('#pattern-details').close());
query('#auto-generate').addEventListener('click', startAutoGeneration);
query('#auto-play').addEventListener('click', startAutomaticPerformance);
query('#pattern-search').addEventListener('input', renderList);
['intensity', 'metallic', 'center', 'groove'].forEach((field) => query(`#filter-${field}`).addEventListener('change', renderList));
query('#reset-filters').addEventListener('click', () => {
  purposeFilter = 'all';
  query('#pattern-search').value = '';
  ['intensity', 'metallic', 'center', 'groove'].forEach((field) => { query(`#filter-${field}`).value = 'all'; });
  renderList();
});
query('#pattern-bpm').addEventListener('change', () => {
  const bpm = Math.max(40, Math.min(240, Math.round(Number(query('#pattern-bpm').value) || 120)));
  query('#pattern-bpm').value = bpm;
  transport?.setBpm(bpm);
  renderTimeline(selectedPattern);
});
query('#pattern-volume').addEventListener('input', () => {
  const volume = Number(query('#pattern-volume').value);
  query('#pattern-volume-value').textContent = `${volume}%`;
  masterGain?.gain.setTargetAtTime(volume / 100 * .6, context.currentTime, .015);
});
query('#reset-mix').addEventListener('click', () => {
  query('#pattern-bpm').value = 120;
  query('#pattern-volume').value = 80;
  query('#pattern-volume-value').textContent = '80%';
  transport?.setBpm(120);
  masterGain?.gain.setTargetAtTime(.48, context.currentTime, .015);
  renderTimeline(selectedPattern);
});
query('#pattern-loop').addEventListener('change', () => {
  if (transport?.playing) {
    playPattern(true);
  }

  updateSequenceLabel();
});
query('#connect-pattern').addEventListener('change', () => {
  if (transport?.playing) {
    playPattern(true);
  }

  updateSequenceLabel();
});
query('#export-pattern').addEventListener('click', () => exportData(selectedPattern, `${selectedPattern.id}.json`));
query('#export-library').addEventListener('click', () => exportData(patterns, `auto-drum-${patterns.length}-patterns.json`));
query('#export-generated').addEventListener('click', () => exportData(generated, 'auto-drum-generated-patterns.json'));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    stopPlayback();
  }

  if (!event.target.closest('input, select, textarea, [contenteditable="true"]') && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
    auditionAdjacent(event.key === 'ArrowRight' ? 1 : -1);
  }
});
window.addEventListener('pagehide', stopPlayback);
['center', 'groove'].forEach((field) => {
  const choices = field === 'center' ? centers : grooves;
  Object.entries(choices).forEach(([value, label]) => { query(`#filter-${field}`).add(new Option(label, value)); });
});
validatePatterns(patterns);
renderList();
renderDetail();
renderGenerated();
renderCriteria();
loadLibrary();
