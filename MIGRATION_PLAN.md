# 経費精算レシート管理システム 改修計画書

**プロジェクト名**: OCR画像アプリ → 経費精算レシート管理システム  
**作成日**: 2025年11月7日  
**改修目的**: VTuberグッズ注文管理から一般的な経費精算管理へテーマ変更  
**改修方針**: 既存機能を維持しつつ、データモデルとUIのみ変更 + UI/UXルール適用

---

## 📌 改修サマリー

| 項目 | 内容 |
|------|------|
| **対象ファイル数** | 8ファイル |
| **変更行数** | 約620行 |
| **所要時間** | 約4〜5時間 |
| **改修フェーズ** | 6段階 |
| **主要変更** | データモデル変更、UIラベル変更、🆕UI/UXルール適用 |
| **リスクレベル** | 中（データベーススキーマ変更あり） |
| **ロールバック** | 可能（バックアップ済み、段階的コミット） |

---

## 📋 改修概要

### 変更前 → 変更後

| 項目 | 変更前 | 変更後 |
|------|--------|--------|
| システム名 | 画像読み取りアプリ | 経費精算レシート管理システム |
| 管理対象 | VTuberグッズ注文書 | 経費精算レシート |
| カテゴリ | ホロライブ/にじさんじ/SIXFONIA/その他 | 交通費/会議費/備品費/通信費/その他 |
| ヘッダーモデル | OrderHeader | ExpenseHeader |
| 明細モデル | OrderDetail | ExpenseDetail |

---

## 🎯 改修スコープ

### ✅ 変更する箇所
1. データベーススキーマ（テーブル名・フィールド名）
2. Lambda関数のOCRプロンプト（カテゴリ判定ロジック）
3. フロントエンドコンポーネント名
4. UIラベル・タイトル・カラーパレット
5. 型定義とインポート
6. **UI/UXルール適用**（低ITリテラシー配慮、アクセシビリティ向上）

### ❌ 変更しない箇所
- アーキテクチャ（AWS Amplify Gen 2）
- 認証機能（AWS Cognito）
- ストレージ機能（S3 + Lambda トリガー）
- リアルタイム同期機能（observeQuery）
- フィルター・検索機能
- グラフ表示機能（Recharts）

### 🆕 UI/UXルール適用項目
- **低ITリテラシー配慮**: IT用語回避、分かりやすい日本語表現
- **視認性向上**: 最小44×44pxクリック領域、高コントラスト
- **アクセシビリティ**: aria-label必須、色+アイコン+テキスト併記
- **日付・数値統一**: yyyy/MM/dd形式、3桁区切り、等幅数字
- **ボタン階層**: 1画面1つのPrimary、variant/color必須明示

---

## 📦 改修ファイル一覧

### 1. バックエンド（3ファイル）

#### `amplify/data/resource.ts`
**変更内容**:
- `OrderHeader` → `ExpenseHeader`
- `OrderDetail` → `ExpenseDetail`
- フィールド名変更:
  - `orderId` → `expenseId`
  - `orderDate` → `expenseDate`
  - `documentName` → `receiptName`
  - `documentUri` → `receiptUri`
  - `orderDetails` → `expenseDetails`
  - `orderHeaderId` → `expenseHeaderId`
  - `orderHeader` → `expenseHeader`

#### `amplify/backend.ts`
**変更内容**:
- コメントの文言調整（注文 → 経費）

#### `amplify/functions/ocr/process-image-ocr.ts`
**変更内容**:
- 型定義名変更: `OrderData` → `ExpenseData`
- AIプロンプト変更:
  - 「注文書」→「レシート」
  - カテゴリルール変更（VTuber判定 → 経費種別判定）
  - フィールド名変更（orderId → expenseId 等）
- 関数名変更:
  - `extractOrderFromImage` → `extractExpenseFromReceipt`
  - `saveOrderToDatabase` → `saveExpenseToDatabase`
- データベース保存処理のモデル名変更

#### `amplify/functions/ocr/resource.ts`
**変更内容**:
- 関数名・説明の変更

---

### 2. フロントエンド（6ファイル）

#### `src/App.tsx`
**変更内容**:
- タイトル変更: 「画像読み取りアプリ」→「経費精算レシート管理システム」
- セクション名変更: 「画像アップロード」→「レシート画像アップロード」
- セクション名変更: 「OCR処理結果」→「経費精算データ」
- コンポーネント名変更: `OcrDataList` → `LatestExpenses`

