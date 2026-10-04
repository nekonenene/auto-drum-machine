import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRange, filterResonanceQ, createReverbImpulse } from '../dist/effects.js';

test('filter modulation stays inside the audible range, including at a lower sample rate', () => {
  const cases = [22050, 44100, 48000].flatMap((sampleRate) => [80, 1600, 14000].flatMap((frequency) =>
    [0, 1.5, 3].map((depth) => ({ sampleRate, frequency, depth }))));

  // 深さと中心周波数の端でも、対数的な変化範囲が安全な帯域に収まる
  for (const { sampleRate, frequency, depth } of cases) {
    const { center, cents } = filterRange({ frequency, depth }, sampleRate);
    const low = center / 2 ** (cents / 1200);
    const high = center * 2 ** (cents / 1200);
    assert.ok(low >= 40 - 1e-6);
    assert.ok(high <= Math.min(18000, sampleRate * .45) + 1e-6);
    assert.ok(high >= low);
    assert.ok(Number.isFinite(center) && Number.isFinite(cents));
  }

  assert.deepEqual(filterRange({ frequency: 1600, depth: 0 }, 48000), { center: 1600, cents: 0 });
  const range = filterRange({ frequency: 1600, depth: 1.5 }, 48000);
  assert.ok(Math.abs(range.center - 1600) < 1e-9);
  assert.ok(Math.abs(range.cents - 1800) < 1e-9);
});

test('resonance has a broad musical range and handles the different Web Audio Q units', () => {
  assert.ok(Math.abs(filterResonanceQ('lowpass', 0) + 3.0103) < .0001);
  assert.ok(Math.abs(filterResonanceQ('lowpass', 100) - 26.0206) < .0001);
  assert.ok(Math.abs(filterResonanceQ('bandpass', 0) - Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(filterResonanceQ('bandpass', 100) - 20) < 1e-9);
  assert.equal(filterResonanceQ('lowpass', 0), filterResonanceQ('lowpass', -1));
  assert.equal(filterResonanceQ('lowpass', 100), filterResonanceQ('lowpass', 101));

  // 種類を変えても同じ操作量が同じ共鳴Qになり、単調に強くなる
  for (const amount of [0, 25, 50, 75, 100]) {
    const lowpass = filterResonanceQ('lowpass', amount);
    const bandpass = filterResonanceQ('bandpass', amount);
    assert.equal(lowpass, filterResonanceQ('highpass', amount));
    assert.ok(Math.abs(10 ** (lowpass / 20) - bandpass) < 1e-9);
    assert.ok(filterResonanceQ('lowpass', amount + 1) >= lowpass);
  }
});

/**
 * 実際のPCMを持つ最小のバッファ作成環境を用意する
 *
 * @param {number} sampleRate サンプルレート
 * @returns {object} バッファ生成操作
 */
function impulseContext(sampleRate) {

  return { sampleRate, createBuffer: (channels, length) => {
    const data = Array.from({ length: channels }, () => new Float32Array(length));

    return { length, numberOfChannels: channels, getChannelData: (channel) => data[channel] };
  } };
}

test('reverb spaces have repeatable, distinct stereo reflections and a fading tail', () => {
  const context = impulseContext(48000);

  // 部屋ごとの長さ、再現性、左右の差、余韻の減衰をPCMで確認する
  for (const [room, duration] of [['small', .45], ['room', 1.2], ['hall', 2.8]]) {
    const first = createReverbImpulse(context, room);
    const second = createReverbImpulse(context, room);
    assert.equal(first.length, Math.ceil(context.sampleRate * duration));
    assert.equal(first.numberOfChannels, 2);
    assert.deepEqual(first.getChannelData(0), second.getChannelData(0));
    assert.notDeepEqual(first.getChannelData(0), first.getChannelData(1));
    const samples = first.getChannelData(0);
    assert.ok(samples.every(Number.isFinite));
    assert.ok(samples.slice(0, 400).every((value) => value === 0));
    const earlyEnergy = samples.slice(1000, 4000).reduce((sum, value) => sum + value * value, 0);
    const lateEnergy = samples.slice(-3000).reduce((sum, value) => sum + value * value, 0);
    assert.ok(lateEnergy < earlyEnergy * .001);
  }
});
