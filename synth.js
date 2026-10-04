const TAU = Math.PI * 2;

/**
 * 周期数から正弦波の振幅を求める
 *
 * @param {number} cycles 位相を周期数で表した値
 * @returns {number}
 */
const sin = (cycles) => Math.sin(TAU * cycles);

const metalRatios = [1, 1.342, 1.789, 2.513, 3.127, 4.073];
const cymbalRatios = [1, 1.147, 1.414, 1.731, 2.113, 2.571, 3.127, 3.793, 4.613, 5.329, 6.107, 7.139];

/**
 * PCMのピークを時間応答付きで圧縮し、軽い歪みで打撃の密度を上げる
 *
 * @param {Float32Array} pcmSamples その場で加工するPCM
 * @param {number} sampleRate サンプルレート（Hz）
 * @param {import("./sounds.js").DrumCompression} settings 圧縮の設定
 * @returns {void}
 */
function applyDrumCompression(pcmSamples, sampleRate, settings) {
  const attackCoefficient = Math.exp(-1 / (sampleRate * settings.attack));
  const releaseCoefficient = Math.exp(-1 / (sampleRate * settings.release));
  const threshold = 10 ** (settings.thresholdDb / 20);
  const makeupGain = 1 / threshold ** (1 - 1 / settings.ratio);
  let envelope = 0;

  // 打撃の包絡線を追い、閾値を超えた部分を圧縮してソフトクリップする
  for (let index = 0; index < pcmSamples.length; index++) {
    const amplitude = Math.abs(pcmSamples[index]);
    const coefficient = amplitude > envelope ? attackCoefficient : releaseCoefficient;
    envelope = coefficient * envelope + (1 - coefficient) * amplitude;
    const gain = envelope > threshold ? (envelope / threshold) ** (1 / settings.ratio - 1) : 1;
    pcmSamples[index] = Math.tanh(pcmSamples[index] * gain * makeupGain * settings.saturation);
  }
}

/**
 * 音色の定義と実音素材から、試聴・波形表示・WAV保存に共用するPCMを生成する
 *
 * @param {import("./sounds.js").SoundDefinition} sound 音色の定義
 * @param {number} [sampleRate=48000] サンプルレート（Hz）
 * @param {{pcmSamples: Float32Array, sampleRate: number}} [source] 同梱した実音のPCM
 * @returns {Float32Array}
 */