#### `src/components/LatestOrders.tsx` → `src/components/LatestExpenses.tsx`
**変更内容**:
- ファイル名変更（リネーム）
- 型定義変更: `OrderWithDetails` → `ExpenseWithDetails`
- モデル名変更: `OrderHeader` → `ExpenseHeader`、`OrderDetail` → `ExpenseDetail`
- カラーパレット変更:
  ```typescript
  const CATEGORY_COLORS = {
    '交通費': '#4CAF50',
    '会議費': '#2196F3',
    '備品費': '#FF9800',
    '通信費': '#9C27B0',
    'その他': '#757575'
  };
  ```
- UIラベル変更:
  - 「最新注文情報」→「最新経費精算」
  - 「注文ID」→「経費ID」
  - 「注文日」→「精算日」
  - 「注文数」→「経費件数」
  - 「総注文額」→「総経費額」
  - 「商品」→「明細」

**🆕 UI/UXルール適用**:
- ✅ ボタンに `minWidth: 44, minHeight: 44` を適用
- ✅ IconButtonに `aria-label` を追加
- ✅ ボタンに `variant` と `color` を明示
- ✅ 日付表示を `yyyy/MM/dd` 形式に統一
- ✅ 数値表示に `fontVariantNumeric: 'tabular-nums'` を適用（等幅数字）
- ✅ Chipに色+テキストで状態表示（色依存回避）
- ✅ エラー表示は原因→対処の構造

#### `src/components/OrderCategoryChart.tsx` → `src/components/ExpenseCategoryChart.tsx`
**変更内容**:
- ファイル名変更（リネーム）
- 型定義変更: `CategoryData` はそのまま（内容が変わるだけ）
- モデル名変更: `OrderHeader` → `ExpenseHeader`
- カラーパレット変更（LatestExpensesと同じ）
- UIラベル変更:
  - 「グッズ注文分析」→「経費カテゴリ別分析」
  - 「注文年」→「精算年」
  - 「注文月」→「精算月」
  - 「総注文」→「総経費」
  - 「総注文数」→「総件数」

**🆕 UI/UXルール適用**:
- ✅ ボタンに `minWidth: 44, minHeight: 44` を適用
- ✅ ボタンに `variant` と `color` を明示
- ✅ 数値表示に `fontVariantNumeric: 'tabular-nums'` を適用
- ✅ Chipに色+テキストで状態表示
- ✅ エラー表示に具体的な対処方法を記載

**🆕 Amplify Data Client ルール適用**:
- ✅ 初期表示で期間フィルターを適用（過去1ヶ月をデフォルト）
- ✅ `list()` を使用する場合は `filter` で期間を制限
- ✅ フルスキャン回避のため、以下の実装を追加:
  ```typescript
  // 初期フィルター設定: 過去1ヶ月
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  
  // データ取得時に期間フィルターを適用
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  
  const { data: expenses } = await client.models.ExpenseHeader.list({
    filter: { 
      expenseDate: { 
        ge: oneMonthAgo.toISOString().split('T')[0] // 過去1ヶ月以降
      } 
    }
  });
  ```

#### `src/components/OcrDataList.tsx`（削除または非使用化）
**変更内容**:
- 現在使用されているか確認
- 使用されていない場合は削除
- 使用されている場合は `ExpenseList.tsx` にリネーム・更新

#### `src/components/OcrDataList2.tsx`（削除または非使用化）
**変更内容**:
- 同上

#### `src/components/category-ec-links.tsx`
**変更内容**:
- 内容確認後、必要に応じて更新または削除

#### `src/App2.tsx`, `src/App3.tsx`
**変更内容**:
- 開発用ファイルの可能性があるため、確認後に削除または更新

---

## 🔄 改修手順

### Phase 1: バックエンド改修（データベース）
**所要時間**: 30分

1. ✅ `amplify/data/resource.ts` のスキーマ変更
2. ✅ 型定義の更新確認

**検証方法**:
- TypeScriptのコンパイルエラーがないことを確認

---

### Phase 2: バックエンド改修（Lambda関数）
**所要時間**: 45分

1. ✅ `amplify/functions/ocr/process-image-ocr.ts` のプロンプト変更
2. ✅ カテゴリ判定ロジック変更
3. ✅ 型定義と関数名変更
4. ✅ データベース保存処理の変更
5. ✅ `amplify/functions/ocr/resource.ts` の説明変更
6. ✅ `amplify/backend.ts` のコメント調整

**検証方法**:
- TypeScriptのコンパイルエラーがないことを確認

---

### Phase 3: フロントエンド改修（コンポーネント）
**所要時間**: 90分（UI/UXルール適用により+30分）

