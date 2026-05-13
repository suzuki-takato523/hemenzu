# 平面図描画アプリ - 技術仕様書

## アーキテクチャ概要

### 技術スタック
- **フロントエンド**: Vanilla JavaScript (ES6+)
- **ビルドツール**: Vite v7.0.6
- **UI**: HTML5 Canvas API
- **PWA**: Service Worker対応
- **レスポンシブ**: CSS Grid & Flexbox

### ファイル構成
```
heimenzukei/
├── src/
│   ├── main.js           # メイン制御
│   ├── drawingCanvas.js  # 描画エンジン (6900+ lines)
│   ├── shapeRecognizer.js # 図形認識
│   ├── toolManager.js    # ツール管理
│   └── style.css         # スタイル定義
├── public/
│   ├── manifest.json     # PWA設定
│   └── sw.js            # Service Worker
└── index.html           # エントリーポイント
```

## 主要クラス・モジュール

### DrawingCanvas クラス
**ファイル**: `src/drawingCanvas.js`  
**責務**: 描画エンジンのコア機能

#### 主要プロパティ
```javascript
class DrawingCanvas {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.allPaths = [];           // 描画パス配列
    this.segmentHistory = [];     // セグメント削除履歴
    this.redoStack = [];          // Redo履歴
    this.currentTool = 'pen';     // 現在選択ツール
    this.scale = 1.0;             // ズーム倍率
    this.offsetX = 0;             // X軸オフセット
    this.offsetY = 0;             // Y軸オフセット
  }
}
```

#### 重要メソッド
- `startDrawing()`: 描画開始処理
- `draw()`: 描画中処理  
- `stopDrawing()`: 描画終了処理
- `eraseAtPoint()`: 消しゴム処理
- `undo()`/`redo()`: 操作履歴管理
- `saveLineSegmentState()`: セグメント状態保存
- `restoreLineSegmentState()`: セグメント状態復元

### ToolManager
**ファイル**: `src/toolManager.js`  
**責務**: ツール切り替えとUI制御

### ShapeRecognizer  
**ファイル**: `src/shapeRecognizer.js`  
**責務**: フリーハンド図形の自動認識・整形

## 描画システム

### Canvas座標系
```javascript
// 画面座標 → Canvas座標変換
const canvasCoords = {
  x: (screenX - this.offsetX) / this.scale,
  y: (screenY - this.offsetY) / this.scale
};
```

### パス管理構造
```javascript
const pathData = {
  tool: 'line',              // ツール種別
  path: [[x1,y1], [x2,y2]], // 座標配列
  strokeWidth: 4,            // 線幅
  strokeColor: '#000000',    // 色
  startPoint: {x, y},        // 開始点
  endPoint: {x, y},          // 終了点
  // ツール固有プロパティ
  lineStyle: 'solid',        // 線スタイル
  doorType: 'opening',       // 扉種別
  text: 'sample'             // テキスト内容
};
```

### セグメント削除システム

#### グリッドベース検索
```javascript
// 0.5グリッド単位（80px）での線分分割
const HALF_GRID_SIZE = 80;

getLineSegmentsHalfGrid(pathData) {
  // 線分を80px単位で分割
  // 消しゴムとの当たり判定用
}
```

#### セグメント履歴管理
```javascript
const segmentChange = {
  pathIndex: 0,                    // 対象パスインデックス  
  originalSegments: [...],         // 削除前セグメント
  newSegments: [...],             // 削除後セグメント
  originalPath: {...},            // 元パス情報
  newPathsCount: 3,               // 分割後パス数
  eraserOperationChanges: [...]   // 消しゴム操作詳細
};
```

## Undo/Redo システム

### 操作タイプ管理
```javascript
this.lastOperationType = 'path' | 'segment' | 'opening';
```

### Undo優先順位
1. **Segment操作**: 消しゴムでの部分削除
2. **Opening操作**: 開口部の追加・削除  
3. **Path操作**: 通常の描画・削除

### 消しゴムUndoの流れ
```
描画 → 消しゴム → Undo流れ:
1. 四角形4辺描画 (lastOperationType='path')
2. 消しゴムで1辺削除 (segmentHistory追加, lastOperationType='segment') 
3. Undo実行 → セグメント復元 (lastOperationType='path'に変更)
4. 次のUndo → 通常パス削除 (4辺目から削除)
```

## イベント処理

### マルチデバイス対応
```javascript
// マウス + タッチ イベント統合
canvas.addEventListener('mousedown', this.startDrawing.bind(this));
canvas.addEventListener('touchstart', this.startDrawing.bind(this));

// 座標正規化
getEventCoordinates(event) {
  if (event.touches) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  return { x: event.clientX, y: event.clientY };
}
```

### パフォーマンス最適化
```javascript
const PERFORMANCE_CONFIG = {
  DEBOUNCE_DELAY: 16,              // ~60FPS
  OPTIMIZATION_THRESHOLD: 100,      // 自動最適化閾値
  MAX_UNDO_STACK_SIZE: 50          // Undo履歴上限
};
```

## PWA機能

### Service Worker
```javascript
// キャッシュ戦略
const CACHE_NAME = 'heimenzukei-v1';
const urlsToCache = [
  '/',
  '/src/main.js',
  '/src/drawingCanvas.js',
  // ...
];
```

### Manifest設定
```json
{
  "name": "平面図描画アプリ",
  "short_name": "HeimensZukei", 
  "display": "standalone",
  "orientation": "any",
  "theme_color": "#ffffff"
}
```

## デバッグ・ログ

### 主要ログポイント
```javascript
// 操作履歴
console.log('Undo実行前の状態:', {
  allPathsLength,
  segmentHistoryLength,
  lastOperationType
});

// セグメント操作
console.log('セグメント状態を保存:', {
  pathIndex,
  originalSegmentsCount,
  newSegmentsCount
});

// パフォーマンス
console.log('描画パフォーマンス:', {
  pathsCount,
  renderTime,
  scale
});
```

## 拡張・カスタマイズ

### 新ツール追加手順
1. `toolManager.js` にツール定義追加
2. `drawingCanvas.js` に描画ロジック実装
3. UI要素を `index.html` に追加
4. スタイルを `style.css` に定義

### 新図形認識追加
1. `shapeRecognizer.js` に認識ロジック追加
2. 閾値とパラメータ調整
3. テストケース作成

## セキュリティ・制限

### XSS対策
- ユーザー入力のサニタイゼーション
- innerHTML使用時のエスケープ処理

### リソース制限
- Canvas最大サイズ: 4096x4096px
- 最大パス数: 1000個
- 最大Undo履歴: 50回

## ブラウザ互換性

### 対応ブラウザ
- Chrome 88+
- Firefox 85+  
- Safari 14+
- Edge 88+

### 必須API
- Canvas 2D Context
- Touch Events
- File API (保存機能)
- Service Worker (PWA)

## ビルド・デプロイ

### 開発環境起動
```bash
npm install
npm run dev
```

### プロダクションビルド
```bash
npm run build
npm run preview
```

### デプロイ先
- GitHub Pages
- Netlify
- Vercel
- 任意の静的ホスティング

---

**最終更新**: 2025年8月26日  
**API Version**: 1.0  
**対応ブラウザ**: Modern browsers supporting ES6+
