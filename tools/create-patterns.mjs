import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { TICKS_PER_BEAT, grooves, finalizePattern, validatePatterns } from '../pattern-model.js';

/**
 * 拍位置と強弱から1レーンの演奏部品を作る
 *
 * @param {number} soundKey 固定音色キー
 * @param {number[]} beats 拍位置（0始まり、小数・三連符を含む）
 * @param {number | number[]} velocities 強弱
 * @param {number} [gate=0.5] 音の最大余韻（拍）
 * @returns {object[]}
 */
const lane = (soundKey, beats, velocities, gate = .5) => beats.map((beat, index) => ({
  tick: Math.round(beat * TICKS_PER_BEAT), soundKey,
  velocity: Array.isArray(velocities) ? velocities[index % velocities.length] : velocities,
  gateTicks: Math.round(gate * TICKS_PER_BEAT),
}));

/**
 * 指定した間隔で拍位置を列挙する
 *
 * @param {number} beats フレーズの拍数
 * @param {number} interval 拍の間隔
 * @returns {number[]}
 */
const grid = (beats, interval) => Array.from({ length: Math.round(beats / interval) }, (_, index) => index * interval);

const foundations = [
  { name: '余白のエイト', bars: 2, groove: 'straight', tags: ['space'], intent: 'キックを1・3拍、スネアを2・4拍に置いた基準の8ビート。裏のハットを弱くし、2小節目の最後だけ小さなキックで次の頭を呼ぶ',
    lanes: [lane(101, [0, 2, 4, 6, 7.5], [.88, .88, .88, .88, .55]), lane(79, [1, 3, 5, 7], .83), lane(12, grid(8, .5), [.45, .26], .18)] },
  { name: '深いハーフタイム', bars: 2, groove: 'straight', tags: ['half-time', 'ghost', 'two-bar'], intent: '3拍目だけの太いスネアを軸に、2小節目のキックが少し前へ出る。シェイカーの隙間にゴーストを置く',
    lanes: [lane(71, [0, 1.5, 3.25, 4, 5.75, 7.5], [.85, .63, .72]), lane(6, [2, 6], .9), lane(5, [1.75, 5.5, 6.75], .26), lane(92, [0, .5, 1, 2.5, 3, 4, 4.5, 5, 6.5, 7], [.42, .25], .25)] },
  { name: '四つ打ちの裏口', bars: 2, groove: 'straight', tags: ['syncopated'], intent: '一定の四つ打ちに、裏拍だけの短いハット。1小節目のコンガ1打に、2小節目の高低の返しが応える',
    lanes: [lane(2, grid(8, 1), .84), lane(9, [1, 3, 5, 7], .74), lane(14, grid(8, 1).map((beat) => beat + .5), .42, .3), lane(100, [3.75, 6.75], .45), lane(96, [7.25], .5)] },
  { name: '揺れる路地', bars: 2, groove: 'swing', tags: ['ghost', 'two-bar'], intent: '8分の裏を拍の2/3へ寄せたスウィング。2小節目だけキックとスネアの小さな返しを変える',
    lanes: [lane(71, [0, 1 + 2 / 3, 3, 4, 5 + 2 / 3, 6 + 2 / 3], [.8, .62, .65]), lane(5, [1, 3, 5, 7], .78), lane(25, [2 + 2 / 3, 6 + 1 / 3], .29), lane(13, grid(8, 1).flatMap((beat) => [beat, beat + 2 / 3]), [.45, .23], .2)] },
  { name: '跳ねるシャッフル', bars: 2, groove: 'shuffle', tags: ['layered'], intent: '三連の中央を休むシャッフル。2小節目のキックを少し変え、最後の三連裏に短いタムで返す',
    lanes: [lane(101, [0, 1 + 2 / 3, 2, 3 + 2 / 3, 4, 5 + 2 / 3, 6, 7 + 1 / 3], [.9, .6]), lane(80, [1, 3, 5, 7], .82), lane(17, grid(8, 1).flatMap((beat) => [beat, beat + 2 / 3]), [.4, .24], .3), lane(20, [7 + 2 / 3], .45, .3)] },
  { name: '三つの小さな波', bars: 2, groove: 'triplet', tags: ['two-bar'], intent: 'フレーズ全体を8分三連で刻む。三連の頭を軽く強め、2小節目の終わりだけ低いボンゴで応える',
    lanes: [lane(71, [0, 2, 4, 6.5], .78), lane(5, [1, 3, 5, 7], .68), lane(92, grid(8, 1 / 3), [.38, .18, .22], .16), lane(97, [6 + 2 / 3, 7 + 2 / 3], .36)] },
  { name: 'ゴーストの綾', bars: 2, groove: 'straight', tags: ['syncopated', 'ghost', 'two-bar'], intent: '16分のハットにところどころ休符を置き、キックの前後に低いゴーストを差す。2小節目で裏の位置が変わる',
    lanes: [lane(101, [0, .75, 1.5, 2, 3.25, 4, 4.5, 5.75, 6.5, 7.5], [.86, .57, .72]), lane(79, [1, 3, 5, 7], .84), lane(5, [1.75, 2.75, 5.25, 6.75], .25), lane(12, grid(8, .25).filter((beat) => ![1.25, 3.75, 4.75, 6.25].includes(beat)), [.42, .19, .3, .21], .12)] },
  { name: '切り貼りのブレイク', bars: 2, groove: 'straight', tags: ['syncopated', 'space'], intent: '1小節目はスネアを16分後ろへずらす。2小節目はハットの隙間を変え、最後のスネアを拍へ戻してループの頭を迎える。電子クリックは2打だけ',
    lanes: [lane(86, [0, 1.75, 2.5, 4, 5.5, 6.75, 7.5], [.85, .67, .8]), lane(80, [1.25, 3.25, 5.25, 7], .83), lane(12, [0, .75, 1.5, 2.25, 3, 3.75, 4, 4.5, 5.25, 6, 6.5, 7.25], [.4, .2], .18), lane(51, [.5, 6.25], .22, .12)] },
  { name: '二つのタムの鼓動', bars: 2, groove: 'straight', tags: ['layered', 'two-bar'], intent: 'ハイタムとロータムを要所で同時に鳴らす。短い皮の響きとキックで周期を作り、後半は返しを変える',
    lanes: [lane(101, [0, 2.5, 4, 6], .8), lane(20, [0, 1.5, 3, 4.5, 6.5, 7], [.6, .43, .72]), lane(22, [0, 2, 3, 4, 5.5, 7], [.64, .48, .7]), lane(25, [1, 5], .4), lane(5, [3, 7], .75), lane(92, [0, 1, 2, 4, 5, 6], .22, .2)] },
  { name: '皮の会話', bars: 2, groove: 'straight', tags: ['syncopated', 'layered'], intent: '高低ボンゴとコンガの応答が主役。2小節目は低い音が先に応え、最後は高いボンゴで次の低い頭へ返す。スネアは各小節の4拍目だけ',
    lanes: [lane(71, [0, 2.5, 4, 6.5], .65), lane(5, [3, 7], .55), lane(96, [0, .75, 1.5, 2.75, 4.75, 5.5, 6.75, 7.75], [.85, .5]), lane(97, [.5, 1.75, 3.5, 4, 5.25, 6.25], [.7, .45]), lane(99, [0, 2, 3.25, 4.5, 6, 7.25], .8), lane(100, [1, 2.25, 3.75, 5, 5.75, 7.5], [.5, .3])] },
  { name: '木のクラーベ', bars: 2, groove: 'straight', tags: ['syncopated', 'space', 'two-bar'], intent: '3つ・2つの木の打撃を2小節でつなぐ。金属を使わず、コンガと少ないキックで軽く踊る',
    lanes: [lane(28, [0, 1.5, 3, 5, 6], .84), lane(99, [.75, 2.5, 4.5, 6.75], .58), lane(71, [0, 2, 4, 7], .65), lane(25, [3, 5], .4), lane(92, [.5, 1.5, 4.5, 5.5], .25, .2)] },
  { name: '静かな金属の部屋', bars: 2, groove: 'straight', tags: ['space'], intent: '少ないライドとベルの余韻を聴く。2小節目はベルを少し前へ寄せ、最後に弱いライドで次の頭をつなぐ。キックとリムは薄くする',
    lanes: [lane(17, [0, 1.5, 3, 4, 5.5, 7.5], [.78, .5, .64, .7, .5, .42], 1.5), lane(18, [2.5, 6], [.66, .62], 1), lane(71, [0, 4], .4), lane(25, [2, 6.75], .35)] },
  { name: '宙に浮くベル', bars: 2, groove: 'straight', tags: ['two-bar'], intent: '毎拍のライドベルに、1・3拍のキックと2・4拍のリムを合わせる。FMベルは3拍目に添え、2小節目の最後だけ弱い裏拍のキックで返す',
    lanes: [lane(18, grid(8, 1), [.62, .46], .65), lane(47, [2, 6], .4, 1), lane(71, [0, 2, 4, 6, 7.5], [.65, .65, .65, .65, .42]), lane(25, [1, 3, 5, 7], .58)] },
  { name: '土のラッシュ', bars: 2, groove: 'straight', tags: ['roll', 'layered', 'two-bar'], intent: '金属を使わず、キック・スネア・タムの短い連打を積む。強いアクセントと高低タムの重なりで激しくする',
    lanes: [lane(86, grid(8, .5), [.9, .65]), lane(89, [1, 3, 5, 7], .95), lane(5, [.75, 1.25, 1.75, 2.75, 3.25, 4.75, 5.25, 5.75, 6.75, 7.25, 7.5, 7.75], [.45, .28]), lane(82, grid(8, .25).filter((beat) => beat % 2 >= 1), [.78, .5, .62, .42], .2), lane(84, grid(8, .5), [.65, .48], .3)] },
  { name: '金属のドライブ', bars: 2, groove: 'straight', tags: ['roll', 'layered'], intent: '16分の硬いハットと拍頭のベルで押す。2小節目のキックを裏へ変え、最後のベルを半拍後ろへ寄せて次の頭へ返す',
    lanes: [lane(86, [0, .5, 1, 1.75, 2, 2.5, 3, 3.5, 4, 4.75, 5, 5.5, 6, 6.75, 7, 7.75], [.85, .62]), lane(88, [1, 3, 5, 7], .9), lane(15, grid(8, .25), [.76, .43, .59, .4], .23), lane(18, [0, 1, 2, 3, 4, 5, 6, 7.5], .64, .6)] },
  { name: '歯車のシックスティーン', bars: 2, groove: 'straight', tags: ['roll', 'ghost', 'layered', 'two-bar'], intent: '細かいハットと食い込むキックに、クランクを4打だけ重ねる。電子金属の連打は避け、主な密度はドラムで作る',
    lanes: [lane(87, [0, .5, 1.5, 2, 2.75, 3.5, 4, 4.75, 5.5, 6, 6.5, 7.75], [.9, .68, .78]), lane(88, [1, 3, 5, 7], .9), lane(5, [1.75, 2.5, 5.75, 6.25], .3), lane(15, grid(8, .25), [.6, .34, .45, .28], .17), lane(48, [0, 2.5, 4.5, 7], .45, .4), lane(18, [1, 3, 5, 7], .56, .6)] },
  { name: '電子の呼吸', bars: 2, groove: 'straight', tags: ['space', 'syncopated'], intent: '短い電子キックとノイズスネアを2・4拍のビートに揃え、薄い8分ハットで拍を示す。2小節目だけキックを裏へ返す。クリックは3打、下降音は1打に留める',
    lanes: [lane(2, [0, 2, 4, 6.5, 7.5], [.72, .65, .72, .65, .48], .3), lane(8, [1, 3, 5, 7], .78, .15), lane(12, grid(8, .5), [.25, .14], .12), lane(51, [1.5, 5.5, 7.75], .23, .12), lane(59, [6.75], .25, .2)] },
  { name: 'ポップの交差点', bars: 2, groove: 'straight', tags: ['syncopated', 'ghost', 'two-bar'], intent: '四つのキックに短い電子ポップが異なる裏で絡む。2小節目のピッチ音を1打だけ置き、過密な電子連打を避ける',
    lanes: [lane(2, grid(8, 1), .52), lane(8, [1, 3, 5, 7], .8), lane(11, [1.5, 3.5, 5.25, 7.25], .27), lane(52, [.75, 2.5, 4.25, 6.75], .5), lane(51, [0, .5, 1.75, 2.75, 4.5, 5.75, 6.5, 7.5], .4), lane(65, [5.5], .35, .3), lane(92, [1.25, 3.75, 5.25, 7.75], .28, .2)] },
  { name: 'ジングルの押し引き', bars: 2, groove: 'straight', tags: ['syncopated', 'two-bar'], intent: 'シェイカーの粒を土台に、裏拍のボンゴと2・4拍のタンバリン。2小節目だけタンバリンを短く止める',
    lanes: [lane(101, [0, 2, 3.5, 4, 6.75], .75), lane(5, [1, 3, 5, 7], .6), lane(92, grid(8, .5), [.45, .26], .18), lane(94, [1, 3], .75, .65), lane(95, [5, 7], .74, .25), lane(96, [.75, 1.75, 2.75, 3.75, 4.5, 5.5, 6.5, 7.5], [.5, .35])] },
  { name: '広いポケットの返し', bars: 2, groove: 'straight', tags: ['half-time', 'layered', 'triplet-fill', 'two-bar'], intent: 'ハーフタイムを保ち、2小節目の最後だけ三連タムで返す。局所の三連符をフレーズ全体の跳ねとは区別する',
    lanes: [lane(101, [0, 1.5, 3.25, 4, 5.75, 7.5], .8), lane(6, [2, 6], .88), lane(14, [.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5], .32, .28), lane(20, [7, 7 + 1 / 3], [.55, .4]), lane(22, [7, 7 + 2 / 3], [.62, .48]), lane(18, [0, 4], .42, 1)] },
];

