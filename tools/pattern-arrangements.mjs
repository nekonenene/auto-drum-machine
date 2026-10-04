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

// 追加80組は1件ごとに主役の音色・刻み・助走を選び、4件内でも質感と展開を分ける
const groupPalettes = [
  [
    { phrase: '高低ウッドと短いシェイカーに澄んだマレット', pair: [26, 27], accent: 31, color: 43, swell: 74, motion: 'answer' },
    { phrase: '実音ボンゴとミュートコンガにボイスの応答', pair: [96, 97], accent: 100, color: 46, swell: 67, motion: 'backbeat', voices: { 92: 93 } },
    { phrase: '短い電子タムとリムに水滴の返し', pair: [82, 84], accent: 24, color: 53, swell: 75, motion: 'cascade', voices: { 92: 31 } },
    { phrase: '高低コンガとタンバリンに弾むベース', pair: [37, 38], accent: 34, color: 41, swell: 77, motion: 'burst', voices: { 92: 32 } },
  ],
  [
    { phrase: '高低ボンゴとクラップに水滴の返答', pair: [35, 36], accent: 9, color: 53, swell: 67, motion: 'answer' },
    { phrase: '高低ウッドと短いタンバリンにプラックの裏拍', pair: [26, 27], accent: 34, color: 44, swell: 74, motion: 'backbeat', voices: { 12: 31 } },
    { phrase: '電子タムとマシンクラップに弾むベースの駆け上がり', pair: [82, 84], accent: 11, color: 41, swell: 75, motion: 'cascade', voices: { 12: 56 } },
    { phrase: '高低カウベルとスプラッシュにFMベルの追い打ち', pair: [29, 30], accent: 19, color: 47, swell: 78, motion: 'burst', voices: { 12: 15 } },
  ],
  [
    { phrase: '高低カウベルとスプラッシュにシマーの余韻', pair: [29, 30], accent: 19, color: 70, swell: 72, motion: 'backbeat' },
    { phrase: '短いベルとチャイムにばねの応答', pair: [47, 50], accent: 49, color: 69, swell: 78, motion: 'answer', voices: { 17: 18 } },
    { phrase: 'ウッドの高低とライドにマレットの駆け上がり', pair: [26, 27], accent: 17, color: 43, swell: 73, motion: 'cascade', voices: { 17: 30 } },
    { phrase: '電子タムとクラッシュに金属の切れた連打', pair: [83, 85], accent: 16, color: 48, swell: 76, motion: 'burst', voices: { 17: 15 } },
  ],
  [
    { phrase: '短いベルとチャイムに金属の共鳴', pair: [47, 50], accent: 48, color: 69, swell: 78, motion: 'answer' },
    { phrase: '高低ウッドとタンバリンにプラックの裏打ち', pair: [26, 27], accent: 33, color: 44, swell: 76, motion: 'backbeat', voices: { 18: 29 } },
    { phrase: '高低の実音タムとライドに水滴の連打', pair: [21, 23], accent: 17, color: 53, swell: 72, motion: 'cascade', voices: { 18: 30 } },
    { phrase: '電気の破裂とポップにクラッシュと粒の散り', pair: [56, 52], accent: 91, color: 54, swell: 77, motion: 'burst', voices: { 18: 50 } },
  ],
  [
    { phrase: 'ミッドとフロアタムにクラッシュと硬いスネア', pair: [21, 23], accent: 91, color: 7, swell: 73, kick: 3, motion: 'cascade' },
    { phrase: 'ハードリムとウッドに広いクラップと和音', pair: [24, 26], accent: 10, color: 45, swell: 74, motion: 'backbeat', voices: { 79: 80, 13: 92 } },
    { phrase: '電子タムの高低に太いスネアと歪み', pair: [83, 85], accent: 89, color: 66, swell: 75, motion: 'burst', voices: { 79: 81, 13: 56 } },
    { phrase: '高低ボンゴにタンバリンとボイスの応答', pair: [96, 97], accent: 94, color: 46, swell: 67, motion: 'answer', voices: { 79: 5, 13: 31 } },
  ],
  [
    { phrase: '実音の長いシェイカーと電子タンバリンに和音', pair: [93, 34], accent: 10, color: 45, swell: 76, motion: 'backbeat' },
    { phrase: '高低ウッドとクラベスにプラックの応答', pair: [26, 27], accent: 28, color: 44, swell: 74, motion: 'answer', voices: { 79: 7, 92: 31 } },
    { phrase: '高低コンガとタンバリンにボイスの駆け上がり', pair: [98, 99], accent: 33, color: 46, swell: 67, motion: 'cascade', voices: { 79: 6, 92: 32 } },
    { phrase: '電子タムとクラップにピッチの細かな返し', pair: [82, 85], accent: 11, color: 65, swell: 77, motion: 'burst', voices: { 79: 81, 92: 56 } },
  ],
  [
    { phrase: '高低カウベルとクラッシュに金属の衝突', pair: [29, 30], accent: 16, color: 48, swell: 72, motion: 'burst' },
    { phrase: '四段の実音タムにスプラッシュと明るいスネア', pair: [21, 23], accent: 19, color: 7, swell: 73, motion: 'cascade', voices: { 88: 80, 15: 17 } },
    { phrase: '高低ウッドとクラップにFMベルの裏拍', pair: [26, 27], accent: 10, color: 47, swell: 74, motion: 'backbeat', voices: { 88: 79, 15: 18 } },
    { phrase: '金属チャイムとばねにシマーの応答', pair: [50, 49], accent: 70, color: 69, swell: 78, motion: 'answer', voices: { 88: 81, 15: 29 } },
  ],
  [
    { phrase: '電子タムの高低にクラップと弾むベース', pair: [83, 85], accent: 11, color: 41, swell: 67, kick: 1, motion: 'backbeat' },
    { phrase: '実音ボンゴとタンバリンに和音の応答', pair: [96, 97], accent: 94, color: 45, swell: 76, motion: 'answer', voices: { 9: 10, 14: 92 } },
    { phrase: '高低カウベルとスプラッシュにチャープの駆け上がり', pair: [29, 30], accent: 19, color: 61, swell: 78, motion: 'cascade', voices: { 9: 81, 14: 15 } },
    { phrase: '電気の破裂とポップにノイズと途切れる連打', pair: [56, 52], accent: 55, color: 64, swell: 77, motion: 'burst', voices: { 9: 8, 14: 12 } },
  ],
  [
    { phrase: '硬いリムと電子スネアにコンガと乾いたノイズ', pair: [24, 81], accent: 100, color: 57, swell: 74, motion: 'answer' },
    { phrase: '高低ウッドとクラップにマレットの裏拍', pair: [26, 27], accent: 9, color: 43, swell: 67, motion: 'backbeat', voices: { 79: 7, 92: 31 } },
    { phrase: '高低の電子タムにスラムタムと歪みの連打', pair: [83, 85], accent: 90, color: 66, swell: 75, motion: 'burst', voices: { 79: 89, 92: 56 } },
    { phrase: '実音コンガとタンバリンにボイスの駆け上がり', pair: [98, 99], accent: 95, color: 46, swell: 76, motion: 'cascade', voices: { 79: 80, 92: 32 } },
  ],
  [
    { phrase: '電気の破裂と途切れる連打にタムと歪み、最後は短いタムとハットで次の頭へ渡す', pair: [56, 64], accent: 90, color: 63, swell: 77, kick: 4, motion: 'burst', ending: { pair: [56, 90], pulse: 12 } },
    { phrase: '高低ウッドとリムにクラップとエコーの裏拍', pair: [26, 27], accent: 10, color: 68, swell: 74, motion: 'backbeat', voices: { 80: 7, 12: 31 } },
    { phrase: '高低カウベルとスプラッシュに金属の駆け上がり', pair: [29, 30], accent: 19, color: 48, swell: 78, motion: 'cascade', voices: { 80: 88, 12: 15 } },
    { phrase: '高低ボンゴとミュートコンガに空気の応答', pair: [35, 36], accent: 100, color: 55, swell: 67, motion: 'answer', voices: { 80: 5, 12: 92 } },
  ],
  [
    { phrase: '低いタムの高低に太いスネアとざらつくベース', pair: [23, 85], accent: 89, color: 42, swell: 75, motion: 'answer' },
    { phrase: '高低ウッドとリムに広いクラップと丸い低音', pair: [26, 27], accent: 10, color: 40, swell: 74, motion: 'backbeat', voices: { 6: 7, 13: 31 } },
    { phrase: '実音ボンゴとコンガにボイスの駆け上がり', pair: [96, 97], accent: 99, color: 46, swell: 67, motion: 'cascade', voices: { 6: 79, 13: 92 } },
    { phrase: '電子タムとノイズスネアに揺れる低音の連打', pair: [82, 84], accent: 8, color: 62, swell: 77, motion: 'burst', voices: { 6: 81, 13: 56 } },
  ],
  [
    { phrase: '高低ウッドとクラップにプラックの跳ね', pair: [26, 27], accent: 10, color: 44, swell: 74, motion: 'backbeat' },
    { phrase: '高低ボンゴとコンガにマレットの応答', pair: [35, 36], accent: 98, color: 43, swell: 67, motion: 'answer', voices: { 5: 7, 13: 31 } },
    { phrase: '高低カウベルとスプラッシュにベルの駆け上がり', pair: [29, 30], accent: 19, color: 47, swell: 78, motion: 'cascade', voices: { 5: 80, 13: 17 } },
    { phrase: '電子タムと短いノイズにピッチの連打', pair: [83, 85], accent: 8, color: 65, swell: 75, motion: 'burst', voices: { 5: 81, 13: 56 } },
  ],
  [
    { phrase: '高低カウベルとスプラッシュに上昇するチャープ', pair: [29, 30], accent: 19, color: 61, swell: 76, motion: 'cascade' },
    { phrase: '実音タムとクラッシュに明るいスネアの裏拍', pair: [21, 23], accent: 91, color: 7, swell: 72, motion: 'backbeat', voices: { 80: 79, 17: 18 } },
    { phrase: '高低ウッドと短いタンバリンにマレットの応答', pair: [26, 27], accent: 34, color: 43, swell: 74, motion: 'answer', voices: { 80: 5, 17: 29 } },
    { phrase: '短いチャイムと金属の衝突に粒の連打', pair: [50, 48], accent: 16, color: 54, swell: 78, motion: 'burst', voices: { 80: 81, 17: 15 } },
  ],
  [
    { phrase: '高低コンガとボンゴにボイスの三連応答', pair: [37, 38], accent: 35, color: 46, swell: 67, motion: 'answer' },
    { phrase: '高低ウッドとクラベスにマレットの裏拍', pair: [26, 27], accent: 28, color: 43, swell: 74, motion: 'backbeat', voices: { 5: 7, 92: 31 } },
    { phrase: '電子タムとクラップに水滴の三連連打', pair: [82, 85], accent: 11, color: 53, swell: 75, motion: 'burst', voices: { 5: 81, 92: 56 } },
    { phrase: '実音ボンゴとタンバリンにコンガの駆け上がり', pair: [96, 97], accent: 94, color: 98, swell: 76, motion: 'cascade', voices: { 5: 80, 92: 32 } },
  ],
  [
    { phrase: '短い金属ベルとチャイムに粒とホイッスル', pair: [47, 50], accent: 54, color: 58, swell: 78, motion: 'burst' },
    { phrase: '高低カウベルとクラッシュにばねの裏拍', pair: [29, 30], accent: 16, color: 49, swell: 72, motion: 'backbeat', voices: { 88: 79, 15: 18 } },
    { phrase: '実音タムとスプラッシュにFMベルの駆け上がり', pair: [21, 23], accent: 19, color: 47, swell: 73, motion: 'cascade', voices: { 88: 80, 15: 17, 20: 82 } },
    { phrase: 'ウッドの高低にタンバリンと金属の共鳴', pair: [26, 27], accent: 33, color: 69, swell: 76, motion: 'answer', voices: { 88: 7, 15: 29, 20: 83 } },
  ],
  [
    { phrase: '高低ボンゴとコンガに短いシェイカーとエコー', pair: [35, 36], accent: 98, color: 68, swell: 77, motion: 'backbeat' },
    { phrase: 'ウッドとクラベスにマレットの応答', pair: [26, 27], accent: 28, color: 43, swell: 74, motion: 'answer', voices: { 79: 7, 96: 35, 99: 38 } },
    { phrase: '実音タムとミュートコンガにボイスの駆け上がり', pair: [21, 23], accent: 100, color: 46, swell: 67, motion: 'cascade', voices: { 79: 80, 96: 98, 99: 97 } },
    { phrase: '電子タムとクラップに水滴の連打', pair: [82, 85], accent: 11, color: 53, swell: 75, motion: 'burst', voices: { 79: 81, 96: 83, 99: 84 } },
  ],
  [
    { phrase: 'ミッドとフロアタムにスラムタムとレーザーの駆け上がり', pair: [21, 23], accent: 90, color: 59, swell: 75, motion: 'cascade' },
    { phrase: '四段の電子タムとノイズスネアにピッチの切れた連打', pair: [83, 85], accent: 8, color: 65, swell: 77, motion: 'burst', voices: { 22: 84, 20: 82, 79: 81 } },
    { phrase: '深いフロアタムと高低ウッドにクラップの裏打ち', pair: [26, 27], accent: 10, color: 44, swell: 74, motion: 'backbeat', voices: { 22: 23, 20: 21, 79: 7 } },
    { phrase: 'スラムタムと高低コンガにボイスの応答', pair: [37, 38], accent: 100, color: 46, swell: 67, motion: 'answer', voices: { 22: 90, 20: 96, 79: 89 } },
  ],
  [
    { phrase: '電子タムの高低と明るいスネアに歪みの応答', pair: [83, 85], accent: 7, color: 66, swell: 74, kick: 87, motion: 'answer' },
    { phrase: '高低ウッドと硬いリムにクラップと空気の裏打ち', pair: [26, 27], accent: 9, color: 55, swell: 67, motion: 'backbeat', voices: { 89: 80, 84: 23 } },
    { phrase: '実音タムとスラムタムにノイズの駆け上がり', pair: [21, 23], accent: 90, color: 57, swell: 75, motion: 'cascade', voices: { 89: 79, 84: 90, 82: 20 } },
    { phrase: '高低コンガとミュート打ちにざらつくベースの連打', pair: [37, 38], accent: 100, color: 42, swell: 77, motion: 'burst', voices: { 89: 6, 84: 99, 82: 96 } },
  ],
  [
    { phrase: '高低カウベルとクラッシュにばねの裏打ち', pair: [29, 30], accent: 91, color: 49, swell: 73, motion: 'backbeat' },
    { phrase: '短いベルとチャイムにシマーの応答', pair: [47, 50], accent: 70, color: 69, swell: 78, motion: 'answer', voices: { 88: 81, 15: 18 } },
    { phrase: '実音タムとスプラッシュに金属の駆け上がり', pair: [21, 23], accent: 19, color: 48, swell: 72, motion: 'cascade', voices: { 88: 80, 15: 17, 82: 20 } },
    { phrase: 'ウッドとタンバリンに粒の切れた連打', pair: [26, 27], accent: 33, color: 54, swell: 76, motion: 'burst', voices: { 88: 7, 15: 29 } },
  ],
  [
    { phrase: 'FMベルとチャイムにクラッシュとシマーの駆け上がり', pair: [47, 50], accent: 16, color: 70, swell: 78, motion: 'cascade' },
    { phrase: '高低カウベルと金属の衝突にばねの裏打ち', pair: [29, 30], accent: 48, color: 49, swell: 72, motion: 'backbeat', voices: { 18: 29, 88: 80 } },
    { phrase: '実音タムとライドにスプラッシュと共鳴の応答', pair: [21, 23], accent: 19, color: 69, swell: 73, motion: 'answer', voices: { 18: 17, 88: 79, 82: 20 } },
    { phrase: '硬いハットと電気の破裂にクラッシュと細かな粒の連打', pair: [56, 52], accent: 91, color: 54, swell: 77, motion: 'burst', voices: { 18: 15, 88: 81, 82: 83 } },
  ],
];

