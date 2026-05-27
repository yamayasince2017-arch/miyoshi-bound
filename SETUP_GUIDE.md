# MIYOSHI BOUND — セットアップガイド

> このドキュメントは、MIYOSHI BOUNDを本番環境で稼働させるための完全な手順書です。

---

## ディレクトリ構造

```
/miyoshi-bound
├── index.html              ← メインページ（入口）
├── index-catalog.html      ← 事業者一覧（回廊）
├── about.html              ← 活動紹介（管理棟）
├── contact.html            ← お問い合わせ（窓口）
├── SETUP_GUIDE.md          ← このファイル
├── /items
│   └── template.html       ← 個別事業者LPテンプレート（心臓部）
├── /css
│   └── style.css           ← 全ページ共通スタイル
├── /js
│   └── tracking.js         ← トラッキングスクリプト
└── /gas
    └── backend.js          ← Google Apps Script（GASエディタに貼り付け）
```

---

## Step 1 — Googleスプレッドシートの準備

1. 新しいGoogleスプレッドシートを作成する
2. 以下のシートを作成する：

| シート名 | 用途 |
|---|---|
| `閲覧ログ` | トラッキングデータの自動記録先 |
| `返信メール本文` | ウェルカムメールのテンプレート |

3. **スプレッドシートIDをメモする**（URLの `/spreadsheets/d/[ここ]/edit` 部分）

### `返信メール本文` シートの記入例

| 行 | A列の内容 |
|---|---|
| 1 | `【MIYOSHI BOUND】お申し込みありがとうございます — {{business}}` |
| 2 | （空白行） |
| 3 | `{{name}} 様` |
| 4 | （空白） |
| 5 | `このたびはMIYOSHI BOUNDへのご申し込みをいただき、ありがとうございます。` |
| 6 | ... |

**使用可能なプレースホルダー：**

| プレースホルダー | 置換される内容 |
|---|---|
| `{{name}}` | 担当者名 |
| `{{business}}` | 事業者名 |
| `{{email}}` | メールアドレス |
| `{{category}}` | 業種・カテゴリ |
| `{{message}}` | 一言紹介 |
| `{{date}}` | 申込日時 |
| `{{year}}` | 現在の年 |

---

## Step 2 — Google Apps Scriptのデプロイ

