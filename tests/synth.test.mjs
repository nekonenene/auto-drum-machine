import test from 'node:test';
import assert from 'node:assert/strict';
import { sounds, categories } from '../sounds.js';
import { renderSound, waveformPeaks, encodeWav } from '../synth.js';

test('all 70 sounds produce unique audible finite PCM with safe peaks and silent boundaries', () => {
  assert.equal(sounds.length, 70);
  const fingerprints = new Set();

  // 全音色のPCMを生成し、波形と音声出力の条件を確認する
  for (const sound of sounds) {
    assert.ok(categories.some((category) => category.id === sound.category));
    const pcmSamples = renderSound(sound);
    assert.equal(pcmSamples.length, Math.ceil(sound.duration * 48000));
    let peak = 0;
    let energy = 0;

    // 各サンプルの有限性、最大振幅、エネルギーを確認する
    for (const sample of pcmSamples) {
      assert.ok(Number.isFinite(sample), sound.name);
      peak = Math.max(peak, Math.abs(sample));
      energy += sample ** 2;
    }

    assert.ok(peak <= .781 && peak >= .77, `${sound.name}: ${peak}`);
    assert.ok(energy > 1, `${sound.name} is silent`);
    assert.equal(Math.abs(pcmSamples[0]), 0);
    assert.equal(Math.abs(pcmSamples.at(-1)), 0);
    fingerprints.add([...pcmSamples.slice(10, 40)].join(','));
    assert.equal(waveformPeaks(pcmSamples).length, 72);
  }

  assert.equal(fingerprints.size, 70);
});

test('rendering is repeatable and WAV exports contain the same duration and correct PCM header', () => {
  const sound = sounds.find((sound) => sound.type === 'snare');
  const pcmSamples = renderSound(sound);
  assert.deepEqual(pcmSamples, renderSound(sound));
  const wavBytes = encodeWav(pcmSamples, 48000);
  const wavView = new DataView(wavBytes);

  /**
   * WAVヘッダーの指定範囲をASCII文字列として読み取る
   *
   * @param {number} start 読み取り位置（バイト）
   * @param {number} length 文字数
   * @returns {string}
   */
  const readHeaderText = (start, length) => String.fromCharCode(...new Uint8Array(wavBytes, start, length));

  assert.equal(readHeaderText(0, 4), 'RIFF');
  assert.equal(readHeaderText(8, 4), 'WAVE');
  assert.equal(readHeaderText(36, 4), 'data');
  assert.equal(wavView.getUint32(24, true), 48000);
  assert.equal(wavView.getUint16(22, true), 1);
  assert.equal(wavView.getUint16(34, true), 16);
  assert.equal(wavView.getUint32(40, true), pcmSamples.length * 2);
  assert.equal(wavBytes.byteLength, 44 + pcmSamples.length * 2);
});
