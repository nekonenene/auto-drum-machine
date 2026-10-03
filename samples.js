/**
 * 同梱した16bitモノラルWAVを、ブラウザとテストで共用するPCMに戻す
 *
 * @param {ArrayBuffer} wavBytes WAVファイルの内容
 * @returns {{pcmSamples: Float32Array, sampleRate: number}}
 */
export function decodeSampleWav(wavBytes) {
  const view = new DataView(wavBytes);
  const decoder = new TextDecoder();

  if (wavBytes.byteLength < 44
    || decoder.decode(new Uint8Array(wavBytes, 0, 4)) !== 'RIFF'
    || decoder.decode(new Uint8Array(wavBytes, 8, 4)) !== 'WAVE') {
    throw new Error('実音素材のWAV形式が不正です');
  }

  let sampleRate;
  let dataOffset;
  let dataLength;

  // 任意のメタデータを読み飛ばし、形式情報とPCMのチャンクを探す
  for (let offset = 12; offset + 8 <= wavBytes.byteLength;) {
    const chunkName = decoder.decode(new Uint8Array(wavBytes, offset, 4));
    const chunkLength = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;

    if (chunkStart + chunkLength > wavBytes.byteLength) {
      throw new Error('実音素材のWAVデータが途中で切れています');
    }

    if (chunkName === 'fmt ') {
      if (chunkLength < 16 || view.getUint16(chunkStart, true) !== 1
        || view.getUint16(chunkStart + 2, true) !== 1
        || view.getUint16(chunkStart + 12, true) !== 2
        || view.getUint16(chunkStart + 14, true) !== 16) {
        throw new Error('実音素材は16bitモノラルPCMが必要です');
      }

      sampleRate = view.getUint32(chunkStart + 4, true);
    } else if (chunkName === 'data') {
      dataOffset = chunkStart;
      dataLength = chunkLength;
    }

    offset = chunkStart + chunkLength + chunkLength % 2;
  }

  if (!sampleRate || dataOffset === undefined || !dataLength || dataLength % 2 !== 0) {
    throw new Error('実音素材のPCMデータが見つかりません');
  }

  const pcmSamples = new Float32Array(dataLength / 2);

  // 符号付き16bitの整数を正規化された振幅に変換する
  for (let index = 0; index < pcmSamples.length; index++) {
    pcmSamples[index] = view.getInt16(dataOffset + index * 2, true) / 32768;
  }

  return { pcmSamples, sampleRate };
}

/**
 * 音色が参照する実音素材を重複なく読み込み、すべて成功した場合に返す
 *
 * @param {import("./sounds.js").SoundDefinition[]} sounds 音色一覧
 * @param {typeof fetch} [fetchSample=fetch] ファイル取得処理
 * @returns {Promise<Map<string, {pcmSamples: Float32Array, sampleRate: number}>>}
 */
export async function loadSampleSources(sounds, fetchSample = fetch) {
  const samplePaths = [...new Set(sounds.filter((sound) => sound.sample).map((sound) => sound.sample))];
  const entries = await Promise.all(samplePaths.map(async (path) => {
    try {
      const response = await fetchSample(path, { signal: AbortSignal.timeout(10000) });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const source = decodeSampleWav(await response.arrayBuffer());

      return [path, source];
    } catch (error) {
      throw new Error(`実音素材を読み込めませんでした: ${path} (${error.message})`);
    }
  }));

  return new Map(entries);
}