1. [Google Apps Script](https://script.google.com) を開く
2. 「新しいプロジェクト」を作成、名前を `MIYOSHI BOUND Backend` とする
3. `gas/backend.js` の内容をエディタに貼り付ける
4. **CONFIG セクションを編集する：**

```javascript
var CONFIG = {
  SPREADSHEET_ID: '[YOUR_SPREADSHEET_ID]',  // ← Step 1でメモしたID
  ADMIN_EMAIL:    'your@email.com',          // ← 管理者メールアドレス
  // ... その他はデフォルトのまま
};
```

5. **Webアプリとしてデプロイする：**
   - 「デプロイ」→「新しいデプロイ」
   - 種類：「ウェブアプリ」
   - 実行ユーザー：「自分」
   - アクセスできるユーザー：「全員」
   - 「デプロイ」をクリック
   - **表示されたURLをコピーする**（`https://script.google.com/macros/s/.../exec`）

6. **トリガーを設定する（ウェルカムメール用）：**
   - 「トリガー」（時計アイコン）→「トリガーを追加」
   - 実行する関数：`onFormSubmit`
   - イベントのソース：「スプレッドシートから」
   - イベントの種類：「フォーム送信時」

---

## Step 3 — tracking.js の設定

`js/tracking.js` を開き、`GAS_ENDPOINT` を更新する：

```javascript
var CONFIG = {
  GAS_ENDPOINT: 'https://script.google.com/macros/s/[YOUR_SCRIPT_ID]/exec',
  // ↑ Step 2でコピーしたURLに置き換える
  DEBUG: false  // 本番環境ではfalseのまま
};
```

---

## Step 4 — Googleフォームの設定

1. Googleフォームを新規作成する
2. 以下のフィールドを追加する：

| フィールド名 | 種類 | 必須 |
|---|---|---|
| 担当者名 | 短文テキスト | ○ |
| 事業者名 | 短文テキスト | ○ |
| メールアドレス | メールアドレス | ○ |
| 業種・カテゴリ | プルダウン | ○ |
| 一言紹介 | 長文テキスト | - |
| 知ったきっかけ | 短文テキスト | - |

3. フォームの回答先をStep 1のスプレッドシートに設定する
4. フォームの「埋め込み」URLを取得する
5. `contact.html` の iframe src を更新する：

```html
<iframe
  src="https://docs.google.com/forms/d/e/[YOUR_FORM_ID]/viewform?embedded=true"
  ...>
```

---

## Step 5 — 個別事業者ページの量産

`items/template.html` を複製して、各事業者のページを作成する。

**ファイル命名規則：** `items/[事業者ID].html`
例：`items/oboke-honey.html`

**`[EDIT]` タグを検索して全箇所を置き換える：**

| タグ | 置き換える内容 |
|---|---|
| `[EDIT_SHOP_ID]` | 事業者ID（例：`oboke-honey`） |
| `[EDIT] Producer Name` | 事業者名・商品名 |
| `[EDIT] Category` | カテゴリ（Food / Craft / Experience / Stay） |
| `[EDIT] ...` | 各コピー・テキスト |

---

## Step 6 — QRコードの生成

各事業者ページのURLに `?from=` パラメータを付けてQRコードを生成する。

**URLパターン：**

| 設置場所 | URL例 |
|---|---|
| 店舗レジ横 | `https://[your-domain]/items/oboke-honey.html?from=cashier` |
| 駅の観光案内板 | `https://[your-domain]/items/oboke-honey.html?from=station` |
| 名刺 | `https://[your-domain]/index.html?from=card` |
| SNS | `https://[your-domain]/items/oboke-honey.html?from=sns` |
| ホテルロビー | `https://[your-domain]/items/oboke-honey.html?from=hotel` |

**QRコード生成ツール：**
- [QR Code Generator](https://www.qr-code-generator.com/)
- [goQR.me](https://goqr.me/)

---

## Step 7 — 写真の配置

`/images/` ディレクトリを作成し、以下の命名規則で写真を配置する：

| ファイル名 | 用途 |
|---|---|
| `hero.jpg` | メインページ背景（推奨：2400×1600px以上） |
| `[shop-id]-hero.jpg` | 各事業者ページのヒーロー画像 |
| `[shop-id]-sub1.jpg` | サブ画像1 |
| `[shop-id]-sub2.jpg` | サブ画像2 |
| `[shop-id]-portrait.jpg` | 生産者ポートレート |
| `[shop-id]-og.jpg` | OGP画像（1200×630px） |

**写真の置き換え方：**
各HTMLファイルで `img-placeholder` クラスの `div` を `img` タグに置き換える：

```html
<!-- Before -->
<div class="img-placeholder">Photo</div>

<!-- After -->
<img src="../images/oboke-honey-hero.jpg" alt="Oboke Mountain Honey" loading="lazy">
```

---

## Step 8 — 動作確認チェックリスト

- [ ] GAS_ENDPOINT が正しいURLに更新されている
- [ ] SPREADSHEET_ID が正しいIDに更新されている
- [ ] ADMIN_EMAIL が正しいアドレスに更新されている
- [ ] Googleフォームの iframe src が更新されている
- [ ] 各事業者ページの `[EDIT_SHOP_ID]` が置き換えられている
- [ ] トラッキングテスト：`testTracking()` をGASエディタから実行
- [ ] メールテスト：`testWelcomeMail()` をGASエディタから実行
- [ ] スプレッドシートの「閲覧ログ」にデータが記録されることを確認
- [ ] ウェルカムメールが届くことを確認

---

## データ分析の活用

スプレッドシートの「閲覧ログ」シートを使って、以下の分析が可能：

**ピボットテーブルの設定例：**
- 行：Shop（事業者）
- 列：Type（view / like）
- 値：件数（COUNTA）

**転換率の計算：**
```
転換率 = いいね数 ÷ 閲覧数 × 100
```

**ダッシュボードの自動生成：**
GASエディタから `generateDashboard()` を実行すると、「ダッシュボード」シートに集計表が自動生成される。

---

## トラブルシューティング

| 症状 | 原因と対処 |
|---|---|
| ログが記録されない | GAS_ENDPOINTが未設定 / GASのデプロイが「全員」になっていない |
| ウェルカムメールが届かない | onFormSubmitトリガーが未設定 / フォームとスプレッドシートが未連携 |
| いいねボタンが効かない | PRODUCER_CONFIGのshopIdが `[EDIT_SHOP_ID]` のまま |
| フォームが表示されない | Google FormのiFrame srcが未更新 |

---

*MIYOSHI BOUND — 三好の良いものを、世界へ。*