const introParts = [
  [[3, 3.5], [5, 5]], [[2, 2.75, 3.5], [22, 20, 79]], [[2.5, 3.25, 3.75], [100, 96, 9]],
  [[2, 2 + 2 / 3, 3, 3 + 2 / 3], [5, 22, 5, 20]], [[1 + 2 / 3, 2, 2 + 2 / 3, 3, 3 + 1 / 3, 3 + 2 / 3], [101, 79, 20, 22, 20, 79]],
  [[2, 2 + 1 / 3, 2 + 2 / 3, 3, 3 + 1 / 3, 3 + 2 / 3], [96, 97, 100, 96, 97, 5]],
  [[2.5, 2.75, 3.25, 3.5, 3.75], [5, 5, 20, 22, 79]], [[2.25, 2.75, 3.125, 3.5, 3.75], [8, 51, 8, 80, 5]],
  [[1.5, 2.5, 3, 3.5], [20, 22, 20, 22]], [[2, 2.5, 3.25, 3.5, 3.75], [99, 96, 100, 97, 5]],
  [[1, 2.5, 3.25], [27, 26, 99]], [[2, 3.5], [18, 17]], [[2, 3, 3.5], [47, 25, 18]],
  [[2, 2.125, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75], [5, 5, 79, 82, 84, 79, 82, 84, 89]],
  [[2.5, 2.75, 3, 3.25, 3.5, 3.75], [5, 5, 18, 79, 20, 22]],
  [[2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75], [5, 79, 5, 80, 20, 22, 20, 79]],
  [[2.5, 3.25, 3.75], [52, 8, 2]], [[1.5, 2.75, 3.5], [51, 8, 52]],
  [[2.25, 2.5, 3.25, 3.75], [96, 100, 97, 95]], [[2.5, 3, 3 + 1 / 3, 3 + 2 / 3], [6, 20, 22, 20]],
];

