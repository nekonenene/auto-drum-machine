import { sounds } from './sounds.js';

export const TICKS_PER_BEAT = 96;
export const CLASSIFICATION_VERSION = 1;
export const soundByKey = new Map(sounds.map((sound) => [sound.key, sound]));
export const purposes = { basic: '基本パターン', intro: '出だし', fill: '展開フィル' };
export const centers = { drums: 'ドラム', percussion: 'パーカッション', electronic: '電子音', mixed: '混合' };
export const grooves = { straight: 'ストレート', swing: 'スウィング', shuffle: 'シャッフル', triplet: '三連基調' };
export const tagLabels = {
  syncopated: 'シンコペーション', ghost: 'ゴースト', layered: '同時打ち', space: '休符を活かす',
  roll: '細かな連打', flam: 'フラム', 'triplet-fill': '部分的な三連符', 'two-bar': '2小節の展開',
  opening: '無音から入る', 'build-up': '次へ盛り上げる', 'half-time': 'ハーフタイム',
};
export const scoreCriteria = {
  intensity: ['間が広く、連打・重なりが少ない', '控えめな密度で、小さなアクセント', '安定した密度に、連打や重なりが少しある', '高い密度・強いアクセント・重なりが続く', '密な連打と厚い同時打ちが多い'],
  metallic: ['金属の存在感がほぼない', '金属は脇役で、余韻も少ない', '金属が定期的に聞こえ、他の音と拮抗', '金属の打撃・余韻が継続して目立つ', '金属の響きがフレーズの中心を占める'],
};

const metalByKey = new Map([
  [12, .55], [13, .3], [14, .7], [15, 1], [16, 1], [17, 1], [18, 1], [19, 1], [91, 1],
  [29, .95], [30, .9], [31, .12], [32, .12], [33, .9], [34, .8], [92, .12], [93, .12],
  [94, .9], [95, .8], [47, 1], [48, 1], [49, .65], [50, 1], [70, .9], [72, 1], [73, 1], [78, .9],
]);

/**
 * 音色の役割と金属感を固定キーから取得する
 *
 * @param {number} key 音色の固定キー
 * @returns {{family: string, metal: number}}
 */
export function soundProfile(key) {
  const percussionKeys = [24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 92, 93, 94, 95, 96, 97, 98, 99, 100];
  const drumKeys = [1, 2, 3, 4, 71, 101, 86, 87, 5, 6, 7, 79, 80, 88, 89, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 90, 91];

  return { family: percussionKeys.includes(key) ? 'percussion' : drumKeys.includes(key) ? 'drums' : 'electronic', metal: metalByKey.get(key) || 0 };
}

/**
 * 共通の閾値で指標を1〜5へ変換する
 *
 * @param {number} index 指標
 * @param {number[]} boundaries 4個の閾値
 * @returns {number}
 */
function level(index, boundaries) {

  return 1 + boundaries.filter((boundary) => index >= boundary).length;
}

/**
 * 小節長や全体のゲインに依存しない、独立した2つのスコアを求める
 *
 * @param {object} pattern 保存する演奏データ
 * @returns {object} スコア・指標・中心分類
 */
export function analyzePattern(pattern) {
  const beats = pattern.meter * pattern.bars;
  const maximumVelocity = Math.max(...pattern.events.map((event) => event.velocity));
  const countsByTick = new Map();
  const previousBySound = new Map();
  const familyWeights = { drums: 0, percussion: 0, electronic: 0 };
  const metalByBeat = Array.from({ length: beats }, () => 0);
  let repeated = 0;
  let accents = 0;
  let totalWeight = 0;
  let metalWeight = 0;
  let metalTail = 0;

  // 各音の強弱をフレーズ内で相対化し、密度・連打・金属の継続的な目立ち方を集計する
  for (const event of pattern.events) {
    const relativeVelocity = event.velocity / maximumVelocity;
    const weight = relativeVelocity ** 2;
    const profile = soundProfile(event.soundKey);
    countsByTick.set(event.tick, (countsByTick.get(event.tick) || 0) + 1);
    const previous = previousBySound.get(event.soundKey);
    repeated += previous !== undefined && event.tick - previous <= 24 ? 1 : 0;
    previousBySound.set(event.soundKey, event.tick);
    accents += relativeVelocity >= .85 ? 1 : 0;
    familyWeights[profile.family] += weight;
    totalWeight += weight;
    metalWeight += profile.metal * weight;
    metalByBeat[Math.floor(event.tick / TICKS_PER_BEAT)] = Math.max(metalByBeat[Math.floor(event.tick / TICKS_PER_BEAT)], profile.metal * weight);
    const duration = Math.min(soundByKey.get(event.soundKey).duration, event.gateTicks / TICKS_PER_BEAT * .5);
    metalTail += profile.metal * weight * duration;
  }

  const density = pattern.events.length / beats;
  const repeatRatio = repeated / pattern.events.length;
  const accentRatio = accents / pattern.events.length;
  const thickness = [...countsByTick.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0) / beats;
  const intensityIndex = .58 * Math.min(1, density / 8) + .18 * repeatRatio + .10 * accentRatio + .14 * Math.min(1, thickness / 3);
  const metalRatio = metalWeight / totalWeight;
  const metalPresence = metalByBeat.reduce((sum, value) => sum + value, 0) / beats;
  const metalSustain = Math.min(1, metalTail / beats / .7);
  const metallicIndex = .55 * metalRatio + .30 * metalPresence + .15 * metalSustain;
  const centerEntry = Object.entries(familyWeights).sort((first, second) => second[1] - first[1])[0];
  const center = centerEntry[1] / totalWeight >= .65 ? centerEntry[0] : 'mixed';

  return {
    intensity: level(intensityIndex, [.21, .36, .52, .68]),
    metallic: level(metallicIndex, [.10, .27, .47, .67]), center,
    metrics: { density, repeatRatio, accentRatio, thickness, metalRatio, metalPresence, metalSustain, intensityIndex, metallicIndex },
  };
}

/**
 * 演奏データへ共通の評価と必須メタデータを付ける
 *
 * @param {object} draft 演奏・音楽的な意図
 * @returns {object} 保存可能な完成パターン
 */
export function finalizePattern(draft) {
  const events = [...draft.events].sort((first, second) => first.tick - second.tick || first.soundKey - second.soundKey);
  const assessment = analyzePattern({ ...draft, events });
  const metrics = assessment.metrics;
  const hasTriplet = events.some((event) => event.tick % 24 !== 0 && event.tick % 16 === 0);
  const ticks = [...new Set(events.map((event) => event.tick))];
  const maximumVelocity = Math.max(...events.map((event) => event.velocity));
  const evidence = {
    'triplet-fill': draft.groove === 'straight' && hasTriplet,
    layered: new Set(events.map((event) => event.tick)).size < events.length,
    ghost: events.some((event) => [5, 6, 7, 8, 24, 25, 79, 80, 81, 88, 89].includes(event.soundKey) && event.velocity / maximumVelocity <= .45),
    roll: ticks.some((tick, index) => index >= 2 && tick - ticks[index - 2] <= 48),
    flam: ticks.some((tick, index) => index > 0 && tick - ticks[index - 1] <= 6),
    'two-bar': draft.bars === 2,
  };
  const tags = draft.tags.filter((tag) => evidence[tag] !== false);

  return {
    ...draft, events, tags, classificationVersion: CLASSIFICATION_VERSION,
    usedSoundKeys: [...new Set(events.map((event) => event.soundKey))].sort((first, second) => soundByKey.get(first).id - soundByKey.get(second).id), ...assessment,
    scoreReason: `激しさ${assessment.intensity}：1拍あたり${metrics.density.toFixed(1)}打、連打${Math.round(metrics.repeatRatio * 100)}%、重なり${metrics.thickness.toFixed(1)}打/拍。メタリックさ${assessment.metallic}：相対強度で金属${Math.round(metrics.metalRatio * 100)}%、金属の目立ち${Math.round(metrics.metalPresence * 100)}%、余韻指標${Math.round(metrics.metalSustain * 100)}%`,
  };
}

