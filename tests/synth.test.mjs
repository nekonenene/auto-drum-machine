import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sounds, categories } from '../sounds.js';
import { renderSound, waveformPeaks, encodeWav } from '../synth.js';
import { decodeSampleWav, loadSampleSources } from '../samples.js';

const soundByKey = new Map(sounds.map((sound) => [sound.key, sound]));
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

test('display numbers follow category order and keep each drum family together', () => {
  assert.deepEqual(sounds.map((sound) => sound.id), Array.from({ length: 101 }, (_, index) => index + 1));
  const expectedCategories = categories.flatMap((category) => sounds
    .filter((sound) => sound.category === category.id).map(() => category.id));
  assert.deepEqual(sounds.map((sound) => sound.category), expectedCategories);
  assert.ok(sounds.every((sound) => Number.isInteger(sound.key) && sound.key > 0));
  assert.equal(soundByKey.size, sounds.length);
  assert.deepEqual(sounds.slice(0, 8).map((sound) => sound.key), [1, 2, 3, 4, 71, 101, 86, 87]);
  assert.deepEqual(sounds.slice(8, 17).map((sound) => sound.key), [5, 6, 7, 8, 79, 80, 81, 88, 89]);
  assert.equal(soundByKey.get(71).name, 'アコースティックキック');
  assert.equal(soundByKey.get(71).id, 5);
});

test('renumbering display IDs preserves the PCM of every sound through its fixed key', () => {

  // 表示番号だけを変えても、ノイズを含む全音色のPCMが同じになることを確認する
  for (const sound of sounds) {
    assert.deepEqual(renderCatalogSound(sound), renderCatalogSound({ ...sound, id: sound.id + 1000 }), sound.name);
  }
});

test('all 101 sounds produce unique audible finite PCM with safe peaks and silent boundaries', () => {
  assert.equal(sounds.length, 101);
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

    assert.ok(peak <= .951, `${sound.name}: ${peak}`);

    if (!sound.gainDb) {
      assert.ok(peak <= .781 && peak >= .77, `${sound.name}: ${peak}`);
    }

    assert.ok(energy > 1, `${sound.name} is silent`);
    assert.equal(Math.abs(pcmSamples[0]), 0);
    assert.equal(Math.abs(pcmSamples.at(-1)), 0);
    fingerprints.add(createHash('sha256').update(new Uint8Array(pcmSamples.buffer)).digest('hex'));
    assert.equal(waveformPeaks(pcmSamples).length, 72);
  }

  assert.equal(fingerprints.size, 101);
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
  const drumKeys = [1, 5, 6, 7, 8, 20, 21, 22, 23, 71, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90];

  // 余韻の後半が打撃の先頭より十分小さくなり、短いバッファーに収まることを確認する
  for (const key of drumKeys) {
    const sound = soundByKey.get(key);
    const pcmSamples = renderCatalogSound(sound);
    assert.ok(sound.duration <= .44, sound.name);
    assert.ok(rms(pcmSamples, sound.duration * .75, sound.duration)
      < rms(pcmSamples, 0, sound.duration * .25) * .05, sound.name);
  }

  assert.equal(new Set([5, 6, 7].map((key) => soundByKey.get(key).sample)).size, 3);
});

