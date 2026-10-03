/**
 * 表示情報と合成パラメーターを持つ音色の定義
 *
 * @typedef {object} SoundDefinition
 * @property {number} id 音色番号
 * @property {string} name 日本語名
 * @property {string} english 英語名
 * @property {string} description 音の説明
 * @property {string} category カテゴリーID
 * @property {string} type 合成方式
 * @property {number} decay 減衰の時定数（秒）
 * @property {number} duration サンプルの長さ（秒）
 */

export const categories = [
  { id: 'drums', name: 'キック・スネア', english: 'KICK & SNARE', color: '#85934e' },
  { id: 'hats', name: 'クラップ・ハイハット', english: 'CLAP & HI-HAT', color: '#ba8b50' },
  { id: 'cymbals', name: 'シンバル・タム', english: 'CYMBAL & TOM', color: '#b09a58' },
  { id: 'percussion', name: '木・金属の打楽器', english: 'WOOD & METAL', color: '#b57b63' },
  { id: 'hand', name: 'シェイカー・ハンドドラム', english: 'SHAKE & HAND', color: '#77917e' },
  { id: 'tonal', name: '低音・音程のある音', english: 'BASS & TONAL', color: '#7789ad' },
  { id: 'particles', name: '金属・粒・クリック', english: 'METAL & PARTICLE', color: '#a18bac' },
  { id: 'motion', name: 'ノイズ・動く音', english: 'NOISE & MOTION', color: '#bd8e93' },
  { id: 'texture', name: '歪み・途切れ・空間', english: 'GLITCH & SPACE', color: '#7b9da3' },
];

/**
 * 表示情報と合成パラメーターをまとめた音色定義を作成する
 *
 * @param {string} name 日本語名
 * @param {string} english 英語名
 * @param {string} description 音の説明
 * @param {string} category カテゴリーID
 * @param {string} type 合成方式
 * @param {object} options 合成方式に応じたパラメーター（decay、durationを含む）
 * @returns {Omit<SoundDefinition, "id">}
 */
const createSoundDefinition = (name, english, description, category, type, options) => ({ name, english, description, category, type, ...options });