// 最終拍まで前へ押し、次の基本の頭へ渡す20種類の返し
const transitionParts = [
  { name: 'スネアで押す', length: 1, description: '最後の1拍を8分から16分のスネアへ広げる', lanes: [lane(79, [0, .5, .75], [.65, .8, .96], .25)] },
  { name: '低いタムから駆け上がる', length: 2, description: '低いタムの間を残し、高いタムとスネアで次の頭を呼ぶ', lanes: [lane(22, [0, .75], [.6, .72]), lane(20, [1.25, 1.5], [.76, .84]), lane(79, [1.75], .96, .3)] },
  { name: '裏拍のクラップ返し', length: 1.5, description: '四つ打ちを保ち、裏のクラップと短いタムを交互に返す', lanes: [lane(9, [0, .75, 1.25], [.65, .8, .94]), lane(84, [.5, 1], [.6, .82], .25)] },
  { name: '跳ねるスネアとタム', length: 2, description: 'スウィングの裏にタムを入れ、最後の三連裏を強くする', lanes: [lane(5, [0, 1], [.76, .86]), lane(22, [2 / 3, 1 + 1 / 3], [.58, .72]), lane(20, [1 + 2 / 3], .96)] },
  { name: 'シャッフルの追い打ち', length: 2, description: '三連の跳ねを保ち、後半だけ中央の打撃を足す', lanes: [lane(79, [0, 2 / 3, 1, 1 + 2 / 3], [.7, .58, .86, .96]), lane(20, [1 + 1 / 3], .74)] },
  { name: '三連の皮からスネアへ', length: 2, description: '高低コンガの応答をスネアの三連へ受け渡す', lanes: [lane(98, [0, 2 / 3], [.6, .74]), lane(99, [1 / 3], .65), lane(5, [1, 1 + 1 / 3, 1 + 2 / 3], [.7, .82, .96], .25)] },
  { name: 'ゴーストからフラムへ', length: 1.5, description: '弱い16分を強いスネアと最後のフラムへ変える', lanes: [lane(5, [0, .25, .75, 1.1875], [.25, .34, .45, .25], .15), lane(79, [.5, 1, 1.25], [.76, .85, .96], .25)] },
  { name: '空白をまたぐ二連', length: 2, description: '一度間を空け、ずれたスネアと32分の二連で前へ押す', lanes: [lane(80, [.25, 1, 1.625, 1.75], [.68, .8, .62, .96], .25), lane(22, [.75, 1.5], [.55, .78])] },
  { name: '高低タムの壁', length: 2, description: '高低タムの交互打ちから最後の同時打ちへ厚みを増す', lanes: [lane(20, [0, .75, 1.25, 1.75], [.6, .72, .8, .96]), lane(22, [.5, 1, 1.5, 1.75], [.64, .76, .84, .9]), lane(5, [1.75], .78)] },
  { name: 'ハンドドラムの呼び声', length: 1.5, description: 'コンガとボンゴの掛け合いを縮め、スネアに重ねて渡す', lanes: [lane(99, [0, .75], [.65, .8]), lane(96, [.5, 1, 1.25], [.6, .78, .94]), lane(97, [.25, 1.25], [.55, .8]), lane(5, [1.25], .86)] },
  { name: 'クラーベへの返答', length: 2, description: '木の3打にコンガで応え、最後の裏でキックを先取りする', lanes: [lane(28, [0, .75, 1.5], [.7, .78, .88]), lane(99, [.5, 1.25, 1.75], [.55, .76, .96]), lane(71, [1.75], .8)] },
  { name: 'ライドの小さな助走', length: 1.5, description: '広い金属の余韻に短いベルの返しを足す。密な連打にせず盛り上げる', lanes: [lane(17, [0, .75], [.58, .72], .8), lane(18, [1.25], .86, .65)] },
  { name: 'ベルを追うリム', length: 1, description: '最後の1拍だけリムを8分から16分で返し、最後の16分にライドベルを合わせる', lanes: [lane(47, [0], .4, 1), lane(25, [0, .5, .75], [.6, .72, .9], .25), lane(18, [.75], .86, .65)] },
  { name: '土のダブルストローク', length: 2, description: '32分のスネアと高低の電子タムを交差させ、最後に厚く重ねる', lanes: [lane(89, [0, .125, .5, .625, 1, 1.125, 1.5, 1.75], [.65, .44, .76, .5, .86, .6, .9, .98], .18), lane(82, [.25, .75, 1.25, 1.75], [.65, .72, .8, .9], .2), lane(84, [0, .5, 1, 1.75], [.65, .74, .84, .94], .25)] },
  { name: 'ベルとタムの加速', length: 1, description: '金属の刻みを保ち、スネアから高低タムの同時打ちへ渡す', lanes: [lane(88, [0, .25], [.72, .82], .2), lane(20, [.5, .75], [.8, .96]), lane(22, [.75], .88), lane(18, [.75], .7, .5)] },
  { name: '歯車のスネアラッシュ', length: 2, description: '休符を挟んだスネアが後半で32分二連へ変わる。電子金属は増やさない', lanes: [lane(88, [0, .5, 1, 1.25, 1.5, 1.625, 1.75], [.66, .74, .8, .6, .86, .65, .98], .2), lane(22, [.75, 1.75], [.65, .9])] },
  { name: '短いノイズの助走', length: 1.5, description: '短いノイズドラムを間隔を詰めて鳴らし、電子ポップは1打だけ添える', lanes: [lane(8, [0, .5, 1, 1.125, 1.25], [.5, .65, .76, .58, .96], .125), lane(52, [.75], .38, .2)] },
  { name: 'ポップからクラップへ', length: 2, description: '電子ポップの空白にクラップとタムを置き、最後の裏で揃える', lanes: [lane(52, [.25], .5, .25), lane(11, [.5, 1, 1.75], [.6, .78, .96], .25), lane(83, [1.25, 1.5], [.65, .82], .25)] },
  { name: 'ジングルの押し上げ', length: 2, description: 'タンバリンの裏拍をスネアとボンゴが追い、最後の16分を強める', lanes: [lane(94, [.5, 1.5], [.55, .7], .5), lane(96, [0, .75, 1.25], [.5, .62, .78]), lane(79, [1, 1.5, 1.75], [.72, .84, .96], .25)] },
  { name: '三連タムの大きな返し', length: 2, description: 'ハーフタイムのスネアから三連の高低タムへ広がり、最後を同時打ちにする', lanes: [lane(6, [0, .5], [.78, .85]), lane(20, [1, 1 + 1 / 3, 1 + 2 / 3], [.65, .76, .96]), lane(22, [1, 1 + 2 / 3], [.72, .9])] },
];