export function renderSound(sound, sampleRate = 48000, source) {
  if (sound.type === 'sample' && !source) {
    throw new Error(`実音素材が読み込まれていません: ${sound.name}`);
  }

  const pcmSamples = new Float32Array(Math.ceil(sound.duration * sampleRate));
  let seed = sound.key * 2654435761 >>> 0;
  let lowNoise = 0;
  let midNoise = 0;
  let phase = 0;
  let heldSample = 0;
  let sampleLowpass = 0;
  let noiseRegister = 1;
  let noiseClock = 0;
  const frequency = sound.frequency || 1000;
  const decay = sound.decay;
  const lowCoefficient = 1 - Math.exp(-TAU * 900 / sampleRate);
  const midCoefficient = 1 - Math.exp(-TAU * 4200 / sampleRate);
  const sampleLowpassCoefficient = sound.lowpass ? 1 - Math.exp(-TAU * sound.lowpass / sampleRate) : 1;

  /**
   * 減衰速度の異なる倍音を加算する
   *
   * @param {number} time 経過時間（秒）
   * @param {number[]} ratios 基音に対する周波数比
   * @param {number} baseFrequency 基音の周波数（Hz）
   * @param {number} dampingRate 倍音ごとの追加減衰率
   * @returns {number}
   */
  const sumPartials = (time, ratios, baseFrequency, dampingRate) => ratios.reduce((sum, ratio, index) => (
    sum + sin(baseFrequency * ratio * time) * Math.exp(-time * index * dampingRate) / (index + 1)
  ), 0);

  // 音色ごとの合成方式で各時刻の振幅を生成する
  for (let index = 0; index < pcmSamples.length; index++) {
    const timeSeconds = index / sampleRate;
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const noise = (seed >>> 0) / 2147483648 - 1;
    lowNoise += lowCoefficient * (noise - lowNoise);
    midNoise += midCoefficient * (noise - midNoise);
    const highNoise = noise - lowNoise;
    const bandNoise = midNoise - lowNoise;
    const decayEnvelope = Math.exp(-timeSeconds / decay);
    let sampleValue = 0;

    switch (sound.type) {
      case 'sample': {
        const sourceTime = sound.reverse ? sound.duration - timeSeconds : timeSeconds;
        const sourcePosition = sourceTime * source.sampleRate * (sound.playbackRate || 1);
        const sourceIndex = Math.floor(sourcePosition);
        const fraction = sourcePosition - sourceIndex;
        const firstSample = source.pcmSamples[sourceIndex] || 0;
        const secondSample = source.pcmSamples[sourceIndex + 1] || 0;
        const envelope = Math.exp(-sourceTime / decay);
        const rise = sound.reverse ? (timeSeconds / sound.duration) ** .8
          : sound.swell ? Math.min(1, timeSeconds / sound.swell) ** 2 : 1;
        const interpolatedSample = firstSample + (secondSample - firstSample) * fraction;
        sampleLowpass += sampleLowpassCoefficient * (interpolatedSample - sampleLowpass);
        sampleValue = sampleLowpass * envelope * rise;

        if (sound.body) {
          const body = sound.body;
          const bodyPhase = body.frequency * timeSeconds + (body.start - body.frequency) * .008 * (1 - Math.exp(-timeSeconds / .008));
          sampleValue += sin(bodyPhase) * Math.exp(-timeSeconds / body.decay) * body.level;
        }

        break;
      }

      case 'swell': {
        const envelope = Math.sin(Math.PI * timeSeconds / sound.duration) ** 2;
        const texture = sound.flavor === 'metal'
          ? sumPartials(timeSeconds, metalRatios, frequency, .1) * .35 + highNoise * .08
          : bandNoise * .35 + highNoise * (timeSeconds / sound.duration) * .7;
        sampleValue = texture * envelope;
        break;
      }

      case 'kick': {
        const instantaneousFrequency = frequency + (sound.start - frequency) * Math.exp(-timeSeconds / .022);
        phase += instantaneousFrequency / sampleRate;
        const body = sin(phase) + .14 * sin(phase * 2) * Math.exp(-timeSeconds / .04);
        sampleValue = Math.tanh(body * (sound.drive || 1)) * decayEnvelope + highNoise * sound.click * Math.exp(-timeSeconds / .003);
        break;
      }

      case 'chip-noise': {
        const clockPeriod = timeSeconds < .012 ? 96 : timeSeconds < .03 ? 160 : 254;
        noiseClock += 1789773 / clockPeriod / sampleRate;

        // NESの長周期ノイズを参考に、15bitレジスターをクロックごとに更新する
        while (noiseClock >= 1) {
          const feedback = (noiseRegister ^ (noiseRegister >>> 1)) & 1;
          noiseRegister = (noiseRegister >>> 1) | (feedback << 14);
          noiseClock -= 1;
        }

        const volume = Math.max(0, 15 - Math.floor(timeSeconds / sound.envelopeStep)) / 15;
        sampleValue = ((noiseRegister & 1) ? -1 : 1) * volume;
        break;
      }
      case 'snap-snare': {
        const instantaneousFrequency = frequency + (sound.start - frequency) * Math.exp(-timeSeconds / .008);
        phase += instantaneousFrequency / sampleRate;
        const body = (sin(phase) + .22 * sin(phase * 2.42)) * Math.exp(-timeSeconds / .025);
        const wires = (highNoise * .78 + bandNoise * .35)
          * (.7 * decayEnvelope + .5 * Math.exp(-timeSeconds / .006));
        sampleValue = Math.tanh((body * .48 + wires) * 1.4);
        break;
      }

      case 'clap': {
        let clapEnvelope = sound.frontLoaded ? .35 * decayEnvelope : 0;

        // 時間をずらしたノイズの包絡線を重ねてクラップを作る
        for (let hit = 0; hit < 4; hit++) {
          const elapsed = timeSeconds - hit * sound.spread;

          if (elapsed >= 0) {
            const hitLevel = sound.frontLoaded ? [1, .45, .3, .2][hit] : 1;
            const hitDecay = !sound.frontLoaded && hit === 3 ? decay : .004;
            clapEnvelope += hitLevel * Math.exp(-elapsed / hitDecay);
          }
        }

        sampleValue = bandNoise * clapEnvelope + (sound.metallic ? sin(1710 * timeSeconds) * .09 * clapEnvelope : 0);
        break;
      }

      case 'hat':
        sampleValue = (sumPartials(timeSeconds, metalRatios, frequency, 4) * (sound.soft ? .03 : .16) + highNoise * sound.noise) * decayEnvelope;
        break;
      case 'cymbal':
        sampleValue = (sumPartials(timeSeconds, cymbalRatios, frequency, 1.3) * .22 + highNoise * sound.noise) * decayEnvelope;
        break;
      case 'tom':
        phase += frequency * (1 + .45 * Math.exp(-timeSeconds / .023)) / sampleRate;
        sampleValue = (sin(phase) + .32 * sin(phase * 1.59) * Math.exp(-timeSeconds / .06)) * decayEnvelope
          + bandNoise * .13 * Math.exp(-timeSeconds / .01);
        break;
      case 'electronic-tom': {
        const instantaneousFrequency = frequency + (sound.start - frequency) * Math.exp(-timeSeconds / sound.pitchDecay);
        phase += instantaneousFrequency / sampleRate;
        const body = sin(phase) + .12 * sin(phase * 2) * Math.exp(-timeSeconds / .015);
        sampleValue = body * decayEnvelope + highNoise * .025 * Math.exp(-timeSeconds / .002);
        break;
      }

      case 'wood':
        sampleValue = (sin(frequency * timeSeconds) + .45 * sin(frequency * sound.ratio * timeSeconds)) * decayEnvelope
          + highNoise * (sound.noise || .07) * Math.exp(-timeSeconds / .002);
        break;
      case 'cowbell':
        sampleValue = (Math.tanh(3 * sin(frequency * timeSeconds)) + .7 * Math.tanh(3 * sin(frequency * 1.48 * timeSeconds))) * decayEnvelope;
        break;
      case 'shaker':
        sampleValue = highNoise * (.2 + .8 * Math.abs(sin(sound.grain * timeSeconds))) * decayEnvelope * (1 - Math.exp(-timeSeconds / .004));
        break;
      case 'tambourine':
        sampleValue = (sumPartials(timeSeconds, metalRatios, frequency, 5) * .2 + highNoise * .5) * decayEnvelope;
        break;
      case 'hand':
        phase += frequency * (1 + .12 * Math.exp(-timeSeconds / .015)) / sampleRate;
        sampleValue = (sin(phase) + .4 * sin(phase * sound.ratio) * Math.exp(-timeSeconds / .045)
          + .12 * sin(phase * 3.3) * Math.exp(-timeSeconds / .018)) * decayEnvelope + bandNoise * .14 * Math.exp(-timeSeconds / .008);
        break;
      case 'bass': {
        phase += frequency * (sound.flavor === 'rubber' ? 1 + 1.2 * Math.exp(-timeSeconds / .035) : 1) / sampleRate;
        const body = sin(phase);
        const harmonics = sin(phase * 2) * .45 + sin(phase * 3) * .2;
        sampleValue = (sound.flavor === 'sub' ? body : sound.flavor === 'buzz' ? Math.tanh(5 * (body + harmonics))
          : body + harmonics * Math.exp(-timeSeconds / .04)) * decayEnvelope * (1 - Math.exp(-timeSeconds / .003));
        break;
      }

      case 'mallet':
        sampleValue = (sin(frequency * timeSeconds) + .34 * sin(frequency * 3.99 * timeSeconds) * Math.exp(-timeSeconds / .05)) * decayEnvelope;
        break;
      case 'pluck':

        for (let harmonic = 1; harmonic <= 8; harmonic++) {
          sampleValue += sin(frequency * harmonic * timeSeconds) / harmonic * Math.exp(-timeSeconds * harmonic / decay);
        }

        break;
      case 'chord':

        for (const ratio of [1, 2 ** (3 / 12), 2 ** (7 / 12), 2]) {
          sampleValue += (sin(frequency * ratio * timeSeconds) + .25 * sin(frequency * ratio * 2 * timeSeconds)) * decayEnvelope * .3;
        }

        break;
      case 'vowel': {
        const center = 420 + 700 * Math.exp(-timeSeconds / .065);
        sampleValue = (sin(frequency * timeSeconds) * .2 + sin(center * timeSeconds) * .7 + sin(center * 1.8 * timeSeconds) * .3)
          * (.65 + .35 * sin(frequency * timeSeconds)) * decayEnvelope;
        break;
      }

      case 'metal':
        sampleValue = Math.sin(TAU * frequency * timeSeconds + sound.index * Math.exp(-timeSeconds / (decay * .8)) * sin(frequency * sound.ratio * timeSeconds)) * decayEnvelope;
        break;
      case 'spring':
        phase += frequency * (1 + .35 * sin(19 * timeSeconds) * Math.exp(-timeSeconds / .18)) / sampleRate;
        sampleValue = (sin(phase) + .35 * sin(phase * 3.14)) * decayEnvelope;
        break;
      case 'chime':
        sampleValue = sumPartials(timeSeconds, [1, 1.414, 2.713, 3.927, 5.11], frequency, 1.1) * decayEnvelope;
        break;
      case 'click':
        sampleValue = (highNoise * .7 + sin(frequency * timeSeconds) * .3) * decayEnvelope;
        break;
      case 'pop':
        phase += frequency * Math.exp(-timeSeconds / .01) / sampleRate;
        sampleValue = sin(phase) * decayEnvelope;
        break;
      case 'drop':
        phase += frequency * (1 - .65 * Math.exp(-timeSeconds / .022)) / sampleRate;
        sampleValue = sin(phase) * decayEnvelope;
        break;
      case 'grain': {
        const grain = Math.floor(timeSeconds / .018);
        const localTime = timeSeconds % .018;
        sampleValue = (sin((frequency + sin(grain * .712) * 850) * localTime) * .5 + bandNoise * .3)
          * Math.sin(Math.PI * localTime / .018) ** 2 * decayEnvelope;
        break;
      }

      case 'noise':

        if (sound.flavor === 'air') {
          sampleValue = lowNoise * decayEnvelope * (1 - Math.exp(-timeSeconds / .009));
        }

        if (sound.flavor === 'crack') {
          sampleValue = Math.tanh(highNoise * 4) * decayEnvelope;
        }

        if (sound.flavor === 'sand') {
          sampleValue = bandNoise * decayEnvelope * (.3 + .7 * Math.abs(sin(47 * timeSeconds)));
        }

        if (sound.flavor === 'whistle') {
          sampleValue = (bandNoise * .45 + sin(frequency * timeSeconds) * .45) * decayEnvelope;
        }
        break;
      case 'sweep': {
        const instantaneousFrequency = sound.flavor === 'rise' ? sound.start + (frequency - sound.start) * (1 - Math.exp(-timeSeconds / .055))
          : frequency + (sound.start - frequency) * Math.exp(-timeSeconds / (sound.flavor === 'laser' ? .03 : .07));
        phase += instantaneousFrequency / sampleRate;
        sampleValue = (sound.flavor === 'laser' ? Math.tanh(2.7 * sin(phase)) : sin(phase)) * decayEnvelope;
        break;
      }

      case 'wobble':
        phase += frequency * (1 + .28 * sin(13 * timeSeconds)) / sampleRate;
        sampleValue = Math.sin(TAU * phase + 2 * sin(phase * 2) * (.5 + .5 * sin(7 * timeSeconds))) * decayEnvelope;
        break;
      case 'glitch':

        if (sound.flavor === 'step') {
          const step = Math.min(2, Math.floor(timeSeconds / .12));
          phase += frequency * [1, 1.5, .75][step] / sampleRate;
          sampleValue = sin(phase) * Math.exp(-(timeSeconds % .12) / .065) * Math.min(1, (timeSeconds % .12) / .002);
        } else if (sound.flavor === 'stutter') {
          const localTime = timeSeconds % .075;
          const gate = localTime < .046 ? Math.min(1, localTime / .002, (.046 - localTime) / .003) : 0;
          sampleValue = (Math.tanh(3 * sin(frequency * timeSeconds)) + bandNoise * .3) * gate * Math.exp(-timeSeconds / .4);
        } else if (sound.flavor === 'bit') {
          if (index % Math.max(1, Math.round(sampleRate / 3500)) === 0) {
            heldSample = Math.round((sin(frequency * timeSeconds) * .6 + noise * .4) * 7) / 7;
          }

          sampleValue = heldSample * decayEnvelope;
        } else {
          sampleValue = Math.tanh(7 * (sin(frequency * timeSeconds) + .4 * sin(frequency * 1.51 * timeSeconds) + bandNoise * .3)) * decayEnvelope;
        }
        break;
      case 'reverse': {
        const rise = (timeSeconds / sound.duration) ** 2.6;
        sampleValue = (bandNoise * .6 + sin(frequency * timeSeconds) * .22 + sin(frequency * 2.04 * timeSeconds) * .12) * rise;
        break;
      }

      case 'echo':

        // 減衰させた打撃音を一定間隔で重ねて反響を作る
        for (let repeat = 0; repeat < 5; repeat++) {
          const elapsed = timeSeconds - repeat * .215;

          if (elapsed >= 0) {
            sampleValue += sin(frequency * elapsed) * Math.exp(-elapsed / decay) * .56 ** repeat;
          }
        }

        break;
      case 'tube':
        sampleValue = (sin(frequency * timeSeconds) + .45 * sin(frequency * 3 * timeSeconds) * Math.exp(-timeSeconds / .1)
          + .2 * sin(frequency * 5 * timeSeconds) * Math.exp(-timeSeconds / .055)) * decayEnvelope;
        break;
      case 'shimmer':
        sampleValue = (sumPartials(timeSeconds, [1, 1.5, 2.003, 3, 4.01, 6], frequency, .6) * .3 + highNoise * .12)
          * decayEnvelope * (.55 + .45 * Math.min(1, timeSeconds / .04));
        break;
      default:
        throw new Error(`Unknown sound type: ${sound.type}`);
    }

    // バッファーの始端と終端を短くフェードし、クリックノイズを抑える
    const attack = Math.min(1, timeSeconds / (sound.type === 'click' ? .00012 : .0006));
    const release = Math.min(1, (pcmSamples.length - 1 - index) / (sampleRate * .012));
    pcmSamples[index] = sampleValue * attack * Math.max(0, release);
  }

  if (sound.compression) {
    applyDrumCompression(pcmSamples, sampleRate, sound.compression);
  }

  // DCオフセットを抑え、各音のピークをフルスケール未満に揃える
  const dcOffset = pcmSamples.reduce((sum, sampleValue) => sum + sampleValue, 0) / pcmSamples.length;
  let peak = 0;

  // 境界のフェードを保ちながらDCオフセットと最大振幅を求める
  for (let index = 0; index < pcmSamples.length; index++) {
    const boundaryEnvelope = Math.min(1, index / (sampleRate * .001), (pcmSamples.length - 1 - index) / (sampleRate * .012));
    const activeEnvelope = sound.type === 'chip-noise' ? Math.max(0, 15 - Math.floor(index / sampleRate / sound.envelopeStep)) / 15 : 1;
    pcmSamples[index] -= dcOffset * Math.max(0, boundaryEnvelope) * activeEnvelope;
    peak = Math.max(peak, Math.abs(pcmSamples[index]));
  }

  const normalizationGain = peak > 0 ? .78 / peak : 0;
  const levelGain = 10 ** ((sound.gainDb || 0) / 20);

  // 音色ごとの音量を補正し、0.78を超える瞬間だけ滑らかに抑えて0.95未満に収める
  for (let index = 0; index < pcmSamples.length; index++) {
    const adjustedSample = pcmSamples[index] * normalizationGain * levelGain;
    const amplitude = Math.abs(adjustedSample);
    pcmSamples[index] = amplitude > .78
      ? Math.sign(adjustedSample) * (.78 + .17 * Math.tanh((amplitude - .78) / .17))
      : adjustedSample;
  }

  return pcmSamples;
}

