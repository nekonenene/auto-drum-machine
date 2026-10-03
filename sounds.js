/**
 * 表示情報と合成パラメーターを持つ音色の定義
 *
 * @typedef {object} SoundDefinition
 * @property {number} id カテゴリー順の表示番号
 * @property {number} key お気に入りと乱数に使う固定キー（並べ替えても変更しない）
 * @property {string} name 日本語名
 * @property {string} english 英語名
 * @property {string} description 音の説明
 * @property {string} category カテゴリーID
 * @property {string} type 合成またはサンプル加工の方式
 * @property {string} [sample] 同梱した実音素材のパス
 * @property {number} [playbackRate] 実音の再生速度とピッチの倍率
 * @property {boolean} [reverse] 実音を逆再生するかどうか
 * @property {number} [swell] 実音のフェードイン時間（秒）
 * @property {number} [pitchDecay] 電子タムの音程が下がる時定数（秒）
 * @property {number} [lowpass] 実音の高域を抑える周波数（Hz）
 * @property {{frequency: number, start: number, decay: number, level: number}} [body] 実音に重ねる低い胴鳴り
 * @property {number} [envelopeStep] チップノイズの音量が一段下がる間隔（秒）
 * @property {boolean} [frontLoaded] クラップの主音を先頭に置き、後続の打撃を弱めるかどうか
 * @property {DrumCompression} [compression] 音色ごとのコンプレッサー設定
 * @property {number} decay 減衰の時定数（秒）
 * @property {number} duration サンプルの長さ（秒）
 */

/**
 * 打撃のピークを抑えて音の密度を上げる設定
 *
 * @typedef {object} DrumCompression
 * @property {number} thresholdDb 圧縮を始める振幅（dBFS）
 * @property {number} ratio 圧縮比
 * @property {number} attack アタック時間（秒）
 * @property {number} release リリース時間（秒）
 * @property {number} saturation 圧縮後のソフトクリップの強さ
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
  { id: 'transition', name: 'リバース・スウェル', english: 'REVERSE & SWELL', color: '#9484a0' },
  { id: 'texture', name: '歪み・途切れ・空間', english: 'GLITCH & SPACE', color: '#7b9da3' },
];

/**
 * 表示情報と合成パラメーターをまとめた音色定義を作成する
 *
 * @param {number} key 音色の固定キー（既存音色は旧番号を引き継ぐ）
 * @param {string} name 日本語名
 * @param {string} english 英語名
 * @param {string} description 音の説明
 * @param {string} category カテゴリーID
 * @param {string} type 合成方式
 * @param {object} options 合成方式に応じたパラメーター（decay、durationを含む）
 * @returns {Omit<SoundDefinition, "id">}
 */
const createSoundDefinition = (key, name, english, description, category, type, options) => ({ key, name, english, description, category, type, ...options });

