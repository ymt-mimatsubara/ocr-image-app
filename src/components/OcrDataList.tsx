/**
 * OCRデータ一覧表示コンポーネント
 * 
 * このコンポーネントは以下の機能を提供します：
 * 1. データベースに保存されたOCRデータ（画像から抽出したテキスト）の一覧表示
 * 2. リアルタイムでデータの追加・削除を反映
 * 3. 各データの詳細表示・削除機能
 * 
 * 使用技術：
 * - React Hooks（useState, useEffect）
 * - AWS Amplify（クラウドデータベース）
 * - TypeScript（型安全性）
 */

import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

// ============================================================================
// 【1. 型定義】
// TypeScriptでデータの形を事前に定義することで、バグを防ぎます
// ============================================================================

// データベースのOcrDataテーブルの型を取得
// これにより、データベースの構造が変わってもコードが自動で追従します
type OcrDataType = Schema['OcrData']['type'];

// Amplifyデータベースに接続するクライアントを作成
// このクライアントを使ってデータの読み書きを行います
const client = generateClient<Schema>();

export default function OcrDataList() {
  // ============================================================================
  // 【2. State（状態管理）】
  // Reactでは、画面に表示するデータや状態をStateで管理します
  // ============================================================================
  
  // OCRデータの一覧を保存する配列
  // 初期値は空の配列[]で、データを取得次第更新されます
  const [ocrData, setOcrData] = useState<OcrDataType[]>([]);
  
  // 現在選択されている詳細表示用のアイテム
  // null = 一覧表示、データ = 詳細表示 という意味になります
  const [selectedItem, setSelectedItem] = useState<OcrDataType | null>(null);

  // ============================================================================
  // 【3. ユーティリティ関数】
  // 複雑な処理を小さな関数に分けて、理解しやすくします
  // ============================================================================
  
  /**
   * データベースの内容を読みやすいテキストに変換
   * 
   * データベースには複雑な形式で保存されているので、
   * 人間が読みやすい形に整形します
   * 
   * @param content - データベースから取得した生データ
   * @returns 整形された読みやすいテキスト
   */
  const parseContentAsText = (content: any): string => {
    // データが存在しない場合は「データなし」を表示
    if (!content) return 'データなし';
    
    // 文字列の場合は、JSON形式かどうかを確認
    if (typeof content === 'string') {
      try {
        // JSON文字列を解析して、きれいに整形
        const parsed = JSON.parse(content);
        return JSON.stringify(parsed, null, 2); // インデント付きで見やすく
      } catch {
        // JSON解析に失敗した場合は、そのまま返す
        return content;
      }
    }
    
    // オブジェクトの場合は、JSON形式で整形して返す
    return JSON.stringify(content, null, 2);
  };

  // ============================================================================
  // 【4. イベントハンドラー】
  // ユーザーの操作（ボタンクリックなど）に対応する関数群
  // ============================================================================
  
  /**
   * 詳細表示ボタンがクリックされたときの処理
   * 
   * 一覧表示から詳細表示に切り替えます
   * 
   * @param item - 詳細表示したいOCRデータ
   */
  const handleViewDetail = (item: OcrDataType) => {
    setSelectedItem(item); // 選択されたアイテムをStateに保存
  };

  /**
   * 戻るボタンがクリックされたときの処理
   * 
   * 詳細表示から一覧表示に戻ります
   */
  const handleCloseDetail = () => {
    setSelectedItem(null); // 選択を解除して一覧表示に戻る
  };

  // ============================================================================
  // 課題用の削除機能は以下に追加してください。
  // ============================================================================






  // ============================================================================
  // 【5. Effects（副作用）】
  // コンポーネントの外部と連携する処理（データベース接続など）
  // ============================================================================
  
  /**
   * コンポーネント起動時にデータベースとリアルタイム接続を開始
   * 
   * useEffectは、コンポーネントが画面に表示されたときに1回だけ実行されます
   * observeQueryを使うことで、既存データの取得とリアルタイム監視を同時に行います
   */
  useEffect(() => {
    // 【重要】observeQueryは2つの機能を持ちます：
    // 1. 最初に既存の全データを取得（observeQueryはデータ取得時にlist操作を行うため、DynamoDBのフルスキャン相当です
    // 大量データ or 明確なアクセスパターンがある場合は、データフェッチとサブスクリプションを個別に設定しましょう
    // 2. その後、データベースの変更をリアルタイムで監視
    const subscription = client.models.OcrData.observeQuery().subscribe({
      next: ({ items }) => {
        // 🔄 この関数は以下のタイミングで実行されます：
        // - 初回：既存データをすべて取得した直後
        // - 以降：データが追加・更新・削除されるたび
        
        // 新しい順（作成日時の降順）でソート
        const sortedItems = [...items].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        // 画面に表示するデータを更新
        setOcrData(sortedItems);
      }
    });

    // コンポーネントが画面から消えるときに、接続を切断
    // これを忘れるとメモリリークの原因になるので注意してください
    return () => subscription.unsubscribe();
  }, []); // 空の配列[] = コンポーネント起動時に1回だけ実行

  // ============================================================================
  // 【6. レンダリング（画面表示）】
  // 条件に応じて異なる画面を表示します
  // ============================================================================
  
  // 詳細表示モード：選択されたアイテムがある場合
  if (selectedItem) {
    return (
        <div>
        {/* ドキュメント名をタイトルとして表示 */}
        <h2>{selectedItem.documentname}</h2>

        {/* OCRで抽出されたテキスト内容を整形して表示 */}
        <div>
        <pre style={{ 
          maxWidth: '800px', 
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          overflowWrap: 'break-word'
        }}>{parseContentAsText(selectedItem.content)}</pre>
        </div>
        
        {/* 一覧表示に戻るボタン */}
        <button onClick={handleCloseDetail}>戻る</button>
        </div>
    );
  }

  // リスト表示モード：通常の一覧表示
  return (
    <>
      {/* 全てのOCRデータを順番に表示 */}
      {ocrData.map((item, index) => (
        <div key={item.documentid || `ocr-item-${index}`}>
          {/* ドキュメント名（なければ'Untitled'を表示） */}
          <span>{item.documentname || 'Untitled'}</span>
          
          {/* 詳細表示ボタン */}
          <button onClick={() => handleViewDetail(item)}>詳細</button>

        
          
        </div>
      ))}
    </>
  );
}