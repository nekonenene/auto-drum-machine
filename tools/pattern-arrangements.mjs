import { TICKS_PER_BEAT, soundByKey } from '../pattern-model.js';

// 高低の応答、拍のアクセント、音程・質感、次の頭への助走を各骨格に割り当てる
const originalPalettes = [
  { phrase: 'ミッドとフロアの返しにワイドクラップとスプラッシュ', pair: [21, 23], accent: 19, color: 10, swell: 73, kick: 3 },
  { phrase: '電子タムの高低と低いサブパルス', pair: [83, 85], accent: 24, color: 39, swell: 75 },
  { phrase: '高低カウベルとクラップに和音の裏打ち', pair: [29, 30], accent: 10, color: 45, swell: 67 },
  { phrase: '高低ウッドと明るいスネアにプラックの応答', pair: [26, 27], accent: 7, color: 44, swell: 74 },
  { phrase: 'ミッドとフロアタムにタンバリンと短いチャイム', pair: [21, 23], accent: 34, color: 50, swell: 76 },
  { phrase: '高低ボンゴとコンガにマレットの三連応答', pair: [35, 36], accent: 98, color: 43, swell: 77 },
  { phrase: 'ハードリムと電子スネアに水滴とスプラッシュ', pair: [24, 81], accent: 19, color: 53, swell: 73 },
  { phrase: '電気の破裂と途切れる連打にスラムタムと粗い歪み', pair: [56, 64], accent: 90, color: 63, swell: 74 },
  { phrase: 'ミッドとフロアを足した四段タムとバブルの返し', pair: [21, 23], accent: 90, color: 60, swell: 75 },
  { phrase: '実音と電子ハンドドラムの掛け合いにボイスヒット', pair: [35, 38], accent: 37, color: 46, swell: 67 },
  { phrase: '高低ウッドと短いシェイカーにエコーの応答', pair: [26, 27], accent: 31, color: 68, swell: 74 },
  { phrase: '短いベルの高低と長いシマーの余韻', pair: [47, 50], accent: 70, color: 49, swell: 78 },
  { phrase: '高低カウベルとスプリングにシマーの広がり', pair: [29, 30], accent: 49, color: 70, swell: 78 },
  { phrase: '四段の電子タムと明るいスネアに歪んだ裏打ち', pair: [83, 85], accent: 7, color: 66, swell: 75 },
  { phrase: '高低カウベルとアタッククラッシュに金属の追い打ち', pair: [29, 30], accent: 91, color: 48, swell: 78 },
  { phrase: 'ばねと濁ったチャイムにスプラッシュと粒の散り', pair: [49, 50], accent: 19, color: 54, swell: 78 },
  { phrase: '電子スネアと深い電子タムに空気と揺れる低音', pair: [81, 85], accent: 55, color: 62, swell: 67, kick: 1 },
  { phrase: '水滴とバブルの応答にクラップとピッチの段差', pair: [53, 60], accent: 11, color: 65, swell: 77 },
  { phrase: '実音と電子の長いシェイカーにタンバリンとコンガ', pair: [32, 93], accent: 33, color: 37, swell: 76 },
  { phrase: 'ミッドとフロアタムに広いクラップと丸い低音', pair: [21, 23], accent: 10, color: 40, swell: 72 },
];