/**
 * 音色・全体音量・微小な強弱を無視して、リズムと大きなアクセントを比較する
 *
 * @param {object} pattern 演奏データ
 * @returns {string} 同種判定に使う正規形
 */
export function rhythmFingerprint(pattern) {
  const maximumVelocity = Math.max(...pattern.events.map((event) => event.velocity));
  const barTicks = pattern.meter * TICKS_PER_BEAT;
  const tokens = pattern.events.map((event) => [event.tick, event.velocity / maximumVelocity >= .8 ? 'A' : event.velocity / maximumVelocity >= .5 ? 'M' : 'G'])
    .sort((first, second) => first[0] - second[0] || first[1].localeCompare(second[1]));
  let length = pattern.bars * barTicks;
  let selectedTokens = tokens;

  if (pattern.bars === 2) {
    const first = tokens.filter(([tick]) => tick < barTicks);
    const second = tokens.filter(([tick]) => tick >= barTicks).map(([tick, accent]) => [tick - barTicks, accent]);

    if (JSON.stringify(first) === JSON.stringify(second)) {
      selectedTokens = first;
      length = barTicks;
    }
  }

  return JSON.stringify([pattern.meter, length, selectedTokens]);
}

/**
 * 小節位相・アクセント・発音数の共有率から似すぎた候補を探す
 *
 * @param {object} first 比較元
 * @param {object} second 比較先
 * @returns {number} 0〜1の類似度（聴感の確定判定ではない）
 */
export function rhythmSimilarity(first, second) {
  const barTicks = first.meter * TICKS_PER_BEAT;

  /**
   * 音色を除いた、小節位相ごとの発音強度を作る
   *
   * @param {object} pattern 演奏データ
   * @returns {Map<number, number>}
   */
  const summarize = (pattern) => {
    const maximumVelocity = Math.max(...pattern.events.map((event) => event.velocity));
    const values = new Map();
    pattern.events.forEach((event) => values.set(event.tick % barTicks, (values.get(event.tick % barTicks) || 0) + event.velocity / maximumVelocity / pattern.bars));

    return values;
  };

  if (first.meter !== second.meter) {

    return 0;
  }

  const firstMap = summarize(first);
  const secondMap = summarize(second);
  const positions = new Set([...firstMap.keys(), ...secondMap.keys()]);
  let shared = 0;
  let total = 0;
  positions.forEach((tick) => {
    shared += Math.min(firstMap.get(tick) || 0, secondMap.get(tick) || 0);
    total += Math.max(firstMap.get(tick) || 0, secondMap.get(tick) || 0);
  });

  return total ? shared / total : 0;
}

/**
 * ID・必須項目・発音境界・同種パターン・派生先を検証する
 *
 * @param {object[]} patterns 保存するライブラリ
 * @returns {void}
 */
export function validatePatterns(patterns) {
  const ids = new Set();
  const fingerprints = new Set();

  // 保存全件が共通分類と実在音色を使い、単なる音色差分を種類数に含めないことを確認する
  for (const pattern of patterns) {
    const totalTicks = pattern.meter * pattern.bars * TICKS_PER_BEAT;
    const fingerprint = rhythmFingerprint(pattern);

    if (ids.has(pattern.id) || fingerprints.has(fingerprint)) {
      throw new Error(`IDまたはリズムの重複: ${pattern.id}`);
    }

    if (!pattern.id || !pattern.name || ![3, 4, 5].includes(pattern.meter) || ![1, 2].includes(pattern.bars)
      || !purposes[pattern.purpose] || !grooves[pattern.groove] || !centers[pattern.center]
      || !pattern.intent || !pattern.tagReason || !pattern.scoreReason || !pattern.events.length
      || pattern.tags.some((tag) => !tagLabels[tag]) || ![1, 2, 3, 4, 5].includes(pattern.intensity)
      || ![1, 2, 3, 4, 5].includes(pattern.metallic) || pattern.classificationVersion !== CLASSIFICATION_VERSION) {
      throw new Error(`メタデータが不正: ${pattern.id}`);
    }

    if (pattern.events.some((event) => !soundByKey.has(event.soundKey) || !Number.isInteger(event.tick)
      || event.tick < 0 || event.tick >= totalTicks || !Number.isFinite(event.velocity) || event.velocity <= 0 || event.velocity > 1
      || !Number.isInteger(event.gateTicks) || event.gateTicks <= 0)) {
      throw new Error(`演奏データが不正: ${pattern.id}`);
    }

    if (new Set(pattern.events.map((event) => `${event.tick}:${event.soundKey}`)).size !== pattern.events.length) {
      throw new Error(`同じ音の同時刻二重発音: ${pattern.id}`);
    }

    if (pattern.purpose !== 'basic' && (!pattern.fillRange || pattern.fillRange.startTick < 0
      || pattern.fillRange.startTick >= pattern.fillRange.endTick || pattern.fillRange.endTick > totalTicks
      || !patterns.some((base) => base.id === pattern.derivedFrom && base.purpose === 'basic' && base.meter === pattern.meter))) {
      throw new Error(`派生元またはフィル範囲が不正: ${pattern.id}`);
    }

    if (patterns.some((other) => other !== pattern && trivialVariant(pattern, other))) {
      throw new Error(`音色・音量・微小な強弱だけの違い: ${pattern.id}`);
    }

    ids.add(pattern.id);
    fingerprints.add(fingerprint);
  }
}