/**
 * 骨格の演奏テーマに対応する音色の組み合わせを取得する
 *
 * @param {number} index 基本パターンの0始まりの位置
 * @returns {object} 高低の応答・アクセント・質感・助走の音色
 */
export function arrangementPalette(index) {

  return index < 20 ? originalPalettes[index] : groupPalettes[Math.floor((index - 20) / 4)][(index - 20) % 4];
}

/**
 * 各件の主役に合わせ、刻みとバックビート・返しの楽器を選び直す
 *
 * @param {object[]} events 骨格または返しの演奏
 * @param {object} palette 各件の音色セット
 * @returns {object[]} 拍位置と強弱を保った演奏
 */
function arrangeVoices(events, palette) {

  return layerEvents([], events.map((event) => ({ ...event, soundKey: palette.voices?.[event.soundKey] || event.soundKey })));
}

/**
 * 応答・駆け上がり・裏打ち・短い連打を、元のノリに合わせて配置する
 *
 * @param {object} palette 各件の音色と盛り上げ方
 * @param {string} groove フレーズ全体のノリ
 * @param {number[]} responses 元の高低の返答位置
 * @param {Function} lane 拍位置から演奏を作る関数
 * @returns {object[]} 二つの音域の演奏
 */
function responseEvents(palette, groove, responses, lane) {
  const swung = groove !== 'straight';

  if (palette.motion === 'backbeat') {

    return [...lane(palette.pair[0], [1, 3, 5, 7], [.55, .66, .62, .78], .3),
      ...lane(palette.pair[1], swung ? [3 + 2/3, 7 + 2/3] : [3.5, 7.5], [.67, .85], .4)];
  }

  if (palette.motion === 'cascade') {
    const beats = swung ? [6, 6 + 1/3, 6 + 2/3, 7, 7 + 1/3, 7 + 2/3] : [6, 6.25, 6.5, 7, 7.25, 7.5];

    return [...lane(palette.pair[1], [responses[1]], .58, .4),
      ...beats.flatMap((beat, position) => lane(palette.pair[position < 3 ? 1 : 0], [beat], .5 + position * .07, .3))];
  }

  if (palette.motion === 'burst') {
    const beats = swung ? [2 + 1/3, 2.5, 2 + 2/3, 6 + 1/3, 6.5, 6 + 2/3, 7 + 1/3, 7.5, 7 + 2/3]
      : [2.25, 2.375, 2.5, 6.25, 6.375, 6.5, 7.25, 7.375, 7.5];
    const closingPair = palette.ending?.pair || palette.pair;

    return [...beats.flatMap((beat, position) => lane((position >= 6 ? closingPair : palette.pair)[position % 2], [beat], [.55, .35, .82][position % 3], .2)),
      ...lane(closingPair[1], [beats.at(-1)], .8, palette.ending ? .4 : .25)];
  }

  return [...lane(palette.pair[0], [responses[0], responses[2]], [.57, .72], .35),
    ...lane(palette.pair[1], [responses[1], responses[3]], [.64, .8], .4)];
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
    responseEvents(palette, foundation.groove, responses, lane),
    lane(palette.accent, [0, 4], [.64, .76], .8),
    lane(palette.color, colors, [.5, .65], .45),
  ];

  if (palette.kick) {
    layers.push(lane(palette.kick, [0, 4], .56, .3));
  }

  if (palette.ending) {
    const finalBeat = foundation.groove === 'straight' ? 7.75 : 7 + 2/3;
    layers.push(lane(palette.ending.pair[1], [finalBeat], .62, .4), lane(palette.ending.pulse, [finalBeat], .26, .2));
  }

  const transition = foundation.transition && { ...foundation.transition,
    lanes: foundation.transition.lanes.map((events) => arrangeVoices(events, palette)) };

  return { ...foundation, transition, pulseKey: palette.voices?.[foundation.pulseKey] || foundation.pulseKey,
    lanes: [layerEvents(arrangeVoices(foundation.lanes.flat(), palette), layers.flat())],
    tags: [...new Set([...foundation.tags, 'layered', ...(['cascade', 'burst'].includes(palette.motion) ? ['roll'] : [])])],
    intent: `${foundation.intent}。${palette.phrase}を加え、2小節目の返答を強める` };
}