// 追加80組は4件ずつの演奏テーマを共有し、返し位置と重ね方を変える
const groupPalettes = [
  { phrase: '高低ウッドと短いシェイカーに澄んだマレット', pair: [26, 27], accent: 31, color: 43, swell: 74 },
  { phrase: '高低ボンゴとクラップに水滴の返答', pair: [35, 36], accent: 9, color: 53, swell: 67 },
  { phrase: '高低カウベルとスプラッシュにシマーの余韻', pair: [29, 30], accent: 19, color: 70, swell: 72 },
  { phrase: '短いベルとチャイムに金属の共鳴', pair: [47, 50], accent: 48, color: 69, swell: 78 },
  { phrase: 'ミッドとフロアタムにクラッシュと硬いスネア', pair: [21, 23], accent: 91, color: 7, swell: 73, kick: 3 },
  { phrase: '実音の長いシェイカーと電子タンバリンに和音', pair: [93, 34], accent: 10, color: 45, swell: 76 },
  { phrase: '高低カウベルとクラッシュに金属の衝突', pair: [29, 30], accent: 16, color: 48, swell: 72 },
  { phrase: '電子タムの高低にクラップと弾むベース', pair: [83, 85], accent: 11, color: 41, swell: 67, kick: 1 },
  { phrase: '硬いリムと電子スネアにコンガと乾いたノイズ', pair: [24, 81], accent: 100, color: 57, swell: 74 },
  { phrase: '電気の破裂と途切れる連打にタムと歪み', pair: [56, 64], accent: 90, color: 63, swell: 77, kick: 4 },
  { phrase: '低いタムの高低に太いスネアとざらつくベース', pair: [23, 85], accent: 89, color: 42, swell: 75 },
  { phrase: '高低ウッドとクラップにプラックの跳ね', pair: [26, 27], accent: 10, color: 44, swell: 74 },
  { phrase: '高低カウベルとスプラッシュに上昇するチャープ', pair: [29, 30], accent: 19, color: 61, swell: 76 },
  { phrase: '高低コンガとボンゴにボイスの三連応答', pair: [37, 38], accent: 35, color: 46, swell: 67 },
  { phrase: '短い金属ベルとチャイムに粒とホイッスル', pair: [47, 50], accent: 54, color: 58, swell: 78 },
  { phrase: '高低ボンゴとコンガに短いシェイカーとエコー', pair: [35, 36], accent: 98, color: 68, swell: 77 },
  { phrase: 'ミッドとフロアタムにスラムタムとレーザー', pair: [21, 23], accent: 90, color: 59, swell: 75 },
  { phrase: '電子タムの高低と明るいスネアに歪みの応答', pair: [83, 85], accent: 7, color: 66, swell: 74, kick: 87 },
  { phrase: '高低カウベルとクラッシュにばねの裏打ち', pair: [29, 30], accent: 91, color: 49, swell: 73 },
  { phrase: '短い金属ベルとチャイムにクラッシュとシマー', pair: [47, 50], accent: 16, color: 70, swell: 78 },
];

/**
 * 骨格の演奏テーマに対応する音色の組み合わせを取得する
 *
 * @param {number} index 基本パターンの0始まりの位置
 * @returns {object} 高低の応答・アクセント・質感・助走の音色
 */
export function arrangementPalette(index) {

  return index < 20 ? originalPalettes[index] : groupPalettes[Math.floor((index - 20) / 4)];
}

/**
 * 同音・同時刻の打撃は強い方を残して演奏を重ねる
 *
 * @param {object[]} events 元の演奏
 * @param {object[]} additions 追加する掛け合い
 * @returns {object[]} 二重予約を含まない演奏
 */
export function layerEvents(events, additions) {
  const merged = new Map(events.map((event) => [`${event.tick}/${event.soundKey}`, event]));

  // 同じ楽器の同時刻打撃を重ねず、アクセントと長い余韻を残す
  for (const event of additions) {
    const key = `${event.tick}/${event.soundKey}`;
    const previous = merged.get(key);
    merged.set(key, previous ? { ...event, velocity: Math.max(previous.velocity, event.velocity), gateTicks: Math.max(previous.gateTicks, event.gateTicks) } : event);
  }

  return [...merged.values()];
}

/**
 * 拍の足場を保ち、二つの音域の掛け合いと小節の着地を加える
 *
 * @param {object} foundation 元の骨格
 * @param {number} index 骨格の位置
 * @param {Function} lane 拍位置から演奏を作る関数
 * @returns {object} 音色の豊かな骨格
 */
export function arrangeFoundation(foundation, index, lane) {
  const palette = arrangementPalette(index);
  const variant = index % 4;
  const responses = foundation.groove === 'straight'
    ? [[1.5, 3.25, 5.5, 7.25], [.75, 2.5, 4.75, 7.5], [1.75, 3.5, 5.25, 7.75], [.5, 2.75, 4.5, 7.25]][variant]
    : [[1 + 2/3, 3 + 1/3, 5 + 2/3, 7 + 1/3], [2/3, 2 + 1/3, 4 + 2/3, 7 + 2/3], [1 + 1/3, 3 + 2/3, 5 + 1/3, 7 + 2/3], [1/3, 2 + 2/3, 4 + 1/3, 7 + 1/3]][variant];
  const colors = foundation.groove === 'straight' ? [2.5, 6.75] : [2 + 2/3, 6 + 2/3];
  const layers = [
    lane(palette.pair[0], [responses[0], responses[2]], [.57, .72], .35),
    lane(palette.pair[1], [responses[1], responses[3]], [.64, .8], .4),
    lane(palette.accent, [0, 4], [.64, .76], .8),
    lane(palette.color, colors, [.5, .65], .45),
  ];

  if (palette.kick) {
    layers.push(lane(palette.kick, [0, 4], .56, .3));
  }

  return { ...foundation, lanes: [layerEvents(foundation.lanes.flat(), layers.flat())],
    tags: [...new Set([...foundation.tags, 'layered'])], intent: `${foundation.intent}。${palette.phrase}を加え、2小節目の返答を強める` };
}