/**
 * 手で用意した20個の骨格と部品から、4拍子60種類を構成する
 *
 * @returns {object[]} 完成した保存データ
 */
export function buildPatterns() {
  const basics = foundations.map((foundation, index) => finalizePattern({
    id: `p4-b-${String(index + 1).padStart(3, '0')}`, name: foundation.name, meter: 4, bars: foundation.bars,
    purpose: 'basic', derivedFrom: null, fillRange: null, groove: foundation.groove, tags: [...new Set([...foundation.tags, 'two-bar'])],
    intent: foundation.intent, tagReason: `${foundation.intent}。ノリはフレーズ全体の${foundation.groove === 'straight' ? '均等な刻み' : '継続する跳ね方'}で分類`,
    events: foundation.lanes.flat(),
  }));
  const intros = [];
  const fills = [];

  // 各骨格に無音からの出だしと、次の頭へ向かう展開フィルを組み合わせる
  for (const [index, base] of basics.entries()) {
    const totalBeats = base.bars * 4;
    const totalTicks = totalBeats * TICKS_PER_BEAT;
    const introTicks = base.meter * TICKS_PER_BEAT;
    const startBeat = [1, .5, 1.5][index % 3];
    const part = introParts[index];
    const fillStart = part[0][0] * TICKS_PER_BEAT;
    const earlyTicks = new Set();
    const introEvents = base.events.filter((event) => event.tick >= startBeat * TICKS_PER_BEAT && event.tick < fillStart)
      .filter((event) => {
        if (event.tick >= introTicks / 2) {

          return true;
        }

        if (event.tick % TICKS_PER_BEAT !== 0 || earlyTicks.has(event.tick)) {

          return false;
        }

        earlyTicks.add(event.tick);

        return true;
      })
      .map((event) => ({ ...event, velocity: Number((event.velocity * (.42 + .36 * event.tick / introTicks)).toFixed(3)) }));
    part[0].forEach((beat, position) => introEvents.push(...lane(part[1][position], [beat], .45 + .40 * position / Math.max(1, part[0].length - 1), .35)));

    if ([8, 13, 14, 19].includes(index)) {
      introEvents.push(...lane(part[1].at(-1) === 22 ? 20 : 22, [part[0].at(-1)], .62, .4));
    }

    if ([7, 13, 15].includes(index)) {
      introEvents.push(...lane(5, [part[0][0] - 1 / 16], .22, .15));
    }

    intros.push(finalizePattern({ ...base, id: base.id.replace('-b-', '-i-'), name: `${base.name}への出だし`, bars: 1, purpose: 'intro', derivedFrom: base.id,
      events: introEvents, fillRange: { startTick: Math.round(startBeat * TICKS_PER_BEAT), endTick: introTicks },
      tags: [...new Set([...base.tags, 'opening', ...([5, 19].includes(index) ? ['triplet-fill'] : []), ...([7, 13, 15].includes(index) ? ['flam'] : [])])],
      intent: `最初の${startBeat}拍を無音にし、弱い部品から入り、最後の返しで「${base.name}」の1拍目へつなぐ`,
      tagReason: `全体の基調は${grooves[base.groove]}を継承。無音の後に音数とアクセントを増やす出だし${[5, 19].includes(index) ? '。最後の部分だけ三連符を使う' : ''}` }));

    const transition = transitionParts[index];
    const transitionStart = Math.round((totalBeats - transition.length) * TICKS_PER_BEAT);
    const pulseKeys = [1, 2, 3, 4, 71, 101, 86, 87, 12, 13, 14, 15, 92];
    const fillEvents = new Map(base.events.filter((event) => event.tick < transitionStart || pulseKeys.includes(event.soundKey))
      .map((event) => [`${event.tick}/${event.soundKey}`, { ...event }]));

    // フィル中もキックと刻みを保ち、同じ音色・同じ位置は部品のアクセントで置き換える
    for (const event of transition.lanes.flat()) {
      const shifted = { ...event, tick: event.tick + transitionStart };
      fillEvents.set(`${shifted.tick}/${shifted.soundKey}`, shifted);
    }

    fills.push(finalizePattern({ ...base, id: base.id.replace('-b-', '-o-'), name: transition.name, purpose: 'fill', derivedFrom: base.id,
      events: [...fillEvents.values()], fillRange: { startTick: transitionStart, endTick: totalTicks },
      tags: [...new Set([...base.tags, 'build-up', ...([19].includes(index) ? ['triplet-fill'] : []), ...(index === 6 ? ['flam'] : [])])],
      intent: `「${base.name}」の前半と拍の足場を保つ。${transition.description}。最終拍の返しから次の1拍目へつなぐ`,
      tagReason: `全体の基調は${grooves[base.groove]}を継承。${transition.description}。最終拍のアクセントを次の頭へ渡す${index === 19 ? '。終盤だけの三連符は全体の跳ねと区別する' : ''}` }));
  }

  const patterns = [...basics, ...intros, ...fills];
  validatePatterns(patterns);

  return patterns;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const patterns = buildPatterns();
  await writeFile(new URL('../patterns-data.js', import.meta.url), `// 保存済みの演奏データ。tools/create-patterns.mjsで共通基準から再生成\nexport const patterns = ${JSON.stringify(patterns, null, 2)};\n`);
  console.log(`Saved ${patterns.length} patterns (4/4: basic 20, intro 20, fill 20)`);
  console.log('Score distribution', patterns.reduce((counts, pattern) => ({ ...counts, [`${pattern.intensity}/${pattern.metallic}`]: (counts[`${pattern.intensity}/${pattern.metallic}`] || 0) + 1 }), {}));
}