1. ✅ `LatestOrders.tsx` を `LatestExpenses.tsx` にリネーム・更新
2. ✅ `OrderCategoryChart.tsx` を `ExpenseCategoryChart.tsx` にリネーム・更新
3. ✅ カラーパレットの統一
4. ✅ 型定義とインポートの更新
5. ✅ UIラベルの全面変更
6. 🆕 **UI/UXルール適用**:
   - ボタンサイズ（minWidth/minHeight: 44px）
   - aria-label追加（IconButton）
   - variant/color明示（Button）
   - 日付フォーマット統一（yyyy/MM/dd）
   - 数値等幅表示（tabular-nums）
   - 色依存回避（Chip: 色+テキスト）
   - エラーメッセージ改善（原因→対処）
7. 🆕 **Amplify Data Client ルール適用**:
   - `ExpenseCategoryChart.tsx`に初期期間フィルター追加（過去1ヶ月）
   - `list()` 呼び出し時に `filter` で期間制限
   - フルスキャン回避の実装

**検証方法**:
- TypeScriptのコンパイルエラーがないことを確認
- アクセシビリティチェック（aria-label漏れなし）
- 日付・数値表示の統一確認
- 🆕 `list()` 呼び出しに `filter` が適用されていることを確認

---

### Phase 4: メインアプリ改修
**所要時間**: 15分

1. ✅ `src/App.tsx` の更新
   - タイトル変更
   - コンポーネントインポート変更
   - セクション名変更

**検証方法**:
- TypeScriptのコンパイルエラーがないことを確認

---

### Phase 5: 不要ファイルの整理
**所要時間**: 15分

1. ✅ `OcrDataList.tsx` の確認・削除または更新
2. ✅ `OcrDataList2.tsx` の確認・削除または更新
3. ✅ `App2.tsx`, `App3.tsx` の確認・削除
4. ✅ `category-ec-links.tsx` の確認・削除または更新

---

### Phase 6: デプロイと動作確認
**所要時間**: 30分

1. ✅ ローカルビルド確認
   ```bash
   npm run build
   ```

2. ✅ Amplifyサンドボックスのデプロイ
   ```bash
   npx ampx sandbox
   ```

3. ✅ 動作確認項目:
   - [ ] レシート画像のアップロード
   - [ ] OCR処理の実行
   - [ ] データベースへの保存
   - [ ] リアルタイム表示の確認
   - [ ] カテゴリフィルターの動作
   - [ ] 検索機能の動作
   - [ ] グラフ表示の確認
   - [ ] 期間フィルターの動作

---

## 📊 改修規模

| カテゴリ | ファイル数 | 変更行数（概算） |
|----------|------------|------------------|
| データベース | 1 | 50行 |
| Lambda関数 | 2 | 150行 |
| コンポーネント | 4 | 400行（🆕UI/UXルール適用+100行） |
| メインアプリ | 1 | 20行 |
| **合計** | **8** | **620行** |

### 🆕 UI/UXルール適用による追加作業
- ボタンスタイル調整: 約50行
- aria-label追加: 約20行
- 日付・数値フォーマット変更: 約30行

---

## ⚠️ リスクと対策

### リスク1: データベーススキーマ変更によるデータ損失
**対策**: 
- 既存データは新スキーマと互換性がないため、サンドボックス環境で完全にテスト後、本番デプロイ時は新規環境として構築
- 必要に応じてデータ移行スクリプトを作成

### リスク2: 型定義の不整合
**対策**:
- Phase 1完了後、`npm run build` で型エラーを確認
- 各Phaseごとに TypeScript コンパイルを確認

### リスク3: OCRの精度低下
**対策**:
- レシート特有の形式に対応したプロンプト調整
- テスト用レシート画像で動作確認

### リスク4: カテゴリ自動判定の精度
**対策**:
- AIプロンプトで明確な判定基準を提示
- テストケースを複数用意（コンビニ、タクシー、カフェ等）

---

## 🧪 テストケース

### 1. レシート種別テスト
- [ ] コンビニレシート → 「備品費」判定
- [ ] タクシー領収書 → 「交通費」判定
- [ ] カフェレシート → 「会議費」判定
- [ ] 郵便局レシート → 「通信費」判定
- [ ] 不明なレシート → 「その他」判定

### 2. 機能テスト
- [ ] リアルタイム更新が正常に動作
- [ ] カテゴリフィルターが正常に動作
- [ ] 期間フィルターが正常に動作
- [ ] 検索機能が正常に動作
- [ ] グラフが正確に表示
- [ ] 明細展開が正常に動作