/**
 * 基本と同じ音色で、弱い入口から連打・同時打ちへ進む1小節の助走を作る
 *
 * @param {object} base 派生元の基本
 * @param {number} index 骨格の位置
 * @param {Function} lane 拍位置から演奏を作る関数
 * @returns {object[]} 基本の頭へ渡す出だし
 */
export function openingEvents(base, index, lane) {
  const palette = arrangementPalette(index);
  const startBeat = [1, .5, 1.5][index % 3];
  const kickKey = base.events.find((event) => soundByKey.get(event.soundKey).tags.role === 'kick').soundKey;
  const backbeatKey = base.events.find((event) => ['snare', 'rim', 'clap'].includes(soundByKey.get(event.soundKey).tags.role)).soundKey;
  const beats = base.groove === 'straight' ? [
    [2, 2.5, 2.75, 3, 3.25, 3.5, 3.75],
    [2, 2.125, 2.5, 2.75, 3, 3.5, 3.625, 3.75],
    [2, 2 + 1/3, 2 + 2/3, 3, 3.25, 3.5, 3.75],
    [2.25, 2.5, 2.75, 3, 3.25, 3.4375, 3.5, 3.75],
  ][index % 4] : [2, 2 + 1/3, 2 + 2/3, 3, 3 + 1/6, 3 + 1/3, 3 + 2/3];
  const finalBeat = beats.at(-1);
  const sequenceKeys = [palette.pair[1], backbeatKey, palette.pair[0], backbeatKey];
  const pickup = beats.flatMap((beat, position) => lane(sequenceKeys[position % sequenceKeys.length], [beat],
    beats[position + 1] - beat <= 1/16 ? .3 : .5 + .43 * position / (beats.length - 1), .3));
  const early = base.events.filter((event) => event.tick >= startBeat * TICKS_PER_BEAT && event.tick < 2 * TICKS_PER_BEAT
    && ['kick', 'hat', 'shaker', 'rim'].includes(soundByKey.get(event.soundKey).tags.role))
    .map((event) => ({ ...event, velocity: Number((event.velocity * .45).toFixed(3)) }));

  return layerEvents(early, [
    ...lane(kickKey, [startBeat], .38, .3), ...pickup,
    ...lane(kickKey, [3, finalBeat], [.65, .86], .3),
    ...lane(palette.pair[0], [finalBeat], .88, .3),
    ...lane(backbeatKey, [finalBeat], .96, .3),
    ...lane(palette.swell, [palette.swell === 72 ? 2 : 3], .42, palette.swell === 72 ? 2 : 1),
  ]);
}

/**
 * フィルの最後に基本と同じ高低の返答と、次の頭へ向かう助走を重ねる
 *
 * @param {object[]} events 既存のフィル
 * @param {object} base 派生元の基本
 * @param {number} index 骨格の位置
 * @param {number} startTick フィルの開始位置
 * @param {Function} lane 拍位置から演奏を作る関数
 * @returns {object[]} 前半を保持した展開フィル
 */
export function arrangeFill(events, base, index, startTick, lane) {
  const palette = arrangementPalette(index);
  const lastBeat = base.groove === 'straight' ? 7.75 : 7 + 2/3;
  const startBeat = Math.max(6, startTick / TICKS_PER_BEAT);
  const middleBeat = base.groove === 'straight' ? 7.5 : 7 + 1/3;
  const swellBeat = Math.max(startBeat, palette.swell === 72 ? 6 : 7);

  return layerEvents(events, [
    ...lane(palette.pair[1], [startBeat, middleBeat], [.65, .8], .3),
    ...lane(palette.pair[0], [lastBeat], .95, .3),
    ...lane(palette.color, [startBeat], .58, .4),
    ...lane(palette.swell, [swellBeat], .46, 8 - swellBeat),
  ]);
}