const soundDefinitions = [
  createSoundDefinition(1, 'ディープキック', 'Deep kick', '低い芯を残し、短く切れるキック', 'drums', 'kick', { frequency: 48, start: 180, decay: .065, duration: .32, click: .2, drive: 1.3 }),
  createSoundDefinition(2, 'タイトキック', 'Tight kick', '短く締まった音', 'drums', 'kick', { frequency: 62, start: 235, decay: .065, duration: .42, click: .2 }),
  createSoundDefinition(3, 'パンチキック', 'Punch kick', 'アタックが強い、硬い音', 'drums', 'kick', { frequency: 55, start: 320, decay: .13, duration: .75, click: .42, drive: 1.9 }),
  createSoundDefinition(4, 'ダーティキック', 'Dirty kick', '歪んだ、ざらつく低音', 'drums', 'kick', { frequency: 41, start: 130, decay: .21, duration: 1.2, click: .3, drive: 6 }),
  createSoundDefinition(71, 'アコースティックキック', 'Acoustic kick', '実音の打撃感と重さを残した、短いバスドラム', 'drums', 'sample', { sample: 'assets/drums/kick-acoustic.wav', decay: .09, duration: .4 }),
  createSoundDefinition(86, 'スラムキック', 'Slam kick', '強いコンプと軽い歪みで押し出す、硬い「ドッ」', 'drums', 'kick', { frequency: 52, start: 280, decay: .045, duration: .32, click: .4, drive: 1.6, compression: { thresholdDb: -24, ratio: 8, attack: .0005, release: .014, saturation: 1 } }),
  createSoundDefinition(87, 'コンプキック', 'Compressed kick', '実音の打撃と低音をコンプで密にした、重い「ドン」', 'drums', 'sample', { sample: 'assets/drums/kick-acoustic.wav', decay: .065, duration: .4, compression: { thresholdDb: -24, ratio: 8, attack: .0005, release: .018, saturation: 1 } }),
  createSoundDefinition(5, 'ドライスネア', 'Dry snare', '手でミュートした実音の、カラッと短い「パッ」', 'drums', 'sample', { sample: 'assets/drums/snare-muted.wav', decay: .065, duration: .25 }),
  createSoundDefinition(6, 'ファットスネア', 'Fat snare', '低くした実音に太い胴鳴りを重ねた、短い「ドパン」', 'drums', 'sample', { sample: 'assets/drums/snare-center.wav', playbackRate: .7, lowpass: 2800, body: { frequency: 145, start: 220, decay: .05, level: .65 }, decay: .085, duration: .38 }),
  createSoundDefinition(7, 'ブライトスネア', 'Bright snare', '実音のリムショットによる、硬く鋭い「パシッ」', 'drums', 'sample', { sample: 'assets/drums/snare-rimshot.wav', playbackRate: 1.08, decay: .07, duration: .28 }),
  createSoundDefinition(8, 'チップノイズスネア', 'Chip noise snare', 'ファミコン風の粗いノイズが短く切れる「ザッ」', 'drums', 'chip-noise', { envelopeStep: .005, decay: .02, duration: .12 }),
  createSoundDefinition(79, 'ドライロックスネア', 'Dry rock snare', '強打の実音に明るいスナッピーを重ねた、乾いた「パン」', 'drums', 'sample', { sample: 'assets/rusty-drums/snare-rock.wav', decay: .075, duration: .32 }),
  createSoundDefinition(80, 'クラックスネア', 'Crack snare', '強い実音リムショットを短く切った、硬い「カッ」', 'drums', 'sample', { sample: 'assets/rusty-drums/snare-crack.wav', decay: .055, duration: .26 }),
  createSoundDefinition(81, 'スナップスネア', 'Snap snare', '短い胴鳴りと鋭いノイズが弾ける、電子的な「パシッ」', 'drums', 'snap-snare', { frequency: 185, start: 330, decay: .036, duration: .24 }),
  createSoundDefinition(88, 'スラムスネア', 'Slam snare', '強打の実音をコンプで押し固めた、鋭い「バシッ」', 'drums', 'sample', { sample: 'assets/rusty-drums/snare-crack.wav', decay: .055, duration: .32, compression: { thresholdDb: -24, ratio: 8, attack: .0004, release: .012, saturation: 1 } }),
  createSoundDefinition(89, 'コンプファットスネア', 'Compressed fat snare', '低い胴鳴りと実音をコンプで太くした「バパン」', 'drums', 'sample', { sample: 'assets/rusty-drums/snare-rock.wav', playbackRate: .85, body: { frequency: 155, start: 240, decay: .035, level: .4 }, decay: .055, duration: .34, compression: { thresholdDb: -24, ratio: 8, attack: .0005, release: .014, saturation: 1 } }),

  createSoundDefinition(9, 'ドライクラップ', 'Dry clap', '短く乾いた手拍子', 'hats', 'clap', { decay: .045, duration: .4, spread: .009 }),
  createSoundDefinition(10, 'ワイドクラップ', 'Wide clap', '先頭でパッと鳴り、薄い重なりと余韻が広がる手拍子', 'hats', 'clap', { decay: .12, duration: .7, spread: .006, frontLoaded: true }),
  createSoundDefinition(11, 'マシンクラップ', 'Machine clap', '細かな破裂が重なる音', 'hats', 'clap', { decay: .065, duration: .5, spread: .015, metallic: true }),
  createSoundDefinition(12, 'タイトハット', 'Tight hat', '高く短い「チッ」', 'hats', 'hat', { frequency: 1900, decay: .025, duration: .2, noise: .55 }),
  createSoundDefinition(13, 'ソフトハット', 'Soft hat', '柔らかな「スッ」', 'hats', 'hat', { frequency: 2600, decay: .045, duration: .3, noise: .95, soft: true }),
  createSoundDefinition(14, 'オープンハット', 'Open hat', '長めに響く「シャー」', 'hats', 'hat', { frequency: 1500, decay: .19, duration: 1.25, noise: .6 }),
  createSoundDefinition(15, 'メタリックハット', 'Metallic hat', '硬い金属感のある「チン」', 'hats', 'hat', { frequency: 2300, decay: .075, duration: .5, noise: .06 }),

  createSoundDefinition(16, 'クラッシュ', 'Crash', '実音の金属が広がる「ジャーン」', 'cymbals', 'sample', { sample: 'assets/drums/crash.wav', decay: 1.5, duration: 2.8 }),
  createSoundDefinition(17, 'ライド', 'Ride', '実音の粒立つ「チン」と、薄い金属の余韻', 'cymbals', 'sample', { sample: 'assets/drums/ride.wav', decay: 1.1, duration: 2.2 }),
  createSoundDefinition(18, 'ライドベル', 'Ride bell', '実音のカップを叩いた、硬く澄んだ「キン」', 'cymbals', 'sample', { sample: 'assets/drums/ride-bell.wav', decay: .7, duration: 1.6 }),
  createSoundDefinition(19, 'スプラッシュ', 'Splash', '実音クラッシュを高く短く加工した「パシャッ」', 'cymbals', 'sample', { sample: 'assets/drums/crash.wav', playbackRate: 1.65, decay: .16, duration: .65 }),
  createSoundDefinition(20, 'ハイタム', 'High tom', '実音の高い「トン」を短く止めた音', 'cymbals', 'sample', { sample: 'assets/drums/tom-high.wav', playbackRate: 1.12, decay: .06, duration: .28 }),
  createSoundDefinition(21, 'ミッドタム', 'Mid tom', '実音タムを少し低く加工した、短い「トム」', 'cymbals', 'sample', { sample: 'assets/drums/tom-high.wav', playbackRate: .86, decay: .075, duration: .32 }),
  createSoundDefinition(22, 'ロータム', 'Low tom', '実音の低い「ドン」を短く止めた音', 'cymbals', 'sample', { sample: 'assets/drums/tom-low.wav', decay: .085, duration: .38 }),
  createSoundDefinition(23, 'フロアタム', 'Floor tom', '実音タムを低く加工した、深く短い「ドゥン」', 'cymbals', 'sample', { sample: 'assets/drums/tom-low.wav', playbackRate: .72, decay: .1, duration: .44 }),
  createSoundDefinition(82, 'エレクトロハイタム', 'Electro high tom', '高い音程が素早く落ちる、短い「プン」', 'cymbals', 'electronic-tom', { frequency: 230, start: 440, pitchDecay: .012, decay: .038, duration: .22 }),
  createSoundDefinition(83, 'エレクトロミッドタム', 'Electro mid tom', '中音域で丸く弾む、短い「プン」', 'cymbals', 'electronic-tom', { frequency: 170, start: 320, pitchDecay: .014, decay: .046, duration: .26 }),
  createSoundDefinition(84, 'エレクトロロータム', 'Electro low tom', '低い音程へ落ちて止まる「プン」', 'cymbals', 'electronic-tom', { frequency: 115, start: 225, pitchDecay: .016, decay: .055, duration: .3 }),
  createSoundDefinition(85, 'エレクトロフロアタム', 'Electro floor tom', '深い低音へ落ち、短く収まる「プウン」', 'cymbals', 'electronic-tom', { frequency: 78, start: 155, pitchDecay: .018, decay: .065, duration: .34 }),
  createSoundDefinition(90, 'スラムタム', 'Slam tom', '低い実音タムをコンプで密にした、力強い「ドム」', 'cymbals', 'sample', { sample: 'assets/drums/tom-low.wav', decay: .06, duration: .38, compression: { thresholdDb: -24, ratio: 8, attack: .0006, release: .018, saturation: 1 } }),

  createSoundDefinition(24, 'ハードリム', 'Hard rim', '鋭く強い「カッ」', 'percussion', 'wood', { frequency: 1800, decay: .012, duration: .16, noise: .4, ratio: 1.61 }),
  createSoundDefinition(25, 'ソフトリム', 'Soft rim', '軽く乾いた「コッ」', 'percussion', 'wood', { frequency: 720, decay: .018, duration: .2, noise: .1, ratio: 2.3 }),
  createSoundDefinition(26, 'ハイウッドブロック', 'High woodblock', '高く空洞感のある「コク」', 'percussion', 'wood', { frequency: 980, decay: .045, duration: .32, ratio: 2.72 }),
  createSoundDefinition(27, 'ローウッドブロック', 'Low woodblock', '低く丸い「ポク」', 'percussion', 'wood', { frequency: 470, decay: .06, duration: .42, ratio: 2.72 }),
  createSoundDefinition(28, 'クラベス', 'Claves', '細く硬い「カチッ」', 'percussion', 'wood', { frequency: 2450, decay: .022, duration: .22, ratio: 1.23 }),
  createSoundDefinition(29, 'ハイカウベル', 'High cowbell', '実音カウベルを高く加工した、明るい「カン」', 'percussion', 'sample', { sample: 'assets/drums/cowbell.wav', playbackRate: 1.25, decay: .12, duration: .4 }),
  createSoundDefinition(30, 'ローカウベル', 'Low cowbell', '実音カウベルを低く加工した、厚い「コン」', 'percussion', 'sample', { sample: 'assets/drums/cowbell.wav', playbackRate: .85, decay: .17, duration: .55 }),

  createSoundDefinition(31, 'ショートシェイカー', 'Short shaker', '短く切れる「シャッ」', 'hand', 'shaker', { decay: .022, duration: .2, grain: 43 }),
  createSoundDefinition(32, 'ロングシェイカー', 'Long shaker', '粒が流れる「シャー」', 'hand', 'shaker', { decay: .12, duration: .8, grain: 21 }),
  createSoundDefinition(33, 'ブライトタンバリン', 'Bright tambourine', '金属の響きが広がる「チャリン」', 'hand', 'tambourine', { frequency: 1900, decay: .14, duration: .9 }),
  createSoundDefinition(34, 'タイトタンバリン', 'Tight tambourine', '短く締まった「チャッ」', 'hand', 'tambourine', { frequency: 2600, decay: .025, duration: .24 }),
  createSoundDefinition(35, 'ハイボンゴ', 'High bongo', '高く張りのある「ポン」', 'hand', 'hand', { frequency: 430, decay: .065, duration: .45, ratio: 1.55 }),
  createSoundDefinition(36, 'ローボンゴ', 'Low bongo', '低く丸い「ポコ」', 'hand', 'hand', { frequency: 280, decay: .085, duration: .6, ratio: 1.55 }),
  createSoundDefinition(37, 'ハイコンガ', 'High conga', '明るく弾む「コン」', 'hand', 'hand', { frequency: 240, decay: .13, duration: .85, ratio: 2.37 }),
  createSoundDefinition(38, 'ローコンガ', 'Low conga', '太く響く「クン」', 'hand', 'hand', { frequency: 155, decay: .19, duration: 1.2, ratio: 2.37 }),

  createSoundDefinition(39, 'サブパルス', 'Sub pulse', '短く深い低音', 'tonal', 'bass', { frequency: 39, decay: .18, duration: 1.1, flavor: 'sub' }),
  createSoundDefinition(40, 'ラウンドベース', 'Round bass', '丸く減衰する「ブーン」', 'tonal', 'bass', { frequency: 65.4, decay: .17, duration: 1.1, flavor: 'round' }),
  createSoundDefinition(41, 'ラバーベース', 'Rubber bass', '弾力のある「ボヨン」', 'tonal', 'bass', { frequency: 73.4, decay: .2, duration: 1.3, flavor: 'rubber' }),
  createSoundDefinition(42, 'バズベース', 'Buzz bass', 'ざらついた「ブズッ」', 'tonal', 'bass', { frequency: 55, decay: .09, duration: .65, flavor: 'buzz' }),
  createSoundDefinition(43, 'シンセマレット', 'Synth mallet', '柔らかく澄んだ打撃音', 'tonal', 'mallet', { frequency: 523.25, decay: .16, duration: 1.1 }),
  createSoundDefinition(44, 'シンセプラック', 'Synth pluck', '鋭く弾ける、短い弦のような音', 'tonal', 'pluck', { frequency: 329.63, decay: .13, duration: .95 }),
  createSoundDefinition(45, 'コードスタブ', 'Chord stab', '和音が一瞬だけ鳴る', 'tonal', 'chord', { frequency: 261.63, decay: .13, duration: .9 }),
  createSoundDefinition(46, 'ボイスヒット', 'Voice hit', '「ワ」「オ」のような母音感', 'tonal', 'vowel', { frequency: 130.81, decay: .13, duration: .85 }),

  createSoundDefinition(47, 'FMベル', 'FM bell', '電子的な、澄んだ鐘', 'particles', 'metal', { frequency: 740, ratio: 2, index: 2.4, decay: .35, duration: 2.2 }),
  createSoundDefinition(48, 'メタルクランク', 'Metal clank', '金属がぶつかる「ガキン」', 'particles', 'metal', { frequency: 330, ratio: 1.414, index: 5.5, decay: .15, duration: 1.1 }),
  createSoundDefinition(49, 'スプリング', 'Spring', 'ばねのような「ビョン」', 'particles', 'spring', { frequency: 190, decay: .22, duration: 1.5 }),
  createSoundDefinition(50, '不協和チャイム', 'Odd chime', '濁った倍音の「キララン」', 'particles', 'chime', { frequency: 540, decay: .31, duration: 2 }),
  createSoundDefinition(51, 'マイクロクリック', 'Micro click', '針先のように短い「チッ」', 'particles', 'click', { frequency: 4800, decay: .002, duration: .06 }),
  createSoundDefinition(52, 'デジタルポップ', 'Digital pop', '丸く小さな「プッ」', 'particles', 'pop', { frequency: 660, decay: .018, duration: .18 }),
  createSoundDefinition(53, 'ウォータードロップ', 'Water drop', '水滴のような「プリン」', 'particles', 'drop', { frequency: 1150, decay: .08, duration: .65 }),
  createSoundDefinition(54, 'グレインスプレー', 'Grain spray', '細かな粒が散る「パラッ」', 'particles', 'grain', { frequency: 1600, decay: .08, duration: .6 }),

  createSoundDefinition(55, 'エアプフ', 'Air puff', '空気が噴き出す「フッ」', 'motion', 'noise', { decay: .045, duration: .32, flavor: 'air' }),
  createSoundDefinition(56, 'スタティッククラック', 'Static crack', '電気的な「バチッ」', 'motion', 'noise', { decay: .012, duration: .15, flavor: 'crack' }),
  createSoundDefinition(57, 'サンドスクレイプ', 'Sand scrape', '擦れるような「ザリッ」', 'motion', 'noise', { decay: .12, duration: .75, flavor: 'sand' }),
  createSoundDefinition(58, 'ホイッスルノイズ', 'Whistle noise', 'ノイズと笛の響きが混ざる', 'motion', 'noise', { frequency: 1800, decay: .15, duration: 1, flavor: 'whistle' }),
  createSoundDefinition(59, 'レーザーダウン', 'Laser down', '鋭く下降する「ピュン」', 'motion', 'sweep', { frequency: 90, start: 3400, decay: .065, duration: .55, flavor: 'laser' }),
  createSoundDefinition(60, 'バブルドロップ', 'Bubble drop', '丸く下降する「プーン」', 'motion', 'sweep', { frequency: 80, start: 520, decay: .15, duration: .95, flavor: 'bubble' }),
  createSoundDefinition(61, 'ライジングチャープ', 'Rising chirp', '高い方へ跳ねる「ピュイッ」', 'motion', 'sweep', { frequency: 2600, start: 260, decay: .07, duration: .4, flavor: 'rise' }),
  createSoundDefinition(62, 'ウォブルヒット', 'Wobble hit', '揺れながら収まる「ウワワッ」', 'motion', 'wobble', { frequency: 220, decay: .16, duration: 1.1 }),

  createSoundDefinition(67, 'リバースサック', 'Reverse suck', '吸い込むような「シュワッ」', 'transition', 'reverse', { frequency: 390, decay: .12, duration: .5 }),
  createSoundDefinition(72, 'リバースクラッシュ', 'Reverse crash', '実音シンバルがじわっと迫り、最後に吸い込まれる', 'transition', 'sample', { sample: 'assets/drums/crash.wav', reverse: true, decay: 1, duration: 1.6 }),
  createSoundDefinition(73, 'ショートリバースシンバル', 'Short reverse cymbal', '一拍前の隙間に差し込む、短いシンバルの吸い込み', 'transition', 'sample', { sample: 'assets/drums/crash.wav', reverse: true, playbackRate: 1.5, decay: .25, duration: .45 }),
  createSoundDefinition(74, 'リバーススネア', 'Reverse snare', '実音スネアのザラッとした余韻が打撃へ集まる', 'transition', 'sample', { sample: 'assets/drums/snare-center.wav', reverse: true, decay: .2, duration: .38 }),
  createSoundDefinition(75, 'リバースタム', 'Reverse tom', '低い響きが膨らみ、次の一打を呼び込む', 'transition', 'sample', { sample: 'assets/drums/tom-low.wav', reverse: true, playbackRate: .8, decay: .22, duration: .55 }),
  createSoundDefinition(76, 'ハットスウェル', 'Hat swell', '実音のハットが柔らかく立ち上がり、薄く消える', 'transition', 'sample', { sample: 'assets/drums/hat-open.wav', swell: .28, decay: .32, duration: .85 }),
  createSoundDefinition(77, 'ノイズスウェル', 'Noise swell', '空気の粒が膨らみ、高域を開きながら消える', 'transition', 'swell', { frequency: 1000, decay: .2, duration: .95, flavor: 'air' }),
  createSoundDefinition(78, 'メタルスウェル', 'Metal swell', '金属をこするような響きがゆっくり立ち上がる', 'transition', 'swell', { frequency: 540, decay: .3, duration: 1.15, flavor: 'metal' }),

  createSoundDefinition(63, 'ビットクラッシュ', 'Bit crush', '粗いデジタルの打撃音', 'texture', 'glitch', { frequency: 150, decay: .1, duration: .7, flavor: 'bit' }),
  createSoundDefinition(64, 'スタッターバースト', 'Stutter burst', '細かく途切れる「ダダダッ」', 'texture', 'glitch', { frequency: 260, decay: .16, duration: .72, flavor: 'stutter' }),
  createSoundDefinition(65, 'ピッチステップ', 'Pitch step', '階段状に変わる「ピポパ」', 'texture', 'glitch', { frequency: 440, decay: .13, duration: .48, flavor: 'step' }),
  createSoundDefinition(66, 'ディストーションスタブ', 'Distortion stab', '潰れた強い「ギャッ」', 'texture', 'glitch', { frequency: 110, decay: .095, duration: .65, flavor: 'distortion' }),
  createSoundDefinition(68, 'エコーピン', 'Echo pin', '短い音に数回の反響が続く', 'texture', 'echo', { frequency: 1050, decay: .022, duration: 1.25 }),
  createSoundDefinition(69, 'レゾナントチューブ', 'Resonant tube', '管の中で響くような「コーン」', 'texture', 'tube', { frequency: 310, decay: .22, duration: 1.5 }),
  createSoundDefinition(70, 'シマーヒット', 'Shimmer hit', '高い響きが薄く広がる', 'texture', 'shimmer', { frequency: 1046.5, decay: .32, duration: 2.2 }),
];

export const sounds = categories
  .flatMap((category) => soundDefinitions.filter((sound) => sound.category === category.id))
  .map((entry, index) => ({ id: index + 1, ...entry }));
