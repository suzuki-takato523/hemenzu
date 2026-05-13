# コードリファクタリング計画

## 現状
- drawingCanvas.js: 8,800行の巨大ファイル
- すべての機能が一つのクラスに集約

## 提案する分割構成

### 1. 描画エンジン関連
- `src/drawing/DrawingEngine.js` - 基本描画機能
- `src/drawing/ToolManager.js` - ツール管理
- `src/drawing/PathManager.js` - パス管理・履歴

### 2. 図形・幾何学計算
- `src/geometry/ShapeRecognizer.js` - 図形認識（既存）
- `src/geometry/AreaCalculator.js` - 面積計算
- `src/geometry/GeometryUtils.js` - 幾何学ユーティリティ

### 3. UI・イベント処理
- `src/ui/EventHandler.js` - マウス・タッチイベント
- `src/ui/TextBoxManager.js` - テキストボックス処理
- `src/ui/SelectionManager.js` - 選択・リサイズ処理

### 4. レンダリング
- `src/renderer/CanvasRenderer.js` - Canvas描画
- `src/renderer/GridRenderer.js` - グリッド描画
- `src/renderer/PreviewRenderer.js` - プレビュー表示

## 分割のメリット
1. **保守性向上** - 各機能が独立してテスト・修正可能
2. **開発効率** - 複数人での並行開発が容易
3. **再利用性** - 他のプロジェクトでも利用可能
4. **可読性** - 各ファイルが特定の責任を持つ

## 分割のデメリット
1. **初期コスト** - リファクタリングに時間がかかる
2. **複雑性** - ファイル数が増える
3. **依存管理** - モジュール間の依存関係の管理が必要

## 推奨アプローチ
現在のプロジェクトでは、機能追加時に段階的に分割することを推奨：
1. 新機能は別ファイルで作成
2. 既存の大きな機能塊を徐々に分離
3. テストを書きながら安全にリファクタリング
