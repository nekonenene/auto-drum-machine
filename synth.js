const TAU = Math.PI * 2;
const sin = (cycles) => Math.sin(TAU * cycles);
const metalRatios = [1, 1.342, 1.789, 2.513, 3.127, 4.073];
const cymbalRatios = [1, 1.147, 1.414, 1.731, 2.113, 2.571, 3.127, 3.793, 4.613, 5.329, 6.107, 7.139];

/** Deterministic PCM synthesis, shared by playback, waveform display and WAV export. */
export function renderSound(sound, sampleRate = 48000) {
  const samples = new Float32Array(Math.ceil(sound.duration * sampleRate));
  let seed = sound.id * 2654435761 >>> 0;
  let lowNoise = 0;
  let midNoise = 0;
  let phase = 0;
  let held = 0;
  const frequency = sound.frequency || 1000;
  const decay = sound.decay;
  const lowCoefficient = 1 - Math.exp(-TAU * 900 / sampleRate);
  const midCoefficient = 1 - Math.exp(-TAU * 4200 / sampleRate);
  const partials = (time, ratios, base, damp) => ratios.reduce((sum, ratio, index) => (
    sum + sin(base * ratio * time) * Math.exp(-time * index * damp) / (index + 1)
  ), 0);

  for (let index = 0; index < samples.length; index++) {
    const t = index / sampleRate;
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const noise = (seed >>> 0) / 2147483648 - 1;
    lowNoise += lowCoefficient * (noise - lowNoise);
    midNoise += midCoefficient * (noise - midNoise);
    const highNoise = noise - lowNoise;
    const bandNoise = midNoise - lowNoise;
    const env = Math.exp(-t / decay);
    let value = 0;

    switch (sound.type) {
      case 'kick': {
        const f = frequency + (sound.start - frequency) * Math.exp(-t / .022);
        phase += f / sampleRate;
        const body = sin(phase) + .14 * sin(phase * 2) * Math.exp(-t / .04);
        value = Math.tanh(body * (sound.drive || 1)) * env + highNoise * sound.click * Math.exp(-t / .003);
        break;
      }
      case 'snare':
        value = (sin(frequency * t) * .55 + sin(frequency * 1.57 * t) * .24) * Math.exp(-t / (decay * .7))
          + (sound.bright ? highNoise : bandNoise) * sound.noise * env * (sound.rattle ? .65 + .35 * sin(87 * t) ** 2 : 1);
        break;
      case 'clap': {
        let clapEnvelope = 0;
        for (let hit = 0; hit < 4; hit++) {
          const elapsed = t - hit * sound.spread;
          if (elapsed >= 0) clapEnvelope += Math.exp(-elapsed / (hit === 3 ? decay : .004));
        }
        value = bandNoise * clapEnvelope + (sound.metallic ? sin(1710 * t) * .09 * clapEnvelope : 0);
        break;
      }
      case 'hat':
        value = (partials(t, metalRatios, frequency, 4) * (sound.soft ? .03 : .16) + highNoise * sound.noise) * env;
        break;
      case 'cymbal':
        value = (partials(t, cymbalRatios, frequency, 1.3) * .22 + highNoise * sound.noise) * env;
        break;
      case 'tom':
        phase += frequency * (1 + .45 * Math.exp(-t / .023)) / sampleRate;
        value = (sin(phase) + .32 * sin(phase * 1.59) * Math.exp(-t / .06)) * env
          + bandNoise * .13 * Math.exp(-t / .01);
        break;
      case 'wood':
        value = (sin(frequency * t) + .45 * sin(frequency * sound.ratio * t)) * env
          + highNoise * (sound.noise || .07) * Math.exp(-t / .002);
        break;
      case 'cowbell':
        value = (Math.tanh(3 * sin(frequency * t)) + .7 * Math.tanh(3 * sin(frequency * 1.48 * t))) * env;
        break;
      case 'shaker':
        value = highNoise * (.2 + .8 * Math.abs(sin(sound.grain * t))) * env * (1 - Math.exp(-t / .004));
        break;
      case 'tambourine':
        value = (partials(t, metalRatios, frequency, 5) * .2 + highNoise * .5) * env;
        break;
      case 'hand':
        phase += frequency * (1 + .12 * Math.exp(-t / .015)) / sampleRate;
        value = (sin(phase) + .4 * sin(phase * sound.ratio) * Math.exp(-t / .045)
          + .12 * sin(phase * 3.3) * Math.exp(-t / .018)) * env + bandNoise * .14 * Math.exp(-t / .008);
        break;
      case 'bass': {
        phase += frequency * (sound.flavor === 'rubber' ? 1 + 1.2 * Math.exp(-t / .035) : 1) / sampleRate;
        const body = sin(phase);
        const harmonics = sin(phase * 2) * .45 + sin(phase * 3) * .2;
        value = (sound.flavor === 'sub' ? body : sound.flavor === 'buzz' ? Math.tanh(5 * (body + harmonics))
          : body + harmonics * Math.exp(-t / .04)) * env * (1 - Math.exp(-t / .003));
        break;
      }
      case 'mallet':
        value = (sin(frequency * t) + .34 * sin(frequency * 3.99 * t) * Math.exp(-t / .05)) * env;
        break;
      case 'pluck':
        for (let harmonic = 1; harmonic <= 8; harmonic++) {
          value += sin(frequency * harmonic * t) / harmonic * Math.exp(-t * harmonic / decay);
        }
        break;
      case 'chord':
        for (const ratio of [1, 2 ** (3 / 12), 2 ** (7 / 12), 2]) {
          value += (sin(frequency * ratio * t) + .25 * sin(frequency * ratio * 2 * t)) * env * .3;
        }
        break;
      case 'vowel': {
        const center = 420 + 700 * Math.exp(-t / .065);
        value = (sin(frequency * t) * .2 + sin(center * t) * .7 + sin(center * 1.8 * t) * .3)
          * (.65 + .35 * sin(frequency * t)) * env;
        break;
      }
      case 'metal':
        value = Math.sin(TAU * frequency * t + sound.index * Math.exp(-t / (decay * .8)) * sin(frequency * sound.ratio * t)) * env;
        break;
      case 'spring':
        phase += frequency * (1 + .35 * sin(19 * t) * Math.exp(-t / .18)) / sampleRate;
        value = (sin(phase) + .35 * sin(phase * 3.14)) * env;
        break;
      case 'chime':
        value = partials(t, [1, 1.414, 2.713, 3.927, 5.11], frequency, 1.1) * env;
        break;
      case 'click':
        value = (highNoise * .7 + sin(frequency * t) * .3) * env;
        break;
      case 'pop':
        phase += frequency * Math.exp(-t / .01) / sampleRate;
        value = sin(phase) * env;
        break;
      case 'drop':
        phase += frequency * (1 - .65 * Math.exp(-t / .022)) / sampleRate;
        value = sin(phase) * env;
        break;
      case 'grain': {
        const grain = Math.floor(t / .018);
        const localTime = t % .018;
        value = (sin((frequency + sin(grain * .712) * 850) * localTime) * .5 + bandNoise * .3)
          * Math.sin(Math.PI * localTime / .018) ** 2 * env;
        break;
      }
      case 'noise':
        if (sound.flavor === 'air') value = lowNoise * env * (1 - Math.exp(-t / .009));
        if (sound.flavor === 'crack') value = Math.tanh(highNoise * 4) * env;
        if (sound.flavor === 'sand') value = bandNoise * env * (.3 + .7 * Math.abs(sin(47 * t)));
        if (sound.flavor === 'whistle') value = (bandNoise * .45 + sin(frequency * t) * .45) * env;
        break;
      case 'sweep': {
        const f = sound.flavor === 'rise' ? sound.start + (frequency - sound.start) * (1 - Math.exp(-t / .055))
          : frequency + (sound.start - frequency) * Math.exp(-t / (sound.flavor === 'laser' ? .03 : .07));
        phase += f / sampleRate;
        value = (sound.flavor === 'laser' ? Math.tanh(2.7 * sin(phase)) : sin(phase)) * env;
        break;
      }
      case 'wobble':
        phase += frequency * (1 + .28 * sin(13 * t)) / sampleRate;
        value = Math.sin(TAU * phase + 2 * sin(phase * 2) * (.5 + .5 * sin(7 * t))) * env;
        break;
      case 'glitch':
        if (sound.flavor === 'step') {
          const step = Math.min(2, Math.floor(t / .12));
          phase += frequency * [1, 1.5, .75][step] / sampleRate;
          value = sin(phase) * Math.exp(-(t % .12) / .065) * Math.min(1, (t % .12) / .002);
        } else if (sound.flavor === 'stutter') {
          const localTime = t % .075;
          const gate = localTime < .046 ? Math.min(1, localTime / .002, (.046 - localTime) / .003) : 0;
          value = (Math.tanh(3 * sin(frequency * t)) + bandNoise * .3) * gate * Math.exp(-t / .4);
        } else if (sound.flavor === 'bit') {
          if (index % Math.max(1, Math.round(sampleRate / 3500)) === 0) {
            held = Math.round((sin(frequency * t) * .6 + noise * .4) * 7) / 7;
          }
          value = held * env;
        } else {
          value = Math.tanh(7 * (sin(frequency * t) + .4 * sin(frequency * 1.51 * t) + bandNoise * .3)) * env;
        }
        break;
      case 'reverse': {
        const rise = (t / sound.duration) ** 2.6;
        value = (bandNoise * .6 + sin(frequency * t) * .22 + sin(frequency * 2.04 * t) * .12) * rise;
        break;
      }
      case 'echo':
        for (let repeat = 0; repeat < 5; repeat++) {
          const elapsed = t - repeat * .215;
          if (elapsed >= 0) value += sin(frequency * elapsed) * Math.exp(-elapsed / decay) * .56 ** repeat;
        }
        break;
      case 'tube':
        value = (sin(frequency * t) + .45 * sin(frequency * 3 * t) * Math.exp(-t / .1)
          + .2 * sin(frequency * 5 * t) * Math.exp(-t / .055)) * env;
        break;
      case 'shimmer':
        value = (partials(t, [1, 1.5, 2.003, 3, 4.01, 6], frequency, .6) * .3 + highNoise * .12)
          * env * (.55 + .45 * Math.min(1, t / .04));
        break;
      default:
        throw new Error(`Unknown sound type: ${sound.type}`);
    }

    // Short fades prevent clicks at the beginning and end of each buffer.
    const attack = Math.min(1, t / (sound.type === 'click' ? .00012 : .0006));
    const release = Math.min(1, (samples.length - 1 - index) / (sampleRate * .012));
    samples[index] = value * attack * Math.max(0, release);
  }

  // Remove DC offset, keep individual sounds below full scale, and equalize peaks.
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  let peak = 0;
  for (let index = 0; index < samples.length; index++) {
    const boundary = Math.min(1, index / (sampleRate * .001), (samples.length - 1 - index) / (sampleRate * .012));
    samples[index] -= mean * Math.max(0, boundary);
    peak = Math.max(peak, Math.abs(samples[index]));
  }
  const scale = peak > 0 ? .78 / peak : 0;
  for (let index = 0; index < samples.length; index++) samples[index] *= scale;
  return samples;
}

export function waveformPeaks(samples, count = 72) {
  const peaks = [];
  for (let column = 0; column < count; column++) {
    const start = Math.floor(column * samples.length / count);
    const end = Math.floor((column + 1) * samples.length / count);
    let peak = 0;
    for (let index = start; index < end; index++) peak = Math.max(peak, Math.abs(samples[index]));
    peaks.push(peak);
  }
  return peaks;
}

export function encodeWav(samples, sampleRate) {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const writeText = (offset, text) => [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  writeText(0, 'RIFF');
  view.setUint32(4, bytes.byteLength - 8, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}
