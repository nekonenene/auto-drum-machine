import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sounds, categories } from '../sounds.js';
import { renderSound, waveformPeaks, encodeWav } from '../synth.js';
import { decodeSampleWav, loadSampleSources } from '../samples.js';

const sampleSources = await loadSampleSources(sounds, async (path) => {
  const bytes = await readFile(new URL(`../${path}`, import.meta.url));

  return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
});

/**
 * 合成音・実音の両方を同じ条件で生成する
 *
 * @param {import("../sounds.js").SoundDefinition} sound 音色定義
 * @returns {Float32Array}
 */
const renderCatalogSound = (sound) => renderSound(sound, 48000, sampleSources.get(sound.sample));

/**
 * 指定区間の実効振幅を求める
 *
 * @param {Float32Array} pcmSamples 音声サンプル
 * @param {number} startSeconds 区間の始点（秒）
 * @param {number} endSeconds 区間の終点（秒）
 * @returns {number}
 */
function rms(pcmSamples, startSeconds, endSeconds) {
  const segment = pcmSamples.subarray(Math.round(startSeconds * 48000), Math.round(endSeconds * 48000));

  return Math.sqrt(segment.reduce((sum, value) => sum + value ** 2, 0) / segment.length);
}

test('all 90 sounds produce unique audible finite PCM with safe peaks and silent boundaries', () => {
  assert.equal(sounds.length, 90);
  const fingerprints = new Set();

  // 全音色のPCMを生成し、波形と音声出力の条件を確認する
  for (const sound of sounds) {
    assert.ok(categories.some((category) => category.id === sound.category));
    const pcmSamples = renderCatalogSound(sound);
    assert.ok(!sound.description.endsWith('。'), sound.name);
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
    fingerprints.add(createHash('sha256').update(new Uint8Array(pcmSamples.buffer)).digest('hex'));
    assert.equal(waveformPeaks(pcmSamples).length, 72);
  }

  assert.equal(fingerprints.size, 90);
});

