import test from 'node:test';
import assert from 'node:assert/strict';
import { sounds, categories } from '../sounds.js';
import { renderSound, waveformPeaks, encodeWav } from '../synth.js';

test('all 70 sounds produce unique audible finite PCM with safe peaks and silent boundaries', () => {
  assert.equal(sounds.length, 70);
  const fingerprints = new Set();
  for (const sound of sounds) {
    assert.ok(categories.some((category) => category.id === sound.category));
    const samples = renderSound(sound);
    assert.equal(samples.length, Math.ceil(sound.duration * 48000));
    let peak = 0;
    let energy = 0;
    for (const sample of samples) {
      assert.ok(Number.isFinite(sample), sound.name);
      peak = Math.max(peak, Math.abs(sample));
      energy += sample ** 2;
    }
    assert.ok(peak <= .781 && peak >= .77, `${sound.name}: ${peak}`);
    assert.ok(energy > 1, `${sound.name} is silent`);
    assert.equal(Math.abs(samples[0]), 0);
    assert.equal(Math.abs(samples.at(-1)), 0);
    fingerprints.add([...samples.slice(10, 40)].join(','));
    assert.equal(waveformPeaks(samples).length, 72);
  }
  assert.equal(fingerprints.size, 70);
});

test('rendering is repeatable and WAV exports contain the same duration and correct PCM header', () => {
  const sound = sounds.find((sound) => sound.type === 'snare');
  const samples = renderSound(sound);
  assert.deepEqual(samples, renderSound(sound));
  const wav = encodeWav(samples, 48000);
  const view = new DataView(wav);
  const text = (start, length) => String.fromCharCode(...new Uint8Array(wav, start, length));
  assert.equal(text(0, 4), 'RIFF');
  assert.equal(text(8, 4), 'WAVE');
  assert.equal(text(36, 4), 'data');
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), samples.length * 2);
  assert.equal(wav.byteLength, 44 + samples.length * 2);
});