test('rock kick has a prompt hit and a tighter tail than the acoustic kick', () => {
  const rock = renderCatalogSound(soundByKey.get(101));
  const acoustic = renderCatalogSound(soundByKey.get(71));
  const peakIndex = rock.reduce((peakIndex, sample, index) => Math.abs(sample) > Math.abs(rock[peakIndex]) ? index : peakIndex, 0);
  assert.ok(peakIndex / 48000 < .01);
  const rockTail = rms(rock, .1, .2) / rms(rock, 0, .02);
  const acousticTail = rms(acoustic, .1, .2) / rms(acoustic, 0, .02);
  assert.ok(rockTail < acousticTail * .2);
  assert.ok(rms(rock, .24, .32) < rms(rock, 0, .02) * .001);
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
  const sound = soundByKey.get(10);
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

test('attack crash starts with its strongest hit and keeps a softer metallic tail', () => {
  const sound = soundByKey.get(91);
  const originalCrash = soundByKey.get(16);
  assert.equal(sound.id, originalCrash.id + 1);
  assert.notEqual(sound.sample, originalCrash.sample);

  // 元素材の44.1kHzと試聴の48kHzで、先頭の打撃が後続の響きより強いことを確認する
  for (const sampleRate of [44100, 48000]) {
    const pcmSamples = renderSound(sound, sampleRate, sampleSources.get(sound.sample));
    const peakIndex = pcmSamples.reduce((peakIndex, sample, index) => Math.abs(sample) > Math.abs(pcmSamples[peakIndex]) ? index : peakIndex, 0);
    assert.ok(peakIndex / sampleRate < .01);

    /**
     * 現在のサンプルレートに合わせて区間の実効振幅を求める
     *
     * @param {number} startSeconds 区間の始点（秒）
     * @param {number} endSeconds 区間の終点（秒）
     * @returns {number}
     */
    const segmentRms = (startSeconds, endSeconds) => {
      const segment = pcmSamples.subarray(Math.round(startSeconds * sampleRate), Math.round(endSeconds * sampleRate));

      return Math.sqrt(segment.reduce((sum, sample) => sum + sample ** 2, 0) / segment.length);
    };

    const attackRms = segmentRms(0, .02);

    // 各20ms区間を比較し、後から主音が膨らまないことを確認する
    for (let start = .02; start < sound.duration - .02; start += .02) {
      assert.ok(segmentRms(start, start + .02) < attackRms * .9, `${sampleRate}Hz at ${start}s`);
    }

    assert.ok(segmentRms(.2, .4) > attackRms * .1);
    assert.ok(segmentRms(sound.duration * .85, sound.duration) < attackRms * .01);
  }
});

test('sample WAV export uses the processed PCM and preserves its 48kHz duration', () => {
  const sound = soundByKey.get(5);
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
  const sampleFolders = ['assets/drums', 'assets/rusty-drums', 'assets/percussion'];
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

  assert.equal(verifiedPaths.size, 22);
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
  const sound = soundByKey.get(8);
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

  const fat = renderCatalogSound(soundByKey.get(6));

  // 同じピーク音量のドライ・ブライトスネアと比較し、低域の厚みと打撃の密度を確認する
  for (const key of [5, 7]) {
    const other = renderCatalogSound(soundByKey.get(key));
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

test('snare level trims balance the quiet samples and carry through to WAV output', () => {
  const drySnareRms = rms(renderCatalogSound(soundByKey.get(5)), 0, .1);

  // 音量補正で実音スネアを持ち上げ、チップノイズを少し下げたことを確認する
  for (const key of [6, 8, 79, 80]) {
    const sound = soundByKey.get(key);
    const adjusted = renderCatalogSound(sound);
    const original = renderCatalogSound({ ...sound, gainDb: 0 });
    const adjustedRms = rms(adjusted, 0, .1);
    const originalRms = rms(original, 0, .1);

    if (key === 8) {
      assert.ok(adjustedRms > originalRms * .7 && adjustedRms < originalRms * .85);
    } else if (key === 6) {
      assert.ok(adjustedRms > originalRms * 1.05 && adjustedRms < originalRms * 1.2);
    } else {
      assert.ok(adjustedRms > originalRms * 1.3, sound.name);
      assert.ok(adjustedRms > drySnareRms * .9 && adjustedRms < drySnareRms * 1.2, sound.name);
    }

    const decoded = decodeSampleWav(encodeWav(adjusted, 48000));

    // WAVにも音量補正とピーク抑制がそのまま反映されることを確認する
    for (let index = 0; index < adjusted.length; index++) {
      assert.ok(Math.abs(decoded.pcmSamples[index] - adjusted[index]) < 2 / 32768);
    }
  }
});

test('real percussion has prompt attacks, distinct short and long tails, and retains the synth choices', () => {
  const handSounds = sounds.filter((sound) => sound.category === 'hand');
  const realPercussion = handSounds.filter((sound) => sound.type === 'sample');
  assert.equal(realPercussion.length, 9);
  assert.equal(handSounds.filter((sound) => sound.type !== 'sample').length, 8);

  // 実音の主な打撃が早く鳴り、余韻の終わりが次の一打を妨げないことを確認する
  for (const sound of realPercussion) {
    const pcmSamples = renderCatalogSound(sound);
    const peakIndex = pcmSamples.reduce((peakIndex, sample, index) => Math.abs(sample) > Math.abs(pcmSamples[peakIndex]) ? index : peakIndex, 0);
    assert.ok(peakIndex / 48000 < .035, sound.name);
    assert.ok(rms(pcmSamples, sound.duration * .75, sound.duration)
      < rms(pcmSamples, 0, sound.duration * .25) * .05, sound.name);
  }

  // シェイカー・タンバリン・コンガの短い音は、長い音より余韻が明確に短いことを確認する
  for (const [shortKey, longKey] of [[92, 93], [95, 94], [100, 99]]) {
    const short = renderCatalogSound(soundByKey.get(shortKey));
    const long = renderCatalogSound(soundByKey.get(longKey));
    const shortTail = rms(short, .1, .2) / rms(short, 0, .05);
    const longTail = rms(long, .1, .2) / rms(long, 0, .05);
    assert.ok(shortTail < longTail * .5, `${shortKey} / ${longKey}`);
  }
});

test('a failed sample request reports the error and a subsequent load can recover', async () => {
  const sampleSounds = [5, 6, 7].map((key) => soundByKey.get(key));
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