test('rendering is repeatable and WAV exports contain the same duration and correct PCM header', () => {
  const sound = sounds.find((sound) => sound.type === 'chip-noise');
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

test('kick, snares and toms decay quickly enough to leave space for the next hit', () => {
  const drumIds = [1, 5, 6, 7, 8, 20, 21, 22, 23, 71, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90];

  // 余韻の後半が打撃の先頭より十分小さくなり、短いバッファーに収まることを確認する
  for (const id of drumIds) {
    const sound = sounds[id - 1];
    const pcmSamples = renderCatalogSound(sound);
    assert.ok(sound.duration <= .44, sound.name);
    assert.ok(rms(pcmSamples, sound.duration * .75, sound.duration)
      < rms(pcmSamples, 0, sound.duration * .25) * .05, sound.name);
  }

  assert.equal(new Set(sounds.slice(4, 7).map((sound) => sound.sample)).size, 3);
});

test('reverse samples build toward the end and swells have a delayed attack', () => {

  // リバース実音は先頭より終端側の音量が大きく、スウェルは中央で膨らむことを確認する
  for (const sound of sounds.filter((sound) => sound.reverse || sound.swell || sound.type === 'swell')) {
    const pcmSamples = renderCatalogSound(sound);
    const early = rms(pcmSamples, 0, sound.duration * .1);
    const later = sound.reverse
      ? rms(pcmSamples, sound.duration * .8, sound.duration * .95)
      : rms(pcmSamples, sound.duration * .3, sound.duration * .6);
    assert.ok(later > early * 3, sound.name);
  }
});

test('wide clap places its strongest attack in the first 10ms and keeps a softer tail', () => {
  const sound = sounds[9];
  const pcmSamples = renderCatalogSound(sound);
  let peakIndex = 0;

  // 最大振幅の時刻を求め、遅れた打撃が主音になっていないことを確認する
  for (let index = 1; index < pcmSamples.length; index++) {
    if (Math.abs(pcmSamples[index]) > Math.abs(pcmSamples[peakIndex])) {
      peakIndex = index;
    }
  }

  assert.ok(peakIndex / 48000 < .01, `peak arrives at ${peakIndex / 48000}s`);
  const initialRms = rms(pcmSamples, 0, .01);

  // 後続の10ms区間が先頭の打撃を上回らず、余韻は適度に残ることを確認する
  for (let start = .01; start < .15; start += .01) {
    assert.ok(rms(pcmSamples, start, start + .01) < initialRms * .9);
  }

  assert.ok(rms(pcmSamples, .04, .1) > initialRms * .1);
  assert.ok(rms(pcmSamples, sound.duration * .75, sound.duration) < initialRms * .01);
});

test('sample WAV export uses the processed PCM and preserves its 48kHz duration', () => {
  const sound = sounds[4];
  const pcmSamples = renderCatalogSound(sound);
  const decoded = decodeSampleWav(encodeWav(pcmSamples, 48000));
  assert.equal(decoded.sampleRate, 48000);
  assert.equal(decoded.pcmSamples.length, Math.round(sound.duration * 48000));

  // 実音の加工結果がWAVへ量子化されるだけで、別の合成音に置き換わらないことを確認する
  for (let index = 0; index < pcmSamples.length; index++) {
    assert.ok(Math.abs(decoded.pcmSamples[index] - pcmSamples[index]) < 2 / 32768);
  }

  assert.throws(() => renderSound(sound), /実音素材が読み込まれていません/);
});

test('all bundled CC0 samples have verified provenance and file hashes', async () => {
  const sampleFolders = ['assets/drums', 'assets/rusty-drums'];
  const verifiedPaths = new Set();

  // 各ライブラリの出典一覧と素材全件を照合し、欠落や取り違えを確認する
  for (const folder of sampleFolders) {
    const manifest = JSON.parse(await readFile(new URL(`../${folder}/sources.json`, import.meta.url), 'utf8'));
    assert.equal(manifest.license, 'CC0-1.0');

    // 加工後のハッシュと固定リビジョンを確認し、使用する素材のパスを集める
    for (const entry of manifest.entries) {
      const path = `${folder}/${entry.file}`;
      assert.ok(sampleSources.has(path), path);
      const bytes = await readFile(new URL(`../${path}`, import.meta.url));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
      assert.ok(entry.url.includes(manifest.revision));
      assert.ok((entry.layers || []).every((layer) => layer.url.includes(manifest.revision)));
      assert.equal(sampleSources.get(path).pcmSamples.length, entry.frameCount);
      verifiedPaths.add(path);
    }

  }

  assert.equal(verifiedPaths.size, 13);
  assert.deepEqual(verifiedPaths, new Set(sampleSources.keys()));
});

test('electronic toms have a descending pitch and four ordered pitches for fills', () => {
  const electronicToms = sounds.filter((sound) => sound.type === 'electronic-tom');
  assert.equal(electronicToms.length, 4);
  const settledPitches = [];

  /**
   * 正方向のゼロ交差間隔から、ノイズの少ないタムの音程を推定する
   *
   * @param {Float32Array} pcmSamples 音声サンプル
   * @param {number} startSeconds 区間の始点（秒）
   * @param {number} endSeconds 区間の終点（秒）
   * @returns {number}
   */
  function estimatePitch(pcmSamples, startSeconds, endSeconds) {
    const crossings = [];

    // 打撃の瞬間を避け、音の周期を示す正方向のゼロ交差を集める
    for (let index = Math.round(startSeconds * 48000); index < Math.round(endSeconds * 48000); index++) {
      if (pcmSamples[index - 1] <= 0 && pcmSamples[index] > 0) {
        crossings.push(index);
      }
    }

    assert.ok(crossings.length >= 2);

    return (crossings.length - 1) * 48000 / (crossings.at(-1) - crossings[0]);
  }

  // 各タムの音程が先頭から下がり、フィルに使う高低差があることを確認する
  for (const sound of electronicToms) {
    assert.equal(sound.sample, undefined);
    const pcmSamples = renderCatalogSound(sound);
    const initialPitch = estimatePitch(pcmSamples, .005, .045);
    const settledPitch = estimatePitch(pcmSamples, .065, .16);
    assert.ok(initialPitch > settledPitch * 1.1, sound.name);
    settledPitches.push(settledPitch);
  }

  assert.ok(settledPitches.every((pitch, index) => index === 0 || settledPitches[index - 1] > pitch * 1.2));
});

test('chip noise snare ends its stepped burst within 80ms at both sample rates', () => {
  const sound = sounds[7];
  assert.equal(sound.type, 'chip-noise');
  assert.ok(sound.duration <= .12);

  // サンプルレートが変わっても、ノイズの打撃は同じ時間内に完全に切れる
  for (const sampleRate of [44100, 48000]) {
    const pcmSamples = renderSound(sound, sampleRate);
    assert.deepEqual(pcmSamples, renderSound(sound, sampleRate));
    const active = pcmSamples.subarray(Math.round(.005 * sampleRate), Math.round(.04 * sampleRate));
    assert.ok(active.some((sample) => sample > .1));
    assert.ok(active.some((sample) => sample < -.1));
    assert.ok(pcmSamples.subarray(Math.ceil(.08 * sampleRate)).every((sample) => sample === 0));
  }
});

test('fat snare has a stronger low body than the dry and bright snares', () => {

  /**
   * 打撃の先頭100msに含まれる400Hz以下のエネルギー比を求める
   *
   * @param {Float32Array} pcmSamples 音声サンプル
   * @returns {number}
   */
  function lowBodyShare(pcmSamples) {
    const coefficient = 1 - Math.exp(-2 * Math.PI * 400 / 48000);
    let lowpass = 0;
    let lowEnergy = 0;
    let totalEnergy = 0;

    // 低域を取り出し、全体のエネルギーに占める割合を集計する
    for (const sample of pcmSamples.subarray(0, 4800)) {
      lowpass += coefficient * (sample - lowpass);
      lowEnergy += lowpass ** 2;
      totalEnergy += sample ** 2;
    }

    return lowEnergy / totalEnergy;
  }

  const fat = renderCatalogSound(sounds[5]);

  // 同じピーク音量の5・7番と比較し、低域の厚みと打撃の密度の両方を確認する
  for (const id of [5, 7]) {
    const other = renderCatalogSound(sounds[id - 1]);
    assert.ok(lowBodyShare(fat) > lowBodyShare(other) * 1.3);
    assert.ok(rms(fat, 0, .1) > rms(other, 0, .1) * 1.8);
  }
});

test('compressed drums increase density at the same peak and export the processed sound', () => {
  const compressedDrums = sounds.filter((sound) => sound.compression);
  assert.equal(compressedDrums.length, 5);

  // 同じ音の圧縮前後を同じピーク音量で比較し、密度とWAVへの反映を確認する
  for (const sound of compressedDrums) {
    const processed = renderCatalogSound(sound);
    const uncompressed = renderCatalogSound({ ...sound, compression: undefined });
    const processedPeak = processed.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0);
    const uncompressedPeak = uncompressed.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0);
    assert.ok(Math.abs(processedPeak - uncompressedPeak) < .00001);
    assert.ok(rms(processed, 0, .1) > rms(uncompressed, 0, .1) * 1.4, sound.name);
    const decoded = decodeSampleWav(encodeWav(processed, 48000));

    // 圧縮結果がWAVへ量子化されるだけで、保存時に加工が外れないことを確認する
    for (let index = 0; index < processed.length; index++) {
      assert.ok(Math.abs(decoded.pcmSamples[index] - processed[index]) < 2 / 32768);
    }
  }
});

test('a failed sample request reports the error and a subsequent load can recover', async () => {
  const sampleSounds = sounds.slice(4, 7);
  const requestedPaths = [];

  /**
   * 素材取得の失敗を再現し、要求したパスを記録する
   *
   * @param {string} path 素材のパス
   * @returns {Promise<{ok: boolean, status: number}>}
   */
  const failedFetch = async (path) => {
    requestedPaths.push(path);

    return { ok: false, status: 404 };
  };

  await assert.rejects(loadSampleSources(sampleSounds, failedFetch), /実音素材を読み込めませんでした.*HTTP 404/);
  assert.equal(new Set(requestedPaths).size, 3);
  const recovered = await loadSampleSources(sampleSounds, async (path) => ({
    ok: true,
    arrayBuffer: async () => encodeWav(sampleSources.get(path).pcmSamples, sampleSources.get(path).sampleRate),
  }));
  assert.equal(recovered.size, 3);
});
