import { readFile, writeFile } from 'node:fs/promises';
import { sounds } from '../sounds.js';
import { renderSound } from '../synth.js';
import { loadSampleSources } from '../samples.js';

const sampleRate = 48000;
const sources = await loadSampleSources(sounds, async (path) => {
  const bytes = await readFile(new URL(`../${path}`, import.meta.url));

  return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
});
const lengths = {};

// 無音を含むバッファー長ではなく、音のエネルギー99%までの時間を音色ごとに保存する
for (const sound of sounds) {
  const pcm = renderSound(sound, sampleRate, sources.get(sound.sample));
  const totalEnergy = pcm.reduce((sum, sample) => sum + sample ** 2, 0);
  let cumulativeEnergy = 0;
  let end = 0;

  // 減衰や遅い立ち上がり、反響も含めて響きの長さを測定する
  for (; end < pcm.length; end++) {
    cumulativeEnergy += pcm[end] ** 2;

    if (cumulativeEnergy >= totalEnergy * .99) {
      break;
    }
  }

  lengths[sound.key] = Number(((end + 1) / sampleRate).toFixed(4));
}

await writeFile(new URL('../sound-lengths.js', import.meta.url), `// PCMのエネルギー99%までの時間（秒）。npm run sounds:measureで再生成\nexport const soundLengths = ${JSON.stringify(lengths, null, 2)};\n`);
console.log(`Measured ${sounds.length} sound lengths`);
