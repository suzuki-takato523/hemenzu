# 平面図アプリ - デバッグガイド

## 基本的なデバッグ手順

### 1. 開発者ツールを開く
- F12キーまたは右クリック→「検証」
- Consoleタブを選択

### 2. 基本操作テスト

#### テストパターン1: 基本的なundo順序
```
1. ペンで線を描く
2. 窓（opening）を作成
3. ペンで別の線を描く
4. undoボタンを3回押す
```
**期待結果:** 最後の線 → 窓 → 最初の線 の順で消える

#### テストパターン2: 消しゴム操作込み
```
1. ペンで線を描く
2. 消しゴムで一部を消す
3. 窓を作成
4. undoボタンを3回押す
```
**期待結果:** 窓 → 消しゴム操作復元 → 線削除

### 3. コンソールログでチェックするポイント

#### 操作時のログ
- `=== パス追加処理開始 ===` - 線描画時
- `開口部作成完了: operationHistory =` - 開口部作成時
- `消しゴム操作完了 - セグメント変更として記録` - 消しゴム使用時

#### Undo時のログ
- `=== UNDO実行 ===` - undo開始
- `操作履歴から最後の操作: [操作タイプ]` - 何をundoするか
- `=== [操作タイプ]UNDO完了 ===` - undo完了

#### 確認すべき値
```javascript
// 操作履歴の状態
operationHistory: ['path', 'opening', 'path']

// 履歴の長さ
allPathsLength: 線の数
openingsHistoryLength: 開口部履歴の数
segmentHistoryLength: セグメント履歴の数
```

### 4. 問題が起きた場合のチェックリスト

#### undo順序がおかしい場合
- [ ] `operationHistory`の内容が正しく記録されているか
- [ ] `operationHistory.pop()`が呼ばれているか
- [ ] 各操作で`operationHistory.push()`が呼ばれているか

#### 操作が記録されない場合
- [ ] `=== パス追加処理開始 ===`ログが出ているか
- [ ] `operationHistory.push()`が実行されているか
- [ ] `operationHistory`配列に値が追加されているか

#### undo/redoが動かない場合
- [ ] ボタンのイベントリスナーが重複していないか
- [ ] `boundHandlers`システムが正しく動作しているか
- [ ] エラーがコンソールに出ていないか

### 5. 高度なデバッグ

#### ブレークポイントを設定する場所
```javascript
// drawingCanvas.js内
1. undo()メソッドの最初
2. operationHistory.push()の直後
3. 各操作完了時（パス追加、開口部作成、セグメント変更）
```

#### 手動でのデバッグコマンド
```javascript
// コンソールで実行
// 現在の操作履歴を確認
window.drawingCanvas.operationHistory

// 各履歴の状態を確認
window.drawingCanvas.allPaths.length
window.drawingCanvas.openings.length
window.drawingCanvas.segmentHistory.length
```

### 6. 報告時に必要な情報

問題が見つかった場合、以下の情報を共有してください：

1. **操作手順**（具体的に）
2. **期待していた結果**
3. **実際の結果**
4. **コンソールログ**（関連部分をコピー）
5. **エラーメッセージ**（あれば）

### 7. よくある問題と解決方法

#### 問題: undoで複数の操作が同時に消える
- 原因: イベントリスナーの重複
- 解決: ページをリロードして再テスト

#### 問題: undo順序が逆
- 原因: 操作履歴の記録タイミング
- 確認: `operationHistory`の中身をチェック

#### 問題: 特定の操作がundoできない
- 原因: その操作が履歴に記録されていない
- 確認: その操作時のログを確認
