# Auto Drum Machine

リズムに変化をつけながら、停止するまで無限に自動演奏するドラムマシーンを作るプロジェクトです。ブラウザ上でドラム・パーカッション・電子音を鳴らし、出だし・基本パターン・展開フィルをつないで演奏します。

現在は4拍子の基本・出だし・展開フィルを各100種類、合計300種類収録し、次の基本をランダムに選ぶ自動演奏に対応しています。3拍子・5拍子のパターンは今後追加する予定です。音色の試聴・調整用ライブラリも備えています。

## 起動と使い方

Node.jsが必要です。プロジェクトのディレクトリで次を実行します。

```sh
npm run dev
```

[自動演奏・パターン画面](http://localhost:5173/)を開き、「自動演奏」を押すと演奏が始まります。関連する出だしから始まり、基本6小節 → 展開フィル2小節 → 次の基本を繰り返します。次の基本の激しさが下がる場合は、その基本の出だしを挟みます。

BPM・音量は再生中も変更でき、「次の激しさ」は次の基本への切り替えから反映されます。「停止」またはEscapeで終了します。パターンごとの試聴や詳細の確認もできます。

下部の「エフェクト」で、演奏全体にフィルター・コンプレッサー・コーラス・リバーブを掛けられます。初期状態は4種類ともオンで、フィルターのLFOはオフです。フィルターの自動変化はBPMに同期し、形・周期（半拍〜32拍）・深さを調整できます。「元の音で聴く」で設定を保って比較できます。一括切り替えボタンは、どれかがオンなら「すべて解除」、すべてオフなら「すべてオン」と表示され、パラメーターの値を保ったまま切り替えます。停止では残響も消し、リピートを外した試聴では残響が終わるまで再生します。設定はページを開いている間保持し、演奏データのJSONや音色ライブラリのWAV保存には含みません。

[音色ライブラリ](http://localhost:5173/sounds.html)では、音色の試聴・検索・お気に入り登録・WAV保存ができます。音声は最初のクリックで開始します。お気に入りや生成したパターンは、そのブラウザのローカルストレージに保存します。実音素材はリポジトリに同梱しています。

## ビルド・開発

`dist/` 内のHTML・CSS・JavaScriptをそのまま配信する構成で、起動前のビルドや外部ライブラリのインストールは不要です。`npm start` でも同じローカルサーバーを起動できます。

```sh
npm test                  # テストを実行
npm run patterns:build    # パターンの保存データを再生成
npm run sounds:measure    # 音色の響きの長さを再測定
```

`patterns:build` は `dist/patterns-data.js`、`sounds:measure` は `dist/sound-lengths.js` を更新します。パターンや音色の定義を変更したときに実行します。

## GitHub Pagesでの公開

公開用のファイルは `dist/` にまとめ、そのままGitで管理しています。GitHubリポジトリの **Settings → Pages** で、Sourceを **GitHub Actions** に設定してください。

`.github/workflows/pages.yml` が `main` へのpush時にテストを実行し、成功したら `dist/` の内容をGitHub Pagesへ公開します。Actions画面から手動実行する場合も、`main` を選んでください。公開前のビルドは不要です。

設定の詳細は[GitHub公式ドキュメント](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)を参照してください。

## ドキュメント

- [PATTERNS.md](PATTERNS.md): パターンの制作方針・分類基準・演奏データ・自動演奏の仕様
- [SOUNDS.md](SOUNDS.md): 音色の調整内容・タグの基準・素材の出典とライセンス

## 主な構成

- `dist/index.html` / `dist/patterns-app.js` / `dist/patterns.css`: 自動演奏とパターンの試聴画面
- `dist/pattern-performance.js` / `dist/pattern-player.js`: 自動演奏の進行と音声の再生予約
- `dist/effects.js`: 演奏全体のエフェクトとフィルターのBPM同期、ステレオ残響の生成
- `dist/patterns-data.js` / `dist/pattern-model.js`: 保存パターンと共通の分類・生成処理
- `dist/sounds.html` / `dist/app.js` / `dist/styles.css`: 音色ライブラリ画面
- `dist/sounds.js` / `dist/synth.js` / `dist/samples.js`: 音色の定義・PCM生成・実音素材の読み込み
- `dist/assets/`: 実音素材と出典・ライセンスの記録
- `tools/`: パターン生成・音色測定の開発用ツール
- `tests/`: 音色・演奏データ・再生制御などのテスト
- `server.mjs`: ローカルプレビュー用サーバー
- `.github/workflows/pages.yml`: テスト後にGitHub Pagesへ公開するワークフロー