export const sounds = [
  createSoundDefinition('ディープキック', 'Deep kick', '低く丸い、余韻のある音。', 'drums', 'kick', { frequency: 46, start: 155, decay: .24, duration: 1.3, click: .12 }),
  createSoundDefinition('タイトキック', 'Tight kick', '短く締まった音。', 'drums', 'kick', { frequency: 62, start: 235, decay: .065, duration: .42, click: .2 }),
  createSoundDefinition('パンチキック', 'Punch kick', 'アタックが強い、硬い音。', 'drums', 'kick', { frequency: 55, start: 320, decay: .13, duration: .75, click: .42, drive: 1.9 }),
  createSoundDefinition('ダーティキック', 'Dirty kick', '歪んだ、ざらつく低音。', 'drums', 'kick', { frequency: 41, start: 130, decay: .21, duration: 1.2, click: .3, drive: 6 }),
  createSoundDefinition('ドライスネア', 'Dry snare', '短い「パン」。', 'drums', 'snare', { frequency: 190, decay: .075, duration: .5, noise: .6 }),
  createSoundDefinition('ファットスネア', 'Fat snare', '低めで厚い「ドパン」。', 'drums', 'snare', { frequency: 135, decay: .13, duration: .85, noise: .35 }),
  createSoundDefinition('ブライトスネア', 'Bright snare', '高く鋭い「パシッ」。', 'drums', 'snare', { frequency: 270, decay: .09, duration: .58, noise: .95, bright: true }),
  createSoundDefinition('ノイズスネア', 'Noise snare', '砂嵐のような余韻。', 'drums', 'snare', { frequency: 180, decay: .23, duration: 1.5, noise: 1.2, rattle: true }),
  createSoundDefinition('ドライクラップ', 'Dry clap', '短く乾いた手拍子。', 'hats', 'clap', { decay: .045, duration: .4, spread: .009 }),
  createSoundDefinition('ワイドクラップ', 'Wide clap', '重なりと広がりのある手拍子。', 'hats', 'clap', { decay: .15, duration: 1, spread: .023 }),
  createSoundDefinition('マシンクラップ', 'Machine clap', '細かな破裂が重なる音。', 'hats', 'clap', { decay: .065, duration: .5, spread: .015, metallic: true }),
  createSoundDefinition('タイトハット', 'Tight hat', '高く短い「チッ」。', 'hats', 'hat', { frequency: 1900, decay: .025, duration: .2, noise: .55 }),
  createSoundDefinition('ソフトハット', 'Soft hat', '柔らかな「スッ」。', 'hats', 'hat', { frequency: 2600, decay: .045, duration: .3, noise: .95, soft: true }),
  createSoundDefinition('オープンハット', 'Open hat', '長めに響く「シャー」。', 'hats', 'hat', { frequency: 1500, decay: .19, duration: 1.25, noise: .6 }),
  createSoundDefinition('メタリックハット', 'Metallic hat', '硬い金属感のある「チン」。', 'hats', 'hat', { frequency: 2300, decay: .075, duration: .5, noise: .06 }),
  createSoundDefinition('クラッシュ', 'Crash', '大きく広がる「ジャーン」。', 'cymbals', 'cymbal', { frequency: 620, decay: .48, duration: 2.8, noise: .6 }),
  createSoundDefinition('ライド', 'Ride', '細い打撃音と穏やかな余韻。', 'cymbals', 'cymbal', { frequency: 880, decay: .38, duration: 2.2, noise: .12 }),
  createSoundDefinition('ライドベル', 'Ride bell', '硬く澄んだ「キン」。', 'cymbals', 'metal', { frequency: 1450, ratio: 1.48, index: 1.8, decay: .28, duration: 1.6 }),
  createSoundDefinition('スプラッシュ', 'Splash', '短く弾ける「パシャッ」。', 'cymbals', 'cymbal', { frequency: 1250, decay: .12, duration: .8, noise: .7 }),
  createSoundDefinition('ハイタム', 'High tom', '高い「トン」。', 'cymbals', 'tom', { frequency: 205, decay: .095, duration: .6 }),
  createSoundDefinition('ミッドタム', 'Mid tom', '中くらいの「トム」。', 'cymbals', 'tom', { frequency: 145, decay: .14, duration: .85 }),
  createSoundDefinition('ロータム', 'Low tom', '低い「ドン」。', 'cymbals', 'tom', { frequency: 100, decay: .19, duration: 1.2 }),
  createSoundDefinition('フロアタム', 'Floor tom', '深く長めに響く「ドゥン」。', 'cymbals', 'tom', { frequency: 65, decay: .3, duration: 1.8 }),
  createSoundDefinition('ハードリム', 'Hard rim', '鋭く強い「カッ」。', 'percussion', 'wood', { frequency: 1800, decay: .012, duration: .16, noise: .4, ratio: 1.61 }),
  createSoundDefinition('ソフトリム', 'Soft rim', '軽く乾いた「コッ」。', 'percussion', 'wood', { frequency: 720, decay: .018, duration: .2, noise: .1, ratio: 2.3 }),
  createSoundDefinition('ハイウッドブロック', 'High woodblock', '高く空洞感のある「コク」。', 'percussion', 'wood', { frequency: 980, decay: .045, duration: .32, ratio: 2.72 }),
  createSoundDefinition('ローウッドブロック', 'Low woodblock', '低く丸い「ポク」。', 'percussion', 'wood', { frequency: 470, decay: .06, duration: .42, ratio: 2.72 }),
  createSoundDefinition('クラベス', 'Claves', '細く硬い「カチッ」。', 'percussion', 'wood', { frequency: 2450, decay: .022, duration: .22, ratio: 1.23 }),
  createSoundDefinition('ハイカウベル', 'High cowbell', '高く明るい金属音。', 'percussion', 'cowbell', { frequency: 800, decay: .065, duration: .5 }),
  createSoundDefinition('ローカウベル', 'Low cowbell', '低く厚い金属音。', 'percussion', 'cowbell', { frequency: 460, decay: .14, duration: .9 }),
  createSoundDefinition('ショートシェイカー', 'Short shaker', '短く切れる「シャッ」。', 'hand', 'shaker', { decay: .022, duration: .2, grain: 43 }),
  createSoundDefinition('ロングシェイカー', 'Long shaker', '粒が流れる「シャー」。', 'hand', 'shaker', { decay: .12, duration: .8, grain: 21 }),
  createSoundDefinition('ブライトタンバリン', 'Bright tambourine', '金属の響きが広がる「チャリン」。', 'hand', 'tambourine', { frequency: 1900, decay: .14, duration: .9 }),
  createSoundDefinition('タイトタンバリン', 'Tight tambourine', '短く締まった「チャッ」。', 'hand', 'tambourine', { frequency: 2600, decay: .025, duration: .24 }),
  createSoundDefinition('ハイボンゴ', 'High bongo', '高く張りのある「ポン」。', 'hand', 'hand', { frequency: 430, decay: .065, duration: .45, ratio: 1.55 }),
  createSoundDefinition('ローボンゴ', 'Low bongo', '低く丸い「ポコ」。', 'hand', 'hand', { frequency: 280, decay: .085, duration: .6, ratio: 1.55 }),
  createSoundDefinition('ハイコンガ', 'High conga', '明るく弾む「コン」。', 'hand', 'hand', { frequency: 240, decay: .13, duration: .85, ratio: 2.37 }),
  createSoundDefinition('ローコンガ', 'Low conga', '太く響く「クン」。', 'hand', 'hand', { frequency: 155, decay: .19, duration: 1.2, ratio: 2.37 }),
  createSoundDefinition('サブパルス', 'Sub pulse', '短く深い低音。', 'tonal', 'bass', { frequency: 39, decay: .18, duration: 1.1, flavor: 'sub' }),
  createSoundDefinition('ラウンドベース', 'Round bass', '丸く減衰する「ブーン」。', 'tonal', 'bass', { frequency: 65.4, decay: .17, duration: 1.1, flavor: 'round' }),
  createSoundDefinition('ラバーベース', 'Rubber bass', '弾力のある「ボヨン」。', 'tonal', 'bass', { frequency: 73.4, decay: .2, duration: 1.3, flavor: 'rubber' }),
  createSoundDefinition('バズベース', 'Buzz bass', 'ざらついた「ブズッ」。', 'tonal', 'bass', { frequency: 55, decay: .09, duration: .65, flavor: 'buzz' }),
  createSoundDefinition('シンセマレット', 'Synth mallet', '柔らかく澄んだ打撃音。', 'tonal', 'mallet', { frequency: 523.25, decay: .16, duration: 1.1 }),
  createSoundDefinition('シンセプラック', 'Synth pluck', '鋭く弾ける、短い弦のような音。', 'tonal', 'pluck', { frequency: 329.63, decay: .13, duration: .95 }),
  createSoundDefinition('コードスタブ', 'Chord stab', '和音が一瞬だけ鳴る。', 'tonal', 'chord', { frequency: 261.63, decay: .13, duration: .9 }),
  createSoundDefinition('ボイスヒット', 'Voice hit', '「ワ」「オ」のような母音感。', 'tonal', 'vowel', { frequency: 130.81, decay: .13, duration: .85 }),
  createSoundDefinition('FMベル', 'FM bell', '電子的な、澄んだ鐘。', 'particles', 'metal', { frequency: 740, ratio: 2, index: 2.4, decay: .35, duration: 2.2 }),
  createSoundDefinition('メタルクランク', 'Metal clank', '金属がぶつかる「ガキン」。', 'particles', 'metal', { frequency: 330, ratio: 1.414, index: 5.5, decay: .15, duration: 1.1 }),
  createSoundDefinition('スプリング', 'Spring', 'ばねのような「ビョン」。', 'particles', 'spring', { frequency: 190, decay: .22, duration: 1.5 }),
  createSoundDefinition('不協和チャイム', 'Odd chime', '濁った倍音の「キララン」。', 'particles', 'chime', { frequency: 540, decay: .31, duration: 2 }),
  createSoundDefinition('マイクロクリック', 'Micro click', '針先のように短い「チッ」。', 'particles', 'click', { frequency: 4800, decay: .002, duration: .06 }),
  createSoundDefinition('デジタルポップ', 'Digital pop', '丸く小さな「プッ」。', 'particles', 'pop', { frequency: 660, decay: .018, duration: .18 }),
  createSoundDefinition('ウォータードロップ', 'Water drop', '水滴のような「プリン」。', 'particles', 'drop', { frequency: 1150, decay: .08, duration: .65 }),
  createSoundDefinition('グレインスプレー', 'Grain spray', '細かな粒が散る「パラッ」。', 'particles', 'grain', { frequency: 1600, decay: .08, duration: .6 }),
  createSoundDefinition('エアプフ', 'Air puff', '空気が噴き出す「フッ」。', 'motion', 'noise', { decay: .045, duration: .32, flavor: 'air' }),
  createSoundDefinition('スタティッククラック', 'Static crack', '電気的な「バチッ」。', 'motion', 'noise', { decay: .012, duration: .15, flavor: 'crack' }),
  createSoundDefinition('サンドスクレイプ', 'Sand scrape', '擦れるような「ザリッ」。', 'motion', 'noise', { decay: .12, duration: .75, flavor: 'sand' }),
  createSoundDefinition('ホイッスルノイズ', 'Whistle noise', 'ノイズと笛の響きが混ざる。', 'motion', 'noise', { frequency: 1800, decay: .15, duration: 1, flavor: 'whistle' }),
  createSoundDefinition('レーザーダウン', 'Laser down', '鋭く下降する「ピュン」。', 'motion', 'sweep', { frequency: 90, start: 3400, decay: .065, duration: .55, flavor: 'laser' }),
  createSoundDefinition('バブルドロップ', 'Bubble drop', '丸く下降する「プーン」。', 'motion', 'sweep', { frequency: 80, start: 520, decay: .15, duration: .95, flavor: 'bubble' }),
  createSoundDefinition('ライジングチャープ', 'Rising chirp', '高い方へ跳ねる「ピュイッ」。', 'motion', 'sweep', { frequency: 2600, start: 260, decay: .07, duration: .4, flavor: 'rise' }),
  createSoundDefinition('ウォブルヒット', 'Wobble hit', '揺れながら収まる「ウワワッ」。', 'motion', 'wobble', { frequency: 220, decay: .16, duration: 1.1 }),
  createSoundDefinition('ビットクラッシュ', 'Bit crush', '粗いデジタルの打撃音。', 'texture', 'glitch', { frequency: 150, decay: .1, duration: .7, flavor: 'bit' }),
  createSoundDefinition('スタッターバースト', 'Stutter burst', '細かく途切れる「ダダダッ」。', 'texture', 'glitch', { frequency: 260, decay: .16, duration: .72, flavor: 'stutter' }),
  createSoundDefinition('ピッチステップ', 'Pitch step', '階段状に変わる「ピポパ」。', 'texture', 'glitch', { frequency: 440, decay: .13, duration: .48, flavor: 'step' }),
  createSoundDefinition('ディストーションスタブ', 'Distortion stab', '潰れた強い「ギャッ」。', 'texture', 'glitch', { frequency: 110, decay: .095, duration: .65, flavor: 'distortion' }),
  createSoundDefinition('リバースサック', 'Reverse suck', '吸い込むような「シュワッ」。', 'texture', 'reverse', { frequency: 390, decay: .12, duration: .5 }),
  createSoundDefinition('エコーピン', 'Echo pin', '短い音に数回の反響が続く。', 'texture', 'echo', { frequency: 1050, decay: .022, duration: 1.25 }),
  createSoundDefinition('レゾナントチューブ', 'Resonant tube', '管の中で響くような「コーン」。', 'texture', 'tube', { frequency: 310, decay: .22, duration: 1.5 }),
  createSoundDefinition('シマーヒット', 'Shimmer hit', '高い響きが薄く広がる。', 'texture', 'shimmer', { frequency: 1046.5, decay: .32, duration: 2.2 }),
].map((entry, index) => ({ id: index + 1, ...entry }));