### 3. UI/UXテスト
- [ ] カラーパレットが統一されている
- [ ] ラベルが適切に変更されている
- [ ] レスポンシブデザインが維持されている

### 🆕 4. アクセシビリティテスト（UI/UXルール準拠）
- [ ] すべてのIconButtonに `aria-label` が設定されている
- [ ] すべてのButtonに `variant` と `color` が明示されている
- [ ] ボタンの最小サイズが44×44pxである
- [ ] 日付表示が `yyyy/MM/dd` 形式に統一されている
- [ ] 数値表示が等幅フォント（tabular-nums）になっている
- [ ] Chipが色+テキストで状態を表現している（色依存なし）
- [ ] エラーメッセージが「原因→対処」の構造になっている
- [ ] IT用語が使われていない（分かりやすい日本語）
- [ ] 1画面に複数のPrimaryボタンがない
- [ ] コントラスト比が4.5:1以上である

### 🆕 5. Amplify Data Client ルールテスト
- [ ] `ExpenseCategoryChart.tsx`で初期表示時に期間フィルターが適用されている
- [ ] `list()` 呼び出しに `filter` パラメータが設定されている
- [ ] フルスキャンが発生していない（DynamoDBのスキャン回避）
- [ ] 「全期間」選択時のみ全件取得で、確認メッセージが表示される

---

## 📅 スケジュール

| Phase | 内容 | 所要時間 | 累計時間 |
|-------|------|----------|----------|
| Phase 1 | データベース改修 | 30分 | 30分 |
| Phase 2 | Lambda関数改修 | 45分 | 1時間15分 |
| Phase 3 | コンポーネント改修 + 🆕UI/UXルール適用 | 90分 | 2時間45分 |
| Phase 4 | メインアプリ改修 | 15分 | 3時間 |
| Phase 5 | ファイル整理 | 15分 | 3時間15分 |
| Phase 6 | デプロイ・動作確認 + アクセシビリティ検証 | 45分 | 4時間 |

**総所要時間**: 約4〜5時間（UI/UXルール適用により+1時間）

---

## 🚀 デプロイ手順

### 開発環境（サンドボックス）
```bash
# 1. 依存関係の確認
npm install

# 2. ビルド確認
npm run build

# 3. サンドボックス起動（※ユーザー確認後）
npx ampx sandbox

# 4. 動作確認
# ブラウザで http://localhost:5173 にアクセス
```

### 本番環境
```bash
# Amplify Hostingへのデプロイ
# Gitにプッシュ後、自動デプロイ
git add .
git commit -m "feat: 経費精算レシート管理システムへ移行"
git push origin main
```

---

## 📝 改修後の確認事項

### ✅ コード品質
- [ ] TypeScriptエラーなし
- [ ] ESLintエラーなし
- [ ] コンソールエラーなし

### ✅ 機能動作
- [ ] 全機能が正常動作
- [ ] リアルタイム更新が正常
- [ ] カテゴリ判定が適切

### ✅ UI/UX
- [ ] ラベルが適切
- [ ] カラーが統一
- [ ] レスポンシブ対応

---

## 📞 問い合わせ・エスカレーション

**改修中に問題が発生した場合**:
1. バックアップから復元を検討
2. 各Phaseごとにコミットを作成し、問題箇所を特定
3. 必要に応じて段階的ロールバック

---

## 🎯 成功基準

### 基本機能
1. ✅ すべての既存機能が正常動作
2. ✅ カテゴリが経費種別に変更されている
3. ✅ UIラベルが適切に変更されている
4. ✅ TypeScriptエラーが0件
5. ✅ テストケースが全て合格
6. ✅ レシート画像で正常にOCRが動作

### 🆕 UI/UXルール準拠
7. ✅ すべてのIconButtonに `aria-label` が設定されている
8. ✅ すべてのButtonに `variant` と `color` が明示されている
9. ✅ クリック可能な要素が44×44px以上である
10. ✅ 日付が `yyyy/MM/dd` 形式で統一されている
11. ✅ 数値が等幅フォントで表示されている
12. ✅ 色依存せずにステータスが判別できる
13. ✅ エラーメッセージが具体的で分かりやすい
14. ✅ IT用語を使わず一般的な日本語表現になっている

### 🆕 Amplify Data Client ルール準拠
15. ✅ `ExpenseCategoryChart.tsx`で初期期間フィルターが適用されている（過去1ヶ月）
16. ✅ `list()` 呼び出し時に `filter` パラメータが設定されている
17. ✅ フルスキャンが発生していない

---

**改修計画書 承認**: ________________  
**改修開始日時**: ________________  
**改修完了予定**: ________________