/**
 * 拍頭の弱いキックから、基本と同じ音色の連打・同時打ちへ進む1小節の助走を作る
 *
 * @param {object} base 派生元の基本
 * @param {number} index 骨格の位置
 * @param {Function} lane 拍位置から演奏を作る関数
 * @returns {object[]} 基本の頭へ渡す出だし
 */
export function openingEvents(base, index, lane) {
  const palette = arrangementPalette(index);
  const kickKey = base.events.find((event) => soundByKey.get(event.soundKey).tags.role === 'kick').soundKey;
  const backbeatKey = base.events.find((event) => ['snare', 'rim', 'clap'].includes(soundByKey.get(event.soundKey).tags.role)).soundKey;
  const openingShape = { answer: 0, cascade: 1, backbeat: 2, burst: 3 }[palette.motion] ?? index % 4;
  const beats = base.groove === 'straight' ? [
    [2, 2.5, 2.75, 3, 3.25, 3.5, 3.75],
    [2, 2.125, 2.5, 2.75, 3, 3.5, 3.625, 3.75],
    [2, 2 + 1/3, 2 + 2/3, 3, 3.25, 3.5, 3.75],
    [2.25, 2.5, 2.75, 3, 3.25, 3.4375, 3.5, 3.75],
  ][openingShape] : [2, 2 + 1/3, 2 + 2/3, 3, 3 + 1/6, 3 + 1/3, 3 + 2/3];
  const finalBeat = beats.at(-1);
  const sequenceKeys = [palette.pair[1], backbeatKey, palette.pair[0], backbeatKey];
  const pickup = beats.flatMap((beat, position) => lane(sequenceKeys[position % sequenceKeys.length], [beat],
    beats[position + 1] - beat <= 1/16 ? .3 : .5 + .43 * position / (beats.length - 1), .3));
  const early = base.events.filter((event) => event.tick < 2 * TICKS_PER_BEAT && event.tick % TICKS_PER_BEAT === 0
    && ['kick', 'hat', 'shaker', 'rim'].includes(soundByKey.get(event.soundKey).tags.role))
    .map((event) => ({ ...event, velocity: Number((event.velocity * .45).toFixed(3)) }));

  return layerEvents(early, [
    ...lane(kickKey, [0, 1], [.38, .3], .3), ...pickup,
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
  const responses = palette.motion === 'burst'
    ? [middleBeat, middleBeat + (base.groove === 'straight' ? .125 : 1/6), lastBeat]
    : palette.motion === 'cascade' ? [startBeat, startBeat + (middleBeat - startBeat) / 2, middleBeat]
      : [startBeat, middleBeat];

  return layerEvents(events, [
    ...lane(palette.pair[1], responses, [.65, .8, .88], .3),
    ...lane(palette.pair[0], [lastBeat], .95, .3),
    ...lane(palette.color, [startBeat], .58, .4),
    ...lane(palette.swell, [swellBeat], .46, 8 - swellBeat),
  ]);
}
