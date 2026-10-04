/**
 * 保存された関連フレーズで、出だし・基本6小節・フィルを組み立てる
 */
export class AutomaticPerformance {
  /**
   * 関連する出だしとフィルを持つ基本を再生候補にする
   *
   * @param {object[]} library 保存ライブラリ
   * @param {Function} [random=Math.random] 0以上1未満の乱数を返す関数
   * @returns {AutomaticPerformance}
   */
  constructor(library, random = Math.random) {
    this.library = library;
    this.random = random;
    this.currentBase = null;
    this.bases = library.filter((base) => base.purpose === 'basic' && base.bars === 2
      && ['intro', 'fill'].every((purpose) => library.some((pattern) => pattern.purpose === purpose
        && pattern.derivedFrom === base.id && pattern.meter === base.meter)));
  }

  /**
   * 選択したフレーズの派生元を、出だしから開始する
   *
   * @param {object} selected 選択中の基本・出だし・フィル・生成案
   * @returns {object[]} 最初の演奏列
   */
  start(selected) {
    const base = this.bases.find((pattern) => pattern.id === (selected.derivedFrom || selected.id));

    if (!base) {
      throw new Error('関連する出だしと展開フィルがある基本パターンを選んでください');
    }

    this.currentBase = base;

    return this.sequence(base, true);
  }

  /**
   * 同じ拍子の次の基本を選び、激しさが下がる場合は出だしを挟む
   *
   * @param {string} [intensity='all'] 次の激しさ（allまたは1〜5）
   * @returns {object[]} 次の演奏列
   */
  next(intensity = 'all') {
    const previous = this.currentBase;
    const eligible = this.bases.filter((base) => base.meter === previous.meter
      && (intensity === 'all' || base.intensity === Number(intensity)));
    const alternatives = eligible.filter((base) => base.id !== previous.id);
    const candidates = alternatives.length ? alternatives : eligible;

    if (!candidates.length) {
      throw new Error('指定した激しさの基本パターンがありません');
    }

    const next = candidates[Math.floor(this.random() * candidates.length)];
    this.currentBase = next;

    return this.sequence(next, next.intensity < previous.intensity);
  }

  /**
   * 2小節の基本を3回鳴らし、派生元が一致するフィルにつなぐ
   *
   * @param {object} base 基本パターン
   * @param {boolean} withIntro 出だしを挟むか
   * @returns {object[]} 休符も含めて接続する演奏列
   */
  sequence(base, withIntro) {
    /**
     * 派生元と拍子が一致するフレーズを取得する
     *
     * @param {string} purpose 用途
     * @returns {object} 関連フレーズ
     */
    const related = (purpose) => this.library.find((pattern) => pattern.purpose === purpose
      && pattern.derivedFrom === base.id && pattern.meter === base.meter);

    return [...(withIntro ? [related('intro')] : []), base, base, base, related('fill')];
  }
}
