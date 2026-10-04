import { soundLengths } from './sound-lengths.js';

/**
 * 音色の性質と、パターンでの使い方を表すタグ
 *
 * @typedef {object} SoundTags
 * @property {string} register 主な音域（同じ楽器の高低は相対的に判断）
 * @property {string} length 響きの長さ（PCMのエネルギー99%までの時間）
 * @property {string} source 実音・電子音・両者の混合
 * @property {string} attack 打撃・ゆっくり立ち上がる音
 * @property {string} role 楽器としての役割
 * @property {string[]} uses パターンでの用途
 */

export const soundTagChoices = {
  register: { low: '低い', mid: '中間', high: '高い', broad: '広帯域' },
  length: { short: '短い', medium: '中程度', long: '長い' },
  source: { real: '実音', electronic: '電子音', hybrid: '実音＋電子音' },
  attack: { hit: '打撃', swell: 'ゆっくり立ち上がる' },
  role: { kick: 'キック', snare: 'スネア', clap: 'クラップ', hat: 'ハット', cymbal: 'シンバル', tom: 'タム', rim: 'リム', wood: '木の打楽器', bell: '金属の打楽器', shaker: 'シェイカー', tambourine: 'タンバリン', hand: 'ハンドドラム', bass: '低音', tonal: '音程のあるアクセント', fx: '効果音' },
  uses: { pulse: '刻み', backbeat: 'バックビート', fill: 'フィル', accent: 'アクセント', transition: 'つなぎ', bass: '低音の支え' },
};

const roleGroups = [
  { role: 'kick', register: 'low', uses: ['pulse', 'bass'], keys: [1, 2, 3, 4, 71, 101, 86, 87] },
  { role: 'snare', register: 'mid', uses: ['backbeat', 'fill'], keys: [5, 6, 7, 8, 79, 80, 81, 88, 89] },
  { role: 'clap', register: 'mid', uses: ['backbeat', 'accent'], keys: [9, 10, 11] },
  { role: 'hat', register: 'high', uses: ['pulse'], keys: [12, 13, 14, 15] },
  { role: 'cymbal', register: 'high', uses: ['accent', 'transition'], keys: [16, 91, 19] },
  { role: 'cymbal', register: 'high', uses: ['pulse', 'accent'], keys: [17, 18] },
  { role: 'tom', register: 'mid', uses: ['fill', 'accent'], keys: [20, 21, 22, 23, 82, 83, 84, 85, 90] },
  { role: 'rim', register: 'mid', uses: ['backbeat', 'pulse'], keys: [24, 25] },
  { role: 'wood', register: 'mid', uses: ['pulse', 'accent'], keys: [26, 27, 28] },
  { role: 'bell', register: 'mid', uses: ['pulse', 'accent'], keys: [29, 30] },
  { role: 'shaker', register: 'high', uses: ['pulse'], keys: [31, 32, 92, 93] },
  { role: 'tambourine', register: 'high', uses: ['pulse', 'backbeat', 'accent'], keys: [33, 34, 94, 95] },
  { role: 'hand', register: 'mid', uses: ['pulse', 'fill'], keys: [35, 36, 37, 38, 96, 97, 98, 99, 100] },
  { role: 'bass', register: 'low', uses: ['bass', 'accent'], keys: [39, 40, 41, 42] },
  { role: 'tonal', register: 'mid', uses: ['accent'], keys: [43, 44, 45, 46] },
  { role: 'bell', register: 'high', uses: ['accent', 'fill'], keys: [47, 50] },
  { role: 'bell', register: 'mid', uses: ['accent'], keys: [48, 49] },
  { role: 'fx', register: 'high', uses: ['pulse', 'accent'], keys: [51, 52, 56] },
  { role: 'fx', register: 'high', uses: ['accent'], keys: [53, 54, 58, 59, 61] },
  { role: 'fx', register: 'broad', uses: ['accent'], keys: [55, 57] },
  { role: 'fx', register: 'low', uses: ['accent'], keys: [60, 62, 63, 66] },
  { role: 'fx', register: 'mid', uses: ['accent', 'fill'], keys: [64, 65] },
  { role: 'fx', register: 'mid', uses: ['accent'], keys: [68, 69, 70] },
  { role: 'fx', register: 'broad', uses: ['transition'], keys: [67, 72, 73, 74, 75, 76, 77, 78] },
];
const groupByKey = new Map(roleGroups.flatMap((group) => group.keys.map((key) => [key, group])));
const registerOverrides = new Map([
  [6, 'low'], [89, 'low'], [7, 'high'], [80, 'high'], [8, 'broad'],
  [20, 'high'], [22, 'low'], [23, 'low'], [82, 'high'], [84, 'low'], [85, 'low'], [90, 'low'],
  [24, 'high'], [26, 'high'], [27, 'low'], [28, 'high'], [29, 'high'], [30, 'low'],
  [35, 'high'], [36, 'low'], [37, 'high'], [38, 'low'], [96, 'high'], [97, 'low'], [98, 'high'], [99, 'low'],
  [43, 'high'], [52, 'mid'], [56, 'broad'], [68, 'high'], [70, 'high'],
  [72, 'high'], [73, 'high'], [74, 'mid'], [75, 'low'], [76, 'high'],
]);

/**
 * 固定キーの音楽的な役割とPCMの測定値から共通タグを作る
 *
 * @param {object} sound 音色定義
 * @returns {SoundTags}
 */
export function classifySound(sound) {
  const group = groupByKey.get(sound.key);

  if (!group) {
    throw new Error(`音色タグの役割が未定義: ${sound.key}`);
  }

  const seconds = soundLengths[sound.key];
  const length = seconds === undefined ? 'unmeasured' : seconds <= .25 ? 'short' : seconds <= .8 ? 'medium' : 'long';

  return {
    register: registerOverrides.get(sound.key) || group.register, length,
    source: sound.type === 'sample' ? (sound.body ? 'hybrid' : 'real') : 'electronic',
    attack: sound.reverse || sound.swell || ['reverse', 'swell'].includes(sound.type) ? 'swell' : 'hit',
    role: group.role, uses: [...group.uses],
  };
}

/**
 * 音色のタグを表示・検索用の共通の語彙へ変換する
 *
 * @param {object} sound 音色定義
 * @returns {string[]}
 */
export function soundTagLabels(sound) {

  return ['role', 'register', 'length', 'source', 'attack'].map((field) => soundTagChoices[field][sound.tags[field]])
    .concat(sound.tags.uses.map((use) => soundTagChoices.uses[use]));
}

/**
 * カテゴリー・検索と組み合わせる音色タグの絞り込み条件を判定する
 *
 * @param {object} sound 音色定義
 * @param {Record<string, string>} filters タグ名と値（allは制限なし）
 * @returns {boolean}
 */
export function matchesSoundTags(sound, filters) {

  return Object.entries(filters).every(([field, value]) => value === 'all'
    || (field === 'uses' ? sound.tags.uses.includes(value) : sound.tags[field] === value));
}
