import { sounds, categories } from './sounds.js';
import { renderSound, waveformPeaks, encodeWav } from './synth.js';

const $ = (selector) => document.querySelector(selector);
const SAMPLE_RATE = 48000;
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
};
const icon = (name, className = '') => `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const categoryMap = new Map(categories.map((category) => [category.id, category]));
const pcmCache = new Map();
const audioBuffers = new Map();
const voices = new Set();
const highlightTimers = new Set();
const favorites = readFavorites();
let selected = sounds[0];
let filter = 'all';
let audioContext;
let master;
let mode = null;
let timer = null;
let nextTime = 0;
let tourIndex = 0;
let generation = 0;
let toastTimer;
let animationFrame;
let playbackStarted = 0;

function readFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem('auto-drum-favorites') || '[]');
    return new Set(Array.isArray(saved) ? saved.filter((id) => sounds.some((sound) => sound.id === id)) : []);
  } catch {
    return new Set();
  }
}

function saveFavorites() {
  try { localStorage.setItem('auto-drum-favorites', JSON.stringify([...favorites])); } catch { /* Favorites still work for this session. */ }
}

function getPCM(sound) {
  if (!pcmCache.has(sound.id)) pcmCache.set(sound.id, renderSound(sound, SAMPLE_RATE));
  return pcmCache.get(sound.id);
}

function visibleSounds() {
  const query = $('#search').value.trim().toLocaleLowerCase();
  return sounds.filter((sound) => {
    const category = categoryMap.get(sound.category);
    const matchesCategory = filter === 'all' || filter === 'favorites' && favorites.has(sound.id) || filter === sound.category;
    const searchable = `${sound.id} ${sound.name} ${sound.english} ${sound.description} ${category.name} ${category.english}`.toLocaleLowerCase();
    return matchesCategory && searchable.includes(query);
  });
}

function renderNavigation() {
  const navigationButton = (id, name, count, decoration = '') => `<button class="category-button" data-filter="${id}" aria-pressed="${filter === id}" type="button">${decoration}<span>${name}</span><span class="nav-count">${count}</span></button>`;
  $('#category-nav').innerHTML = navigationButton('all', 'すべての音色', sounds.length, icon('grid', 'nav-icon'))
    + navigationButton('favorites', 'お気に入り', favorites.size, icon('heart', 'nav-icon'))
    + '<hr class="nav-separator" />'
    + categories.map((category) => navigationButton(category.id, category.name, sounds.filter((sound) => sound.category === category.id).length,
      `<span class="category-dot" style="--category-color:${category.color}"></span>`)).join('');
}

function drawWave(canvas, sound, progress = -1, large = false) {
  const context = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const peaks = waveformPeaks(getPCM(sound), large ? 110 : 56);
  context.clearRect(0, 0, width, height);
  const color = categoryMap.get(sound.category).color;
  context.fillStyle = large ? '#728266' : `${color}55`;
  context.fillRect(0, height / 2, width, large ? 1 : .7);
  const step = width / peaks.length;
  peaks.forEach((peak, index) => {
    context.fillStyle = large ? index / peaks.length <= progress ? '#e0ecbb' : '#90a07e' : color;
    const barHeight = Math.max(1.2, peak * height * .95);
    context.fillRect(index * step, (height - barHeight) / 2, Math.max(1, step * .48), barHeight);
  });
  if (large && progress >= 0 && progress <= 1) {
    context.fillStyle = '#e6efc8';
    context.fillRect(width * progress, 0, 1.5, height);
  }
}

function renderGrid() {
  const entries = visibleSounds();
  $('#collection-title').textContent = filter === 'all' ? 'すべての音色' : filter === 'favorites' ? 'お気に入り' : categoryMap.get(filter).name;
  $('#result-count').textContent = `${entries.length} sounds`;
  $('#empty-state').hidden = entries.length > 0;
  $('#empty-message').textContent = filter === 'favorites' && favorites.size === 0
    ? '気になる音のハートを押して、ここに集めよう。' : '一致する音色が見つかりませんでした。';
  $('#sound-grid').innerHTML = entries.map((sound) => {
    const category = categoryMap.get(sound.category);
    return `<article class="sound-card ${sound.id === selected.id ? 'selected' : ''}" data-id="${sound.id}" style="--sound-color:${category.color}">
      <button class="sound-pad" type="button" aria-label="${sound.name}を試聴" aria-pressed="${sound.id === selected.id}">
        <span class="card-number">${String(sound.id).padStart(2, '0')}</span>
        <canvas class="card-wave" width="300" height="60" aria-hidden="true"></canvas>
        <strong>${sound.name}</strong><span class="english-name">${sound.english}</span>
        <span class="card-bottom"><span class="color-dot"></span>${category.english}</span>
      </button>
      <button class="favorite-button" type="button" aria-label="${sound.name}のお気に入り" aria-pressed="${favorites.has(sound.id)}">${icon('heart')}</button>
    </article>`;
  }).join('');

  // Yield between waveform renders so initial loading and filtering stay responsive.
  const canvases = [...document.querySelectorAll('.card-wave')];
  let cursor = 0;
  const drawBatch = () => {
    for (let count = 0; count < 3 && cursor < canvases.length; count++, cursor++) {
      const canvas = canvases[cursor];
      if (!canvas.isConnected) return;
      drawWave(canvas, entries[cursor]);
    }
    if (cursor < canvases.length) requestAnimationFrame(drawBatch);
  };
  requestAnimationFrame(drawBatch);
}

function selectSound(sound, announce = true) {
  selected = sound;
  const category = categoryMap.get(sound.category);
  $('#selected-category').textContent = `${category.english} / ${String(sound.id).padStart(2, '0')}`;
  $('#selected-name').textContent = sound.name;
  $('#selected-description').textContent = sound.description;
  $('#duration-label').textContent = `${sound.duration.toFixed(2)} s`;
  document.querySelectorAll('.sound-card').forEach((card) => {
    const isSelected = Number(card.dataset.id) === sound.id;
    card.classList.toggle('selected', isSelected);
    card.querySelector('.sound-pad').setAttribute('aria-pressed', String(isSelected));
  });
  cancelAnimationFrame(animationFrame);
  drawWave($('#deck-wave'), sound, -1, true);
  if (announce) $('#announcement').textContent = `${sound.name}：${sound.description}`;
}

async function initializeAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('このブラウザは音声再生に対応していません。');
    audioContext = new AudioContextClass();
    master = audioContext.createGain();
    master.gain.value = Number($('#volume').value) / 100 * .7;
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 12;
    compressor.ratio.value = 6;
    compressor.attack.value = .003;
    compressor.release.value = .15;
    master.connect(compressor).connect(audioContext.destination);
  }
  if (audioContext.state !== 'running') await audioContext.resume();
  if (audioContext.state !== 'running') throw new Error('音声を開始できませんでした。もう一度パッドを押してください。');
}

function highlight(sound, time) {
  const token = generation;
  const timeout = setTimeout(() => {
    highlightTimers.delete(timeout);
    if (token !== generation) return;
    selectSound(sound);
    const card = document.querySelector(`.sound-card[data-id="${sound.id}"]`);
    card?.classList.add('sounding');
    const end = setTimeout(() => {
      highlightTimers.delete(end);
      card?.classList.remove('sounding');
    }, Math.min(450, sound.duration * 1000));
    highlightTimers.add(end);
    playbackStarted = audioContext.currentTime;
    cancelAnimationFrame(animationFrame);
    const animate = () => {
      const progress = (audioContext.currentTime - playbackStarted) / sound.duration;
      drawWave($('#deck-wave'), sound, Math.min(1, progress), true);
      if (progress < 1 && selected.id === sound.id) animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
  }, Math.max(0, (time - audioContext.currentTime) * 1000));
  highlightTimers.add(timeout);
}

function scheduleSound(sound, time) {
  if (!audioBuffers.has(sound.id)) {
    const samples = getPCM(sound);
    const buffer = audioContext.createBuffer(1, samples.length, SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);
    audioBuffers.set(sound.id, buffer);
  }
  // Keep bursts of clicking from building up unlimited simultaneous voices.
  if (voices.size >= 24) {
    const oldest = voices.values().next().value;
    oldest.gain.gain.setTargetAtTime(0, audioContext.currentTime, .005);
    oldest.source.stop(audioContext.currentTime + .02);
    voices.delete(oldest);
  }
  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  source.buffer = audioBuffers.get(sound.id);
  source.connect(gain).connect(master);
  const voice = { source, gain };
  voices.add(voice);
  source.onended = () => { voices.delete(voice); source.disconnect(); gain.disconnect(); };
  source.start(time);
  highlight(sound, time);
}

function updateModeButtons() {
  $('#repeat').setAttribute('aria-pressed', String(mode === 'repeat'));
  $('#tour').setAttribute('aria-pressed', String(mode === 'tour'));
}

function stopPlayback() {
  generation++;
  mode = null;
  clearInterval(timer);
  timer = null;
  highlightTimers.forEach(clearTimeout);
  highlightTimers.clear();
  cancelAnimationFrame(animationFrame);
  if (audioContext) {
    for (const voice of voices) {
      voice.gain.gain.setTargetAtTime(0, audioContext.currentTime, .004);
      voice.source.stop(audioContext.currentTime + .02);
    }
    voices.clear();
  }
  document.querySelectorAll('.sounding').forEach((card) => card.classList.remove('sounding'));
  updateModeButtons();
  drawWave($('#deck-wave'), selected, -1, true);
}

async function audition(sound) {
  stopPlayback();
  selectSound(sound);
  const token = generation;
  try {
    await initializeAudio();
    if (token !== generation) return;
    scheduleSound(sound, audioContext.currentTime + .012);
  } catch (error) { showToast(error.message); }
}

async function setMode(requested) {
  if (mode === requested) { stopPlayback(); return; }
  stopPlayback();
  const token = generation;
  try {
    await initializeAudio();
    if (token !== generation) return;
    const entries = visibleSounds();
    if (requested === 'tour' && entries.length === 0) { showToast('試聴する音色がありません。'); return; }
    mode = requested;
    tourIndex = Math.max(0, entries.findIndex((sound) => sound.id === selected.id));
    nextTime = audioContext.currentTime + .025;
    updateModeButtons();
    const tick = () => {
      if (audioContext.state !== 'running') return;
      if (nextTime < audioContext.currentTime) nextTime = audioContext.currentTime + .025;
      while (nextTime < audioContext.currentTime + .12) {
        const entries = visibleSounds();
        if (mode === 'tour' && entries.length === 0) { stopPlayback(); return; }
        const sound = mode === 'repeat' ? selected : entries[tourIndex % entries.length];
        scheduleSound(sound, nextTime);
        nextTime += Math.max(.85, sound.duration + .18);
        tourIndex++;
      }
    };
    tick();
    timer = setInterval(tick, 25);
  } catch (error) { stopPlayback(); showToast(error.message); }
}

function showToast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3000);
}

function changeFilter(newFilter) {
  if (mode === 'tour') stopPlayback();
  filter = newFilter;
  renderNavigation();
  renderGrid();
}

$('#category-nav').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (button) changeFilter(button.dataset.filter);
});

$('#sound-grid').addEventListener('click', (event) => {
  const card = event.target.closest('.sound-card');
  if (!card) return;
  const sound = sounds[Number(card.dataset.id) - 1];
  if (event.target.closest('.favorite-button')) {
    if (favorites.has(sound.id)) favorites.delete(sound.id); else favorites.add(sound.id);
    saveFavorites();
    renderNavigation();
    if (filter === 'favorites') renderGrid();
    else card.querySelector('.favorite-button').setAttribute('aria-pressed', String(favorites.has(sound.id)));
    $('#announcement').textContent = `${sound.name}をお気に入り${favorites.has(sound.id) ? 'に追加しました' : 'から外しました'}`;
  } else if (event.target.closest('.sound-pad')) audition(sound);
});

$('#search').addEventListener('input', () => {
  if (mode === 'tour') stopPlayback();
  renderGrid();
});
$('#reset-filter').addEventListener('click', () => { $('#search').value = ''; changeFilter('all'); });
$('#play-selected').addEventListener('click', () => audition(selected));
$('#repeat').addEventListener('click', () => setMode('repeat'));
$('#tour').addEventListener('click', () => setMode('tour'));
$('#stop').addEventListener('click', stopPlayback);
$('#volume').addEventListener('input', () => {
  $('#volume-value').textContent = `${$('#volume').value}%`;
  if (master) master.gain.gain.setTargetAtTime(Number($('#volume').value) / 100 * .7, audioContext.currentTime, .015);
});
$('#download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([encodeWav(getPCM(selected), SAMPLE_RATE)], { type: 'audio/wav' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${String(selected.id).padStart(2, '0')}-${selected.english.toLowerCase().replaceAll(' ', '-')}.wav`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`${selected.name}のWAVを保存しました。`);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { stopPlayback(); return; }
  if (event.code !== 'Space' || event.repeat || event.target.closest('input, textarea, button, a, [contenteditable]')) return;
  event.preventDefault();
  audition(selected);
});

renderNavigation();
renderGrid();
selectSound(selected, false);