/**
 * 同じ位置・発音数で、正規化した強弱差が10%以内なら別種類に数えない
 *
 * @param {object} first 比較元
 * @param {object} second 比較先
 * @returns {boolean}
 */
export function trivialVariant(first, second) {
  if (first.meter !== second.meter || first.bars !== second.bars || first.events.length !== second.events.length) {

    return false;
  }

  /**
   * 音色を無視し、同時刻の音も強弱順に並べる
   *
   * @param {object} pattern 演奏データ
   * @returns {number[][]}
   */
  const normalized = (pattern) => {
    const maximum = Math.max(...pattern.events.map((event) => event.velocity));

    return pattern.events.map((event) => [event.tick, event.velocity / maximum])
      .sort((first, second) => first[0] - second[0] || first[1] - second[1]);
  };

  const firstEvents = normalized(first);
  const secondEvents = normalized(second);

  return firstEvents.every(([tick, velocity], index) => tick === secondEvents[index][0] && Math.abs(velocity - secondEvents[index][1]) <= .1);
}

/**
 * 選択された骨格から、位置と休符を変えた再現可能な試聴用バリエーションを作る
 *
 * @param {object} base 保存済みの基本パターン
 * @param {number} serial ブラウザ内で増加する生成番号
 * @returns {object} 演奏内容を保存する生成パターン
 */
export function createVariation(base, serial) {
  const totalTicks = base.meter * base.bars * TICKS_PER_BEAT;
  const candidates = base.events.filter((event) => event.tick > 0 && ![16, 91, 72, 73].includes(event.soundKey));
  let seed = (serial * 2654435761) >>> 0;
  const events = base.events.map((event) => ({ ...event }));

  // 元のノリを土台に、2〜4打の位置・休符・大きなアクセントを変える
  for (let change = 0; change < 2 + serial % 3; change++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const target = candidates[seed % candidates.length];
    const index = base.events.indexOf(target);
    const displacement = [-48, -24, -12, 12, 24, 48][(seed >>> 8) % 6];
    const tick = Math.max(6, Math.min(totalTicks - 6, target.tick + displacement));

    if (!events.some((event, otherIndex) => otherIndex !== index && event.tick === tick && event.soundKey === target.soundKey)) {
      events[index] = { ...target, tick, velocity: seed % 3 ? .85 : .35 };
    }
  }

  return finalizePattern({ ...base, id: `auto-${base.id}-${String(serial).padStart(6, '0')}`, name: `${base.name} / 生成 ${serial}`,
    derivedFrom: base.id, events, intent: '保存済みの骨格から2〜4打の位置・休符・アクセントを変えた試聴用の案',
    tags: [...new Set([...base.tags, 'syncopated'])], tagReason: `${grooves[base.groove]}の基調を土台に、2〜4打をずらして休符と大きな強弱を変える。60種類の試作数には含めない` });
}
