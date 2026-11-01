# 燃料荷卸し検証・夜勤向けWebアプリ
LINEから開く静的Webアプリ: https://yshimano-dev.github.io/fuel-check-night-web/

## 夜勤メンバーの操作
1. ローリー到着直後に油面計の荷卸し前レシートを印字する（最優先）。
2. 荷卸しが終わったら油面計の在庫レシートを再印字する。
3. 前・後の2枚（管理表＋レシート付き）をWebアプリに読み込む。
4. 読み取り候補20欄を原票と照合し、不確かな数字を手直し。④入荷量は必ず照合する。
5. 自動計算結果を正式な紙チェック表に手書きで転記し、前後帳票と3枚1セットで保管。

## 実装
- GitHub Pagesで静的公開。写真・帳票・実例は公開リポジトリに含めない。
- 従来の端末内OCR（Tesseract.js）は写真を外部送信しない。
- 高精度AI用のCloudflare WorkerとCloud Vision OCRの接続コードは worker/ に準備済み。
- Google Cloud専用プロジェクト `fuel-check-night-20261102` を作成済み。Cloud Vision API は有効化済み。2026-11-02 時点で課金設定は無効のまま（既存請求先を無断で紐づけない）。
- Cloudflare Wrangler は未ログイン。Worker本番公開と API キー設定は未実施。
- Cloud Vision AIはまだ未接続。worker APIURLが未設定なので、公開WebページからGoogleへ写真を送らない。
- AI接続後はAIボタンで撮影画像のみCloud Visionに一時送信、Google公式仕様はオンライン処理では画像をディスクに保存しない。
- 6桁の夜勤共通コード（Workers Secret）で認証。ユーザー全員が個別AI登録する必要はない。
- Durable Objectが月最大100画像ユニットを厳密に制限。Cloudflare Rate Limitは誤入力の連打抑止。
- 事業所の帳票を外部APIに送る運用は管理者承認後に有効化すること。

## AI本番接続（管理担当のみ）
1. 勤務先の業務帳票外部送信の承認を確認する。
2. Google Cloudで別の専用プロジェクトを作りCloud Vision APIを有効化。料金・請求先・API利用上限/予算を確認し、Vision API専用のAPIキーを作成する。
3. CloudflareにログインしてWorkerを作成する（`worker/wrangler.jsonc` あり）。`npx wrangler deploy`。
4. `npx wrangler secret put GOOGLE_VISION_API_KEY`、`npx wrangler secret put SHIFT_SHARED_CODE` で設定（キーやコードはGitHub・LINEには貼らない）。
5. Web側の`window.FUEL_AI_ENDPOINT`をWorkerのHTTPS URLに設定してコミットする。
6. テストデータと実機で文字抽出・○×・失敗時手入力を検証後に共有利用開始。

## 注意
- Google Sheetsとの自動同期はしない。複数人の同時編集や履歴が混ざらないよう、端末ごとに作業。
- 4セット12枚では既知の数値不一致が1件あるため、OCR候補は確認完了まで計算表へ確定しない。
- 画像AIと計算は補助。正式な判断フローや上長指示を優先する。