/**
 * PCMを一定数の区間に分け、波形表示用のピークを取得する
 *
 * @param {Float32Array} pcmSamples PCMサンプル
 * @param {number} [columnCount=72] 表示する区間数
 * @returns {number[]}
 */
export function waveformPeaks(pcmSamples, columnCount = 72) {
  const peaks = [];

  // 波形の各表示区間から最大振幅を求める
  for (let column = 0; column < columnCount; column++) {
    const startIndex = Math.floor(column * pcmSamples.length / columnCount);
    const endIndex = Math.floor((column + 1) * pcmSamples.length / columnCount);
    let peak = 0;

    for (let index = startIndex; index < endIndex; index++) {
      peak = Math.max(peak, Math.abs(pcmSamples[index]));
    }

    peaks.push(peak);
  }

  return peaks;
}

/**
 * PCMを16bitモノラルのWAVデータに変換する
 *
 * @param {Float32Array} pcmSamples PCMサンプル
 * @param {number} sampleRate サンプルレート（Hz）
 * @returns {ArrayBuffer}
 */
export function encodeWav(pcmSamples, sampleRate) {
  const wavBytes = new ArrayBuffer(44 + pcmSamples.length * 2);
  const wavView = new DataView(wavBytes);

  /**
   * WAVヘッダーの指定位置にASCII文字列を書き込む
   *
   * @param {number} offset 書き込み位置（バイト）
   * @param {string} text ASCII文字列
   * @returns {void}
   */
  const writeText = (offset, text) => [...text].forEach((character, index) => wavView.setUint8(offset + index, character.charCodeAt(0)));

  writeText(0, 'RIFF');
  wavView.setUint32(4, wavBytes.byteLength - 8, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  wavView.setUint32(16, 16, true);
  wavView.setUint16(20, 1, true);
  wavView.setUint16(22, 1, true);
  wavView.setUint32(24, sampleRate, true);
  wavView.setUint32(28, sampleRate * 2, true);
  wavView.setUint16(32, 2, true);
  wavView.setUint16(34, 16, true);
  writeText(36, 'data');
  wavView.setUint32(40, pcmSamples.length * 2, true);

  // 各サンプルを16bit整数に変換して音声データを書き込む
  for (let index = 0; index < pcmSamples.length; index++) {
    const sample = Math.max(-1, Math.min(1, pcmSamples[index]));
    wavView.setInt16(44 + index * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }

  return wavBytes;
}
