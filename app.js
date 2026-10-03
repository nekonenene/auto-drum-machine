import { sounds, categories } from './sounds.js';
import { renderSound, waveformPeaks, encodeWav } from './synth.js';

/**
 * セレクターに一致する画面要素を取得する
 *
 * @param {string} selector CSSセレクター
 * @returns {Element | null}
 */
const queryElement = (selector) => document.querySelector(selector);

const SAMPLE_RATE = 48000;
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
};

/**
 * アイコンのSVGをHTML文字列として生成する
 *
 * @param {keyof typeof icons} name アイコン名
 * @param {string} [className=""] CSSクラス
 * @returns {string}
 */
const renderIconHtml = (name, className = '') => `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;

const categoryById = new Map(categories.map((category) => [category.id, category]));
const pcmSamplesBySoundId = new Map();
const audioBuffersBySoundId = new Map();
const activeVoices = new Set();
const highlightTimeoutIds = new Set();
const favoriteSoundIds = readFavorites();

let selectedSound = sounds[0];
let categoryFilter = 'all';
let audioContext;
let masterGain;
let playbackMode = null;
let schedulerIntervalId = null;
let nextPlaybackTime = 0;
let tourSoundIndex = 0;
let playbackGeneration = 0;
let toastTimeoutId;
let waveformAnimationFrameId;
let playbackStartTime = 0;

/**
 * 保存済みのお気に入り音色IDを読み込む
 *
 * @returns {Set<number>}
 */
function readFavorites() {
  try {
    const storedFavoriteIds = JSON.parse(localStorage.getItem('auto-drum-favorites') || '[]');

    return new Set(Array.isArray(storedFavoriteIds) ? storedFavoriteIds.filter((id) => sounds.some((sound) => sound.id === id)) : []);
  } catch {

    return new Set();
  }
}

/**
 * お気に入り音色IDをブラウザに保存する
 *
 * @returns {void}
 */
function saveFavorites() {
  try {
    localStorage.setItem('auto-drum-favorites', JSON.stringify([...favoriteSoundIds]));
  } catch {
    // 保存できない場合も、この画面ではお気に入りを保持する
  }
}

/**
 * 音色のPCMサンプルを取得し、未生成の場合は合成して保持する
 *
 * @param {import("./sounds.js").SoundDefinition} sound 音色の定義
 * @returns {Float32Array}
 */
function getPcmSamples(sound) {
  if (!pcmSamplesBySoundId.has(sound.id)) {
    pcmSamplesBySoundId.set(sound.id, renderSound(sound, SAMPLE_RATE));
  }

  return pcmSamplesBySoundId.get(sound.id);
}

/**
 * カテゴリーと検索文字列に一致する音色を取得する
 *
 * @returns {import("./sounds.js").SoundDefinition[]}
 */
function getVisibleSounds() {
  const query = queryElement('#search').value.trim().toLocaleLowerCase();

  return sounds.filter((sound) => {
    const category = categoryById.get(sound.category);
    const matchesCategory = categoryFilter === 'all' || categoryFilter === 'favorites' && favoriteSoundIds.has(sound.id) || categoryFilter === sound.category;
    const searchable = `${sound.id} ${sound.name} ${sound.english} ${sound.description} ${category.name} ${category.english}`.toLocaleLowerCase();

    return matchesCategory && searchable.includes(query);
  });
}

/**
 * カテゴリーとお気に入りの選択ボタンを描画する
 *
 * @returns {void}
 */
function renderNavigation() {
  /**
   * カテゴリー選択ボタンのHTMLを生成する
   *
   * @param {string} id 絞り込みID
   * @param {string} name 表示名
   * @param {number} count 音色数
   * @param {string} [decoration=""] 装飾用HTML
   * @returns {string}
   */
  const renderCategoryButtonHtml = (id, name, count, decoration = '') => `<button class="category-button" data-filter="${id}" aria-pressed="${categoryFilter === id}" type="button">${decoration}<span>${name}</span><span class="nav-count">${count}</span></button>`;

  queryElement('#category-nav').innerHTML = renderCategoryButtonHtml('all', 'すべての音色', sounds.length, renderIconHtml('grid', 'nav-icon'))
    + renderCategoryButtonHtml('favorites', 'お気に入り', favoriteSoundIds.size, renderIconHtml('heart', 'nav-icon'))
    + '<hr class="nav-separator" />'
    + categories.map((category) => renderCategoryButtonHtml(category.id, category.name, sounds.filter((sound) => sound.category === category.id).length,
      `<span class="category-dot" style="--category-color:${category.color}"></span>`)).join('');
}

/**
 * PCMサンプルから音の波形と再生位置を描画する
 *
 * @param {HTMLCanvasElement} canvas 描画先
 * @param {import("./sounds.js").SoundDefinition} sound 音色の定義
 * @param {number} [progress=-1] 再生位置の割合。負数は未再生
 * @param {boolean} [isDeckWave=false] 下部の試聴用波形かどうか
 * @returns {void}
 */
function drawWave(canvas, sound, progress = -1, isDeckWave = false) {
  const canvasContext = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const peaks = waveformPeaks(getPcmSamples(sound), isDeckWave ? 110 : 56);

  canvasContext.clearRect(0, 0, width, height);
  const color = categoryById.get(sound.category).color;
  canvasContext.fillStyle = isDeckWave ? '#728266' : `${color}55`;
  canvasContext.fillRect(0, height / 2, width, isDeckWave ? 1 : .7);
  const step = width / peaks.length;

  peaks.forEach((peak, index) => {
    canvasContext.fillStyle = isDeckWave ? index / peaks.length <= progress ? '#e0ecbb' : '#90a07e' : color;
    const barHeight = Math.max(1.2, peak * height * .95);
    canvasContext.fillRect(index * step, (height - barHeight) / 2, Math.max(1, step * .48), barHeight);
  });

  if (isDeckWave && progress >= 0 && progress <= 1) {
    canvasContext.fillStyle = '#e6efc8';
    canvasContext.fillRect(width * progress, 0, 1.5, height);
  }
}

/**
 * 絞り込んだ音色のパッドと検索結果を描画する
 *
 * @returns {void}
 */
function renderGrid() {
  const visibleSoundEntries = getVisibleSounds();
  queryElement('#collection-title').textContent = categoryFilter === 'all' ? 'すべての音色' : categoryFilter === 'favorites' ? 'お気に入り' : categoryById.get(categoryFilter).name;
  queryElement('#result-count').textContent = `${visibleSoundEntries.length} sounds`;
  queryElement('#empty-state').hidden = visibleSoundEntries.length > 0;
  queryElement('#empty-message').textContent = categoryFilter === 'favorites' && favoriteSoundIds.size === 0
    ? '気になる音のハートを押して、ここに集めよう。' : '一致する音色が見つかりませんでした。';
  queryElement('#sound-grid').innerHTML = visibleSoundEntries.map((sound) => {
    const category = categoryById.get(sound.category);

    return `<article class="sound-card ${sound.id === selectedSound.id ? 'selected' : ''}" data-id="${sound.id}" style="--sound-color:${category.color}">
      <button class="sound-pad" type="button" aria-label="${sound.name}を試聴" aria-pressed="${sound.id === selectedSound.id}">
        <span class="card-number">${String(sound.id).padStart(2, '0')}</span>
        <canvas class="card-wave" width="300" height="60" aria-hidden="true"></canvas>
        <strong>${sound.name}</strong><span class="english-name">${sound.english}</span>
        <span class="card-bottom"><span class="color-dot"></span>${category.english}</span>
      </button>
      <button class="favorite-button" type="button" aria-label="${sound.name}のお気に入り" aria-pressed="${favoriteSoundIds.has(sound.id)}">${renderIconHtml('heart')}</button>
    </article>`;
  }).join('');

  // 初期表示や絞り込みの操作を妨げないよう、波形の描画を分割する
  const waveformCanvases = [...document.querySelectorAll('.card-wave')];
  let waveformCursor = 0;

  /**
   * 画面操作を妨げないように波形を少数ずつ描画する
   *
   * @returns {void}
   */
  const drawWaveformBatch = () => {

    // 表示中のパッドの波形を1フレームにつき3個まで描画する
    for (let count = 0; count < 3 && waveformCursor < waveformCanvases.length; count++, waveformCursor++) {
      const canvas = waveformCanvases[waveformCursor];

      if (!canvas.isConnected) {

        return;
      }

      drawWave(canvas, visibleSoundEntries[waveformCursor]);
    }

    if (waveformCursor < waveformCanvases.length) {
      requestAnimationFrame(drawWaveformBatch);
    }

  };

  requestAnimationFrame(drawWaveformBatch);
}

/**
 * 選択した音色の情報とパッドの状態を更新する
 *
 * @param {import("./sounds.js").SoundDefinition} sound 選択する音色
 * @param {boolean} [announce=true] 選択内容を読み上げに通知するか
 * @returns {void}
 */
function selectSound(sound, announce = true) {
  selectedSound = sound;
  const category = categoryById.get(sound.category);
  queryElement('#selected-category').textContent = `${category.english} / ${String(sound.id).padStart(2, '0')}`;
  queryElement('#selected-name').textContent = sound.name;
  queryElement('#selected-description').textContent = sound.description;
  queryElement('#duration-label').textContent = `${sound.duration.toFixed(2)} s`;
  document.querySelectorAll('.sound-card').forEach((card) => {
    const isSelected = Number(card.dataset.id) === sound.id;
    card.classList.toggle('selected', isSelected);
    card.querySelector('.sound-pad').setAttribute('aria-pressed', String(isSelected));
  });
  cancelAnimationFrame(waveformAnimationFrameId);
  drawWave(queryElement('#deck-wave'), sound, -1, true);

  if (announce) {
    queryElement('#announcement').textContent = `${sound.name}：${sound.description}`;
  }
}

/**
 * 初回操作で音声出力を準備し、再生できる状態にする
 *
 * @returns {Promise<void>}
 */
async function initializeAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error('このブラウザは音声再生に対応していません。');
    }

    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = Number(queryElement('#volume').value) / 100 * .7;
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 12;
    compressor.ratio.value = 6;
    compressor.attack.value = .003;
    compressor.release.value = .15;
    masterGain.connect(compressor).connect(audioContext.destination);
  }

  if (audioContext.state !== 'running') {
    await audioContext.resume();
  }

  if (audioContext.state !== 'running') {
    throw new Error('音声を開始できませんでした。もう一度パッドを押してください。');
  }
}

/**
 * 予約した再生時刻に合わせてパッドと波形を更新する
 *
 * @param {import("./sounds.js").SoundDefinition} sound 再生する音色
 * @param {number} time AudioContext上の再生時刻（秒）
 * @returns {void}
 */
function highlightPlayback(sound, time) {
  const playbackToken = playbackGeneration;
  const highlightTimeoutId = setTimeout(() => {
    highlightTimeoutIds.delete(highlightTimeoutId);

    if (playbackToken !== playbackGeneration) {

      return;
    }

    selectSound(sound);
    const card = document.querySelector(`.sound-card[data-id="${sound.id}"]`);
    card?.classList.add('sounding');
    const highlightEndTimeoutId = setTimeout(() => {
      highlightTimeoutIds.delete(highlightEndTimeoutId);
      card?.classList.remove('sounding');
    }, Math.min(450, sound.duration * 1000));
    highlightTimeoutIds.add(highlightEndTimeoutId);
    playbackStartTime = audioContext.currentTime;
    cancelAnimationFrame(waveformAnimationFrameId);

    /**
     * 再生中の波形と再生位置を更新する
     *
     * @returns {void}
     */
    const animatePlaybackWave = () => {
      const progress = (audioContext.currentTime - playbackStartTime) / sound.duration;
      drawWave(queryElement('#deck-wave'), sound, Math.min(1, progress), true);

      if (progress < 1 && selectedSound.id === sound.id) {
        waveformAnimationFrameId = requestAnimationFrame(animatePlaybackWave);
      }

    };

    waveformAnimationFrameId = requestAnimationFrame(animatePlaybackWave);
  }, Math.max(0, (time - audioContext.currentTime) * 1000));
  highlightTimeoutIds.add(highlightTimeoutId);
}

/**
 * 音色の音声バッファを用意し、指定時刻の再生を予約する
 *
 * @param {import("./sounds.js").SoundDefinition} sound 再生する音色
 * @param {number} time AudioContext上の再生時刻（秒）
 * @returns {void}
 */
function scheduleSound(sound, time) {
  if (!audioBuffersBySoundId.has(sound.id)) {
    const pcmSamples = getPcmSamples(sound);
    const buffer = audioContext.createBuffer(1, pcmSamples.length, SAMPLE_RATE);
    buffer.copyToChannel(pcmSamples, 0);
    audioBuffersBySoundId.set(sound.id, buffer);
  }

  // 連続クリックで同時発音数が増えすぎないよう、古い音から停止する
  if (activeVoices.size >= 24) {
    const oldestVoice = activeVoices.values().next().value;
    oldestVoice.gain.gain.setTargetAtTime(0, audioContext.currentTime, .005);
    oldestVoice.source.stop(audioContext.currentTime + .02);
    activeVoices.delete(oldestVoice);
  }

  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  source.buffer = audioBuffersBySoundId.get(sound.id);
  source.connect(gain).connect(masterGain);
  const voice = { source, gain };
  activeVoices.add(voice);
  source.onended = () => {
    activeVoices.delete(voice);
    source.disconnect();
    gain.disconnect();
  };

  source.start(time);
  highlightPlayback(sound, time);
}

/**
 * 連続試聴のモードをボタンに反映する
 *
 * @returns {void}
 */
function updateModeButtons() {
  queryElement('#repeat').setAttribute('aria-pressed', String(playbackMode === 'repeat'));
  queryElement('#tour').setAttribute('aria-pressed', String(playbackMode === 'tour'));
}

/**
 * 予約処理と再生中の音を停止し、画面の再生状態を解除する
 *
 * @returns {void}
 */
function stopPlayback() {
  playbackGeneration++;
  playbackMode = null;
  clearInterval(schedulerIntervalId);
  schedulerIntervalId = null;
  highlightTimeoutIds.forEach(clearTimeout);
  highlightTimeoutIds.clear();
  cancelAnimationFrame(waveformAnimationFrameId);

  if (audioContext) {

    // 再生中の音を短くフェードして停止する
    for (const voice of activeVoices) {
      voice.gain.gain.setTargetAtTime(0, audioContext.currentTime, .004);
      voice.source.stop(audioContext.currentTime + .02);
    }

    activeVoices.clear();
  }

  document.querySelectorAll('.sounding').forEach((card) => card.classList.remove('sounding'));
  updateModeButtons();
  drawWave(queryElement('#deck-wave'), selectedSound, -1, true);
}

/**
 * 指定した音色を単発で試聴する
 *
 * @param {import("./sounds.js").SoundDefinition} sound 試聴する音色
 * @returns {Promise<void>}
 */
async function auditionSound(sound) {
  stopPlayback();
  selectSound(sound);
  const playbackToken = playbackGeneration;

  try {
    await initializeAudio();

    if (playbackToken !== playbackGeneration) {

      return;
    }

    scheduleSound(sound, audioContext.currentTime + .012);
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * リピートまたは順番の試聴を開始し、同じモードの再選択で停止する
 *
 * @param {"repeat" | "tour"} requestedMode 指定する連続試聴モード
 * @returns {Promise<void>}
 */
async function setPlaybackMode(requestedMode) {
  if (playbackMode === requestedMode) {
    stopPlayback();

    return;
  }

  stopPlayback();
  const playbackToken = playbackGeneration;

  try {
    await initializeAudio();

    if (playbackToken !== playbackGeneration) {

      return;
    }

    const visibleSoundEntries = getVisibleSounds();

    if (requestedMode === 'tour' && visibleSoundEntries.length === 0) {
      showToast('試聴する音色がありません。');

      return;
    }

    playbackMode = requestedMode;
    tourSoundIndex = Math.max(0, visibleSoundEntries.findIndex((sound) => sound.id === selectedSound.id));
    nextPlaybackTime = audioContext.currentTime + .025;
    updateModeButtons();

    /**
     * 少し先の音を予約し、連続試聴の再生位置を進める
     *
     * @returns {void}
     */
    const scheduleUpcomingSounds = () => {
      if (audioContext.state !== 'running') {

        return;
      }

      if (nextPlaybackTime < audioContext.currentTime) {
        nextPlaybackTime = audioContext.currentTime + .025;
      }

      // 先読み範囲に入った音を再生時刻順に予約する
      while (nextPlaybackTime < audioContext.currentTime + .12) {
        const visibleSoundEntries = getVisibleSounds();

        if (playbackMode === 'tour' && visibleSoundEntries.length === 0) {
          stopPlayback();

          return;
        }

        const sound = playbackMode === 'repeat' ? selectedSound : visibleSoundEntries[tourSoundIndex % visibleSoundEntries.length];
        scheduleSound(sound, nextPlaybackTime);
        nextPlaybackTime += Math.max(.85, sound.duration + .18);
        tourSoundIndex++;
      }

    };

    scheduleUpcomingSounds();
    schedulerIntervalId = setInterval(scheduleUpcomingSounds, 25);
  } catch (error) {
    stopPlayback();
    showToast(error.message);
  }
}

/**
 * 短い操作結果の通知を表示する
 *
 * @param {string} message 通知内容
 * @returns {void}
 */
function showToast(message) {
  queryElement('#toast').textContent = message;
  queryElement('#toast').hidden = false;
  clearTimeout(toastTimeoutId);
  toastTimeoutId = setTimeout(() => {
    queryElement('#toast').hidden = true;
  }, 3000);
}

/**
 * カテゴリーの絞り込みと音色一覧を更新する
 *
 * @param {string} newCategoryFilter カテゴリーID、all、favoritesのいずれか
 * @returns {void}
 */
function changeCategoryFilter(newCategoryFilter) {
  if (playbackMode === 'tour') {
    stopPlayback();
  }

  categoryFilter = newCategoryFilter;
  renderNavigation();
  renderGrid();
}

queryElement('#category-nav').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');

  if (button) {
    changeCategoryFilter(button.dataset.filter);
  }
});

queryElement('#sound-grid').addEventListener('click', (event) => {
  const card = event.target.closest('.sound-card');

  if (!card) {

    return;
  }

  const sound = sounds[Number(card.dataset.id) - 1];

  if (event.target.closest('.favorite-button')) {
    if (favoriteSoundIds.has(sound.id)) {
      favoriteSoundIds.delete(sound.id);
    } else {
      favoriteSoundIds.add(sound.id);
    }

    saveFavorites();
    renderNavigation();

    if (categoryFilter === 'favorites') {
      renderGrid();
    } else {
      card.querySelector('.favorite-button').setAttribute('aria-pressed', String(favoriteSoundIds.has(sound.id)));
    }

    queryElement('#announcement').textContent = `${sound.name}をお気に入り${favoriteSoundIds.has(sound.id) ? 'に追加しました' : 'から外しました'}`;
  } else if (event.target.closest('.sound-pad')) auditionSound(sound);
});

queryElement('#search').addEventListener('input', () => {
  if (playbackMode === 'tour') {
    stopPlayback();
  }

  renderGrid();
});
queryElement('#reset-filter').addEventListener('click', () => {
  queryElement('#search').value = '';
  changeCategoryFilter('all');
});
queryElement('#play-selected').addEventListener('click', () => auditionSound(selectedSound));
queryElement('#repeat').addEventListener('click', () => setPlaybackMode('repeat'));
queryElement('#tour').addEventListener('click', () => setPlaybackMode('tour'));
queryElement('#stop').addEventListener('click', stopPlayback);

queryElement('#volume').addEventListener('input', () => {
  queryElement('#volume-value').textContent = `${queryElement('#volume').value}%`;

  if (masterGain) {
    masterGain.gain.setTargetAtTime(Number(queryElement('#volume').value) / 100 * .7, audioContext.currentTime, .015);
  }
});

queryElement('#download').addEventListener('click', () => {
  const wavUrl = URL.createObjectURL(new Blob([encodeWav(getPcmSamples(selectedSound), SAMPLE_RATE)], { type: 'audio/wav' }));
  const downloadLink = document.createElement('a');
  downloadLink.href = wavUrl;
  downloadLink.download = `${String(selectedSound.id).padStart(2, '0')}-${selectedSound.english.toLowerCase().replaceAll(' ', '-')}.wav`;
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  setTimeout(() => URL.revokeObjectURL(wavUrl), 1000);
  showToast(`${selectedSound.name}のWAVを保存しました。`);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    stopPlayback();

    return;
  }

  if (event.code !== 'Space' || event.repeat || event.target.closest('input, textarea, button, a, [contenteditable]')) {

    return;
  }

  event.preventDefault();
  auditionSound(selectedSound);
});

renderNavigation();
renderGrid();
selectSound(selectedSound, false);
