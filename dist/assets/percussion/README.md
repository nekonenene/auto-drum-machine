# パーカッション実音素材の出典

同梱WAVは **Virtuosity Drums** の近接マイクによる7個のパーカッション録音を加工したものです。

- 提供: Versilian Studios / Karoryfer Samples
- ライブラリ: https://github.com/sfzinstruments/virtuosity_drums
- 配布元とライセンスの説明: https://versilian-studios.com/virtuosity-drums/
- 参照リビジョン: `9f04cf9a734527edfbb0a4eee1f674e45bbf71bc`
- ライセンス: CC0 1.0 Universal（[原文](LICENSE-CC0.txt)）
- 元素材のパス・固定URL・SHA-256、加工後WAVのSHA-256: [sources.json](sources.json)

## 音色への割り当て

| 素材 | 表示番号・用途 |
| --- | --- |
| `shaker-down.wav` | 48番: 振り下ろしの短いシェイカー |
| `shaker-up.wav` | 49番: 振り上げの長いシェイカー |
| `tambourine.wav` | 52〜53番: 明るいタンバリンと余韻を切った短いタンバリン |
| `bongo-high.wav` / `bongo-low.wav` | 56〜57番: 別々に録音されたボンゴの高低 |
| `conga-open.wav` | 60〜61番: 同じオープン打ちを速度1.15倍・0.85倍でピッチ加工した高低 |
| `conga-muted.wav` | 62番: 実際のミュート打ち |

タンバリンの2音は同じ録音の減衰違いです。コンガの高低は別サイズの楽器の録音ではなく、同じ録音を加工した音です。既存のシェイカー・タンバリン・ボンゴ・コンガの合成音8音も残しています。

## 同梱時の加工

1. 複数チャンネルの場合は平均してモノラル化
2. シェイカー・タンバリンは先頭200msの5ms窓RMSを計算し、最大値の70%に初めて達した窓の1ms手前から切り出し。振り始めの小さい部分を詰め、打撃が遅れて聞こえにくいよう調整
3. ボンゴ・コンガは振幅がピークの2%を初めて超える位置の1ms手前から切り出し
4. 必要な余韻だけ残してカット（位置・長さはsources.jsonにフレーム数で記録）
5. DC成分を除去し、始端0.5ms・終端15msをフェード
6. ピークを0.9に正規化し、元の44.1kHz・16bit PCM WAVとして保存

素材準備にはPythonのsoundfile / NumPyを使用しました。サイトの実行には不要です。

試聴時にはsounds.jsの指定に従ってピッチと減衰を加工し、48kHz・モノラルへ変換します。基本のピーク0.78に音色ごとの音量補正を加え、ピークの上限を0.95未満に抑えます。波形表示・試聴・WAV保存は同じ加工済みPCMを使います。
