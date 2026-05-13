import {
  distanceToLine,
  distanceToLineSegment,
  isPointNearLineSegmentImproved,
  isPointNearLineSegment,
  isPointNearRectangle,
  isPointNearCircle,
  getArrowHeadRegion,
  isPointInArrowHead,
  isSegmentInArrowHead,
  createLineFromSegments,
  calculatePolylineLength,
} from './canvas/geometry.js';
import { pdfRendererMethods } from './canvas/pdfRenderer.js';
import { exportMethods } from './canvas/export.js';
import { backgroundImageMethods } from './canvas/backgroundImage.js';
import { textBoxMethods } from './canvas/textBox.js';

// 定数定義
const PERFORMANCE_CONFIG = {
  DEBOUNCE_DELAY: 16, // 約60FPS
  REDRAW_DEBOUNCE: 8,  // 再描画のデバウンス時間
  MAX_PATH_POINTS: 1000, // パスの最大ポイント数
  OPTIMIZATION_THRESHOLD: 50, // パス最適化を実行するしきい値（より頻繁に実行）
  MAX_HISTORY_SIZE: 50 // アンドゥ/リドゥ履歴の最大数（メモリリーク防止）
};

const DRAWING_CONFIG = {
  GRID_SIZE: 20,
  DEFAULT_STROKE_WIDTH: 2,
  DEFAULT_STROKE_COLOR: '#000000',
  ERASER_MIN_SIZE: 5,
  ERASER_MAX_SIZE: 50
};

// デバッグモード（開発時のみtrue）
const DEBUG_MODE = false; // 本番環境ではfalseに設定

// デバッグログ用ヘルパー
const debugLog = (...args) => {
  if (DEBUG_MODE) {
    console.log(...args);
  }
};

const debugError = (...args) => {
  if (DEBUG_MODE) {
    console.error(...args);
  }
};

const debugWarn = (...args) => {
  if (DEBUG_MODE) {
    console.warn(...args);
  }
};

/**
 * 描画キャンバスクラス
 * タッチペン対応の描画機能を提供
 */
export class DrawingCanvas {
  // イベントハンドラー削除メソッド（インスタンス破棄時に使用）
  removeAllEventListeners() {
    console.error('イベントハンドラーを削除中...');
    // マウスイベント
    this.canvas.removeEventListener('mousedown', this.mouseDownHandler);
    this.canvas.removeEventListener('mousemove', this.mouseMoveHandler);
    this.canvas.removeEventListener('mouseup', this.mouseUpHandler);
    this.canvas.removeEventListener('mouseleave', this.mouseLeaveHandler);
    this.canvas.removeEventListener('wheel', this.wheelHandler);
    
    // タッチイベント
    this.canvas.removeEventListener('touchstart', this.touchStartHandler);
    this.canvas.removeEventListener('touchmove', this.touchMoveHandler);
    this.canvas.removeEventListener('touchend', this.touchEndHandler);
    this.canvas.removeEventListener('touchcancel', this.touchCancelHandler);
    
    // キーボードイベント
    document.removeEventListener('keydown', this.keyDownHandler);
    document.removeEventListener('keyup', this.keyUpHandler);
    
    // コンテキストメニュー
    this.canvas.removeEventListener('contextmenu', this.contextMenuHandler);
    
    console.error('イベントハンドラー削除完了');
  }

  constructor(canvasSelector) {
    this.canvas = document.querySelector(canvasSelector);
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.isDrawing = false;
    this.currentPath = [];
    this.allPaths = [];
    this.redoStack = [];
    // セグメント変更のundo/redo管理
    this.segmentHistory = []; // セグメント変更の履歴
    this.segmentRedoStack = []; // セグメント変更のredo履歴
    
    // 消しゴム操作の専用undo/redo管理
    this.eraserHistory = []; // 消しゴム操作の履歴
    this.eraserRedoStack = []; // 消しゴム操作のredo履歴
    
    // 統合操作履歴（最後の操作タイプを追跡）
    this.lastOperationType = null; // 'path', 'segment', 'eraser'
    this.strokeWidth = 2;
    this.penWidth = 2; // ペン専用の太さ
    this.eraserSize = 30; // 消しゴムサイズ（独立して設定可能）- デフォルトを30に
    this.strokeColor = this.getDefaultStrokeColor(); // ダークモード対応のデフォルト色
    this.currentTool = 'pen';
    this.lineStyle = 'solid'; // 線スタイル: 'solid', 'dashed', 'arrow'
    this.doorType = 'smallbox'; // 建具の種類（初期値：開口部）
    this.doorWidth = 75; // 扉の幅（0.25マス単位: 3.75マス = 75px）
    this.openingSize = 'half'; // 開口部サイズ: 'quarter'(0.25マス), 'half'(0.5マス), 'one'(1マス)
    
    // 消しゴム操作の管理
    this.eraserOperationActive = false;
    this.eraserOperationChanges = [];
    this.eraserOperationStartSnapshot = null; // 消しゴム操作開始時のスナップショット
    this.eraserClickProcessed = false; // クリック重複防止フラグ
    this.isEraserPressed = false; // 消しゴムボタンが押されているかのフラグ
    
    // グリッドサイズを先に設定
    this.gridSize = 160; // グリッドサイズをさらに大きくして見やすく
    
    // 階段設定（gridSizeが設定された後に実行）
    this.stairSteps = 10; // 固定段数
    this.stairWidth = this.gridSize * 1; // 階段の横線長さ（デフォルト1マス = 160px）
    this.stairType = 'straight'; // 階段の種類: 'straight'(直線), 'l-shape'(L字), 'spiral'(螺旋)
    console.log(`初期化: gridSize=${this.gridSize}px, 初期stairWidth=${this.stairWidth}px`);
    
    // 塗りつぶし設定
    this.fillPattern = 'solid'; // 'solid' or 'diagonal'
    this.fillSize = 'half'; // 'quarter' (0.25マス), 'half' (0.5マス), 'one' (1マス)
    
    this.startPoint = null;
    this.previewEndPoint = null; // プレビュー用の終点
    this.firstMovePoint = null; // 最初に動いた方向を記録（L字階段用）
    this.showShapePreview = false; // 図形プレビュー表示フラグ
    this.eventListeners = {};
    this.snapToGrid = true;
    this.isShiftPressed = false;
    this.textInput = null;
    this.fontSize = 48; // 初期文字サイズを48pxに変更（32pxから2段階アップ）
    this.selectedTextBox = null;
    this.isResizing = false;
    this.resizeHandle = null;
    this.handleSize = 8; // ハンドルサイズを小さく調整
    this.isDraggingTextBox = false;
    this.dragOffset = { x: 0, y: 0 };
    this.lastClickTime = 0; // ダブルクリック検出用
    this.showEraserPreview = false;
    this.eraserPreviewCoords = null;
    
    // パフォーマンス最適化
    this.isRedrawing = false; // 再描画中フラグ
    this.redrawRequested = false; // 再描画要求フラグ
    this.lastRedrawTime = 0; // 最後の再描画時刻
    this.redrawThrottleMs = 8; // 125FPS相当（約8ms）に変更して応答性を向上
    this.mouseMoveThrottleMs = 4; // マウス移動の間引き（250FPS相当）
    this.lastMouseMoveTime = 0;
    this.lastDragMoveTime = 0; // テキストボックスドラッグ用の間引き
    
    this.touchPreviewTimer = null; // タッチプレビュー用タイマー
    this.isShowingTouchPreview = false; // タッチプレビュー状態
    this.isMultiTouch = false; // マルチタッチ検出フラグ
    this.multiTouchCooldown = false; // マルチタッチ終了後のクールダウン
    this.lastMultiTouchTime = 0; // 最後のマルチタッチ時刻（シンプル化）
    
    // ズーム関連
    // デバイスに応じた初期ズームレベルを設定
    this.scale = this.getInitialScale();
    this.minScale = 0.1;
    this.maxScale = 5;
    this.translateX = 0;
    this.translateY = 0;
    this.lastPinchDistance = 0;
    this.isPinching = false;
    this.pinchCenter = { x: 0, y: 0 };
    this.lastPanPoint = null; // 二本指パン用
    
    // スペースキー+ドラッグでのパン機能
    this.isSpacePressed = false;
    this.isPanning = false;
    this.panStartPoint = null;

    // 背景画像（PDF/PNG/JPG を下絵として表示）
    this.backgroundImage = null;
    this.backgroundImageOpacity = 0.4;
    this.backgroundImageScale = 1.0;       // 大きさ倍率（1.0 = 元のサイズ）
    this.backgroundImageOffsetX = 0;        // 横位置オフセット（ワールド座標）
    this.backgroundImageOffsetY = 0;        // 縦位置オフセット（ワールド座標）
    this.backgroundImageRotation = 0;       // 回転（ラジアン）

    this.initCanvas();
    this.setupEventListeners();
  }

  // 出力範囲（PDF/画像/Excel 出力時にキャプチャされる領域）を表示する破線枠
  // PDFや画像・Excel出力で使う 34×44マス、原点中心の範囲と同じ
  drawExportBounds() {
    if (this.showExportBounds === false) return;

    const widthGridUnits = 34;
    const heightGridUnits = 44;
    const w = widthGridUnits * this.gridSize;
    const h = heightGridUnits * this.gridSize;
    const x = -w / 2;
    const y = -h / 2;

    this.ctx.save();
    this.ctx.strokeStyle = '#ff7a1f'; // オレンジ
    this.ctx.lineWidth = 3 / this.scale;
    this.ctx.setLineDash([16 / this.scale, 10 / this.scale]);
    this.ctx.strokeRect(x, y, w, h);
    this.ctx.setLineDash([]);

    // 角に小さなラベル（出力範囲）
    const fontPx = 22 / this.scale;
    this.ctx.font = `bold ${fontPx}px "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif`;
    this.ctx.fillStyle = '#ff7a1f';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText('出力範囲', x + 8 / this.scale, y - 6 / this.scale);

    this.ctx.restore();
  }

  // 背景画像（下絵）の制御メソッド群は canvas/backgroundImage.js に抽出済み
  // （Object.assign で prototype に注入される）

  // デバイスに応じた初期ズームレベルを取得
  getInitialScale() {
    // タッチデバイス（タブレット・スマホ）の判定
    const isTouchDevice = (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0
    );
    
    // 画面サイズも考慮（タブレットは通常768px以上）
    const isTabletSize = window.innerWidth >= 768;
    
    if (isTouchDevice && isTabletSize) {
      // タブレット: 近めの表示（描画しやすい）
      return 0.7;
    } else if (isTouchDevice) {
      // スマホ: 中間
      return 0.5;
    } else {
      // PC: 遠めの表示（全体が見やすい）
      return 0.35;
    }
  }

  initCanvas() {
    // キャンバスの設定
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.fillStyle = this.strokeColor;
    this.ctx.lineWidth = this.strokeWidth;
    
    // アンチエイリアシングを無効化して線をくっきり表示
    this.ctx.imageSmoothingEnabled = false;
    
    // 高DPI対応
    this.setupHighDPI();
    
    // 初期カーソル設定
    this.updateCursor();
    
    // 初期グリッド描画
    this.redrawCanvas();
    
  }

  setupHighDPI() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    // 現在の描画内容を保存
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    // contextを新しく取得してスケールを設定
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.ctx.scale(dpr, dpr);
    
    // 初期位置を中心に設定（初回のみ）
    if (this.translateX === 0 && this.translateY === 0) {
      this.translateX = this.canvas.width / 2;
      this.translateY = this.canvas.height / 2;
    }
    
    // キャンバスの基本設定を再適用
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.fillStyle = this.strokeColor;
    this.ctx.lineWidth = this.strokeWidth;
    
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    
    // グリッドを再描画
    this.redrawCanvas();
  }

  setupEventListeners() {
    // キーボードイベント（スペースキーでパンモード）
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this.isSpacePressed) {
        this.isSpacePressed = true;
        if (!this.isDrawing && !this.isDraggingTextBox && !this.isResizing) {
          this.canvas.style.cursor = 'grab';
        }
      }
    });
    
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        this.isPanning = false;
        this.panStartPoint = null;
        this.canvas.style.cursor = 'default';
      }
    });
    
    // マウスイベント
    this.canvas.addEventListener('mousedown', (e) => {
      console.log('🖱️ mousedown: isShiftPressed =', this.isShiftPressed, ', isSpacePressed =', this.isSpacePressed);
      
      // Shiftキーが押されている場合、テキストボックスをクリックしているかチェック
      if (this.isShiftPressed) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.translateX) / this.scale;
        const y = (e.clientY - rect.top - this.translateY) / this.scale;
        const clickedTextBox = this.getTextBoxAt({ x, y });
        
        if (clickedTextBox) {
          // テキストボックスをクリックした場合は、startDrawingに任せる
          console.log('✅ テキストボックスをShift+クリック、移動モードへ');
          this.startDrawing(e);
          return;
        }
      }
      
      // スペースキーまたはShiftキーが押されている場合はパン操作
      if (this.isSpacePressed || this.isShiftPressed) {
        console.log('✅ パン操作開始');
        this.isPanning = true;
        this.panStartPoint = { x: e.clientX, y: e.clientY };
        this.canvas.style.cursor = 'grabbing';
        return;
      }
      console.log('❌ 通常の描画処理へ');
      // テキストボックスツール時もstartDrawingを呼ぶ（編集・移動・選択のため）
      this.startDrawing(e);
    });
    this.canvas.addEventListener('mousemove', (e) => {
      // パン操作中
      if (this.isPanning && this.panStartPoint) {
        const dx = e.clientX - this.panStartPoint.x;
        const dy = e.clientY - this.panStartPoint.y;
        this.translateX += dx;
        this.translateY += dy;
        this.panStartPoint = { x: e.clientX, y: e.clientY };
        this.redrawCanvas();
        return;
      }
      
      // テキストボックスツール時もdrawを呼ぶ（移動処理のため）
      if (this.currentTool === 'text-horizontal' || this.currentTool === 'text-vertical') {
        this.updateCursorForPosition(e);
        this.draw(e);
        return;
      }
      if (!this.isDrawing && !this.isDraggingTextBox && !this.isResizing) {
        this.updateCursorForPosition(e);
      }
      // 消しゴムプレビューの更新
      if (this.currentTool === 'eraser') {
        this.updateEraserPreview(e);
      } else {
        this.showEraserPreview = false;
      }
      this.draw(e);
    });
    this.canvas.addEventListener('mouseup', (e) => {
      // パン操作終了
      if (this.isPanning) {
        this.isPanning = false;
        this.panStartPoint = null;
        if (this.isSpacePressed) {
          this.canvas.style.cursor = 'grab';
        }
        return;
      }
      
      if (this.currentTool === 'eraser' && this.isEraserPressed) {
        this.stopEraserOperation();
      }
      this.stopDrawing(e);
    });
    
    // 消しゴム専用のマウスダウンイベント（ボタンを押したときに消去開始）
    this.canvas.addEventListener('mousedown', (e) => {
      // Shiftキーまたはスペースキーが押されている場合はスキップ
      if (this.isShiftPressed || this.isSpacePressed) {
        return;
      }
      if (this.currentTool === 'eraser') {
        this.startEraserOperation(e);
      }
    });
    
    // 削除：テキストボックスツール時の特別処理は不要
    // 全ツールでstopDrawingを呼び、テキストボックス操作の完了処理を行う
    
    // マウスがキャンバスから離れたときの処理
    this.canvas.addEventListener('mouseleave', () => {
      this.showEraserPreview = false;
      this.redrawCanvas();
    });
    
    // ズーム機能（PC用：マウスホイール）
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // ズーム倍率を計算（より細かい制御）
      const zoomIntensity = 0.05; // 0.1から0.05に変更してより滑らかに
      const delta = e.deltaY < 0 ? 1 : -1;
      const zoom = Math.exp(delta * zoomIntensity);
      
      this.zoomAt(mouseX, mouseY, zoom);
    });
    
    // タッチイベント（シンプル化）
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      
      if (e.touches.length === 2) {
        // ピンチジェスチャー開始
        this.isPinching = true;
        this.isMultiTouch = true;
        this.lastMultiTouchTime = Date.now();
        this.lastPinchDistance = this.getPinchDistance(e.touches);
        this.pinchCenter = this.getPinchCenter(e.touches);
        this.lastPanPoint = this.getPinchCenter(e.touches);
        console.log('ピンチジェスチャー開始');
      } else if (e.touches.length === 1 && !this.isPinching && !this.multiTouchCooldown) {
        // 通常のタッチ描画
        this.startDrawing(e.touches[0]);
      }
    });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      
      if (e.touches.length === 2 && this.isPinching) {
        // ピンチジェスチャー処理
        const currentDistance = this.getPinchDistance(e.touches);
        const currentCenter = this.getPinchCenter(e.touches);
        
        // ズーム処理
        if (this.lastPinchDistance > 0) {
          const zoom = currentDistance / this.lastPinchDistance;
          this.zoomAt(currentCenter.x, currentCenter.y, zoom);
        }
        
        // パン（移動）処理
        if (this.lastPanPoint) {
          const dx = currentCenter.x - this.lastPanPoint.x;
          const dy = currentCenter.y - this.lastPanPoint.y;
          this.translateX += dx;
          this.translateY += dy;
          this.redrawCanvas();
        }
        
        this.lastPinchDistance = currentDistance;
        this.pinchCenter = currentCenter;
        this.lastPanPoint = currentCenter;
      } else if (e.touches.length === 1 && !this.isPinching && !this.multiTouchCooldown) {
        // 通常の1本指移動
        if (!this.isDrawing && !this.isDraggingTextBox && !this.isResizing) {
          this.updateCursorForPosition(e.touches[0]);
        }
        
        // 消しゴムプレビューの更新（タッチデバイス用）
        if (this.currentTool === 'eraser') {
          this.updateEraserPreview(e.touches[0]);
        } else {
          this.showEraserPreview = false;
        }
        
        this.draw(e.touches[0]);
      }
    });
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      
      if (e.touches.length < 2) {
        this.isPinching = false;
        this.lastPinchDistance = 0;
        this.lastPanPoint = null;
        
        // 全てのタッチが終了した場合、短いクールダウンを開始
        if (e.touches.length === 0 && this.isMultiTouch) {
          console.log('全タッチ終了 - シンプルクールダウン開始');
          this.multiTouchCooldown = true;
          this.isMultiTouch = false;
          this.lastMultiTouchTime = Date.now();
          
          // 短いクールダウン時間（200ms）
          setTimeout(() => {
            this.multiTouchCooldown = false;
            console.log('クールダウン終了 - 描画再開可能');
          }, 200);
        }
      }
      
      if (e.touches.length === 0 && !this.multiTouchCooldown) {
        // 消しゴム終了処理を先に実行
        if (this.currentTool === 'eraser' && this.isEraserPressed) {
          this.stopEraserOperation();
        }
        
        this.stopDrawing(e.changedTouches[0]);
        // 全てのタッチが終了した時に消しゴムプレビューをクリア
        if (this.currentTool === 'eraser') {
          this.showEraserPreview = false;
          this.eraserPreviewCoords = null;
          this.cancelTouchEraserPreview();
          this.redrawCanvas();
        }
      }
    });
    
    // タッチがキャンバスから離れたときの処理
    this.canvas.addEventListener('touchcancel', () => {
      this.cancelTouchEraserPreview();
      this.showEraserPreview = false;
      this.isPinching = false;
      this.redrawCanvas();
    });
    
    // タッチ用の消しゴムタッチスタートイベント（タッチ開始時に消去開始）
    this.canvas.addEventListener('touchstart', (e) => {
      // Shiftキーまたはスペースキーが押されている場合はスキップ
      if (this.isShiftPressed || this.isSpacePressed) {
        return;
      }
      if (this.currentTool === 'eraser' && e.touches.length === 1 && !this.multiTouchCooldown) {
        // シングルタッチの場合のみ消しゴム開始
        this.startEraserOperation(e.touches[0]);
      }
    });
    
    // キーボードイベント（Shiftキー用）
    this.isShiftPressed = false;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') {
        this.isShiftPressed = true;
        console.log('🔑 Shiftキー押下検出: isShiftPressed =', this.isShiftPressed);
        if (!this.isDrawing && !this.isDraggingTextBox && !this.isResizing) {
          this.canvas.style.cursor = 'grab';
        }
        this.updateCursor();
        this.canvas.classList.add('shift-mode');
        
        // Shiftインジケーターを表示
        const indicator = document.getElementById('shift-indicator');
        if (indicator) {
          indicator.classList.add('active');
        }
      }
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') {
        this.isShiftPressed = false;
        console.log('🔑 Shiftキー離した: isShiftPressed =', this.isShiftPressed);
        this.isPanning = false;
        this.panStartPoint = null;
        this.canvas.style.cursor = 'default';
        this.updateCursor();
        this.canvas.classList.remove('shift-mode');
        
        // Shiftインジケーターを非表示
        const indicator = document.getElementById('shift-indicator');
        if (indicator) {
          indicator.classList.remove('active');
        }
      }
    });
    
    // コンテキストメニューを無効化
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  getCoordinates(event) {
    const rect = this.canvas.getBoundingClientRect();
    let x, y;
    
    // タッチイベントの場合とマウスイベントの場合を分岐
    if (event.touches && event.touches.length > 0) {
      // タッチイベント（iPad等）
      x = event.touches[0].clientX - rect.left;
      y = event.touches[0].clientY - rect.top;
    } else if (event.changedTouches && event.changedTouches.length > 0) {
      // タッチ終了イベント
      x = event.changedTouches[0].clientX - rect.left;
      y = event.changedTouches[0].clientY - rect.top;
    } else {
      // マウスイベント（PC）
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    }
    
    // 高DPI対応
    const dpr = window.devicePixelRatio || 1;
    x *= dpr;
    y *= dpr;
    
    // ズーム・パン変換を適用（座標を世界座標系に変換）
    x = (x - this.translateX) / this.scale;
    y = (y - this.translateY) / this.scale;
    
    // グリッドスナップ機能（テキストツール、消しゴムツール、塗りつぶしツールは除外）
    if (this.snapToGrid) {
      // ペンツール、テキストツール、消しゴムツール、塗りつぶしツール以外はグリッドにスナップ
      if (this.currentTool !== 'pen' && 
          this.currentTool !== 'text-horizontal' && 
          this.currentTool !== 'text-vertical' &&
          this.currentTool !== 'eraser' &&
          this.currentTool !== 'fill') {
        
        // 扉ツールと階段ツールの場合は0.25マス（クォーターグリッド）にスナップ
        if (this.currentTool === 'door' || this.currentTool === 'stairs') {
          const quarterGrid = this.gridSize / 4;
          x = Math.round(x / quarterGrid) * quarterGrid;
          y = Math.round(y / quarterGrid) * quarterGrid;
        }
        // 直線ツール（全スタイル）は0.25マス（クォーターグリッド）にスナップ
        else if (this.currentTool === 'line') {
          const quarterGrid = this.gridSize / 4;
          x = Math.round(x / quarterGrid) * quarterGrid;
          y = Math.round(y / quarterGrid) * quarterGrid;
        }
        // グリッド連続直線ツールは0.5マススナップ
        else if (this.currentTool === 'polyline-grid') {
          const halfGrid = this.gridSize / 2;
          x = Math.round(x / halfGrid) * halfGrid;
          y = Math.round(y / halfGrid) * halfGrid;
        }
        // 四角モードの場合は半マス（グリッドサイズの半分）にスナップ
        else if (this.currentTool === 'rectangle') {
          const halfGrid = this.gridSize / 2;
          x = Math.round(x / halfGrid) * halfGrid;
          y = Math.round(y / halfGrid) * halfGrid;
        } else {
          // その他の図形は通常のグリッドにスナップ
          x = Math.round(x / this.gridSize) * this.gridSize;
          y = Math.round(y / this.gridSize) * this.gridSize;
        }
      }
    }
    
    return { x, y };
  }

  startDrawing(event) {
    
    // 描画設定を確実に適用（色変更が反映されるように）
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.fillStyle = this.strokeColor;
    this.ctx.lineWidth = this.strokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    // シンプルなマルチタッチ検出
    if (event.touches && event.touches.length > 1) {
      this.isMultiTouch = true;
      this.lastMultiTouchTime = Date.now();
      console.log('マルチタッチ検出 - 描画無効化');
      return;
    }
    
    // シンプルなクールダウンチェック
    if (this.multiTouchCooldown) {
      console.log('クールダウン中のため描画をスキップ');
      return;
    }
    
    // マルチタッチ中は描画しない
    if (this.isMultiTouch) {
      console.log('マルチタッチ中のため描画をスキップ');
      return;
    }
    
    // タッチデバイスで消しゴムツールの場合、プレビューを表示
    if (this.currentTool === 'eraser' && event.type && event.type.includes('touch')) {
      this.startTouchEraserPreview(event);
      return;
    }
    
    // アクティブなテキスト入力がある場合は完了させる
    if (this.textInput && this.textInput.parentNode) {
      console.log('既存のテキスト入力を完了します');
      this.finishTextInput();
    }
    
    const coords = this.getCoordinates(event);
    
    // 【全ツール共通】テキストボックス操作を最優先で処理
    // 最優先：選択中のテキストボックスのリサイズハンドルをチェック
    if (this.selectedTextBox) {
      const resizeHandle = this.getResizeHandle(coords, this.selectedTextBox);
      if (resizeHandle) {
        console.log('選択中テキストボックスのリサイズハンドルをクリック:', resizeHandle);
        this.isResizing = true;
        this.resizeHandle = resizeHandle;
        this.dragOffset = { x: coords.x, y: coords.y };
        this.redrawCanvas();
        return;
      }
    }
    
    // 次に優先：他のテキストボックスのリサイズハンドルをチェック
    for (let i = this.allPaths.length - 1; i >= 0; i--) {
      const pathData = this.allPaths[i];
      if (pathData.tool === 'textbox' && pathData !== this.selectedTextBox) {
        const resizeHandle = this.getResizeHandle(coords, pathData);
        if (resizeHandle) {
          console.log('他のテキストボックスのリサイズハンドルをクリック:', resizeHandle);
          // テキストボックスを選択状態にする
          this.allPaths.forEach(path => {
            if (path.tool === 'textbox') {
              path.isSelected = false;
            }
          });
          this.setSelectedTextBox(pathData);
          this.isResizing = true;
          this.resizeHandle = resizeHandle;
          this.dragOffset = { x: coords.x, y: coords.y };
          this.redrawCanvas();
          return;
        }
      }
    }
    
    // テキストボックス本体をクリックしたかチェック（全ツールで有効）
    const clickedTextBox = this.getTextBoxAt(coords);
    
    if (clickedTextBox) {
      console.log('テキストボックスをクリックしました（ツール:', this.currentTool, ')');
      
      // 選択状態にする
      this.allPaths.forEach(path => {
        if (path.tool === 'textbox') {
          path.isSelected = false;
        }
      });
      this.setSelectedTextBox(clickedTextBox);
      
      // ダブルクリックの場合は編集ダイアログを表示
      if (this.lastClickTime && Date.now() - this.lastClickTime < 500) {
        console.log('ダブルクリック検出、編集ダイアログ表示');
        this.showTextBoxEditDialog(clickedTextBox);
        this.lastClickTime = 0; // リセット
        return;
      }
      
      // 移動エリアをクリックした場合は移動準備
      if (this.isPointInMoveArea(coords, clickedTextBox)) {
        console.log('移動エリアをクリック、移動準備開始');
        this.isDraggingTextBox = true;
        this.dragOffset = {
          x: coords.x - clickedTextBox.x,
          y: coords.y - clickedTextBox.y
        };
        this.lastClickTime = Date.now();
        this.redrawCanvas();
        return;
      }
      
      // 移動エリア外の場合、リサイズハンドルをチェック
      const resizeHandle = this.getResizeHandle(coords, clickedTextBox);
      if (resizeHandle) {
        console.log('リサイズハンドル検出:', resizeHandle);
        this.isResizing = true;
        this.resizeHandle = resizeHandle;
        this.dragOffset = { x: coords.x, y: coords.y };
        this.lastClickTime = Date.now();
        this.redrawCanvas();
        return;
      }
      
      // どちらでもない場合は選択のみ
      this.lastClickTime = Date.now();
      this.redrawCanvas();
      return;
    }
    
    // 【ここから先は通常の描画処理】
    // テキストボックス以外をクリックした場合、選択解除
    if (this.selectedTextBox) {
      this.clearTextBoxSelection();
      this.redrawCanvas();
    }
    
    // 消しゴムツール以外の場合のみ描画状態を設定
    if (this.currentTool !== 'eraser') {
      // 開口部・シンボルの場合は特別処理（クリック一回で完了）
      if (this.currentTool === 'door' && 
          (this.doorType === 'smallbox' || this.doorType === 'circle' || 
           this.doorType === 'square' || this.doorType === 'cross')) {
        this.drawSymbolInstantly(coords);
        return; // 描画状態には入らない
      }
      
      // 塗りつぶしの場合は連続描画モードに入る
      if (this.currentTool === 'fill') {
        this.isDrawing = true;
        this.fillPositions = []; // 塗りつぶし位置を記録
        this.drawFillAt(coords);
        return;
      }
      
      this.isDrawing = true;
      this.startPoint = coords;
      this.currentPath = [coords];
      this.canvas.classList.add('drawing');
    }
    
    if (this.currentTool === 'pen') {
      // ズーム変換を適用
      this.ctx.setTransform(this.scale, 0, 0, this.scale, this.translateX, this.translateY);
      
      // 変換後に描画設定を再適用
      console.log('Pen drawing start - setting color:', this.strokeColor);
      this.ctx.strokeStyle = this.strokeColor;
      this.ctx.lineWidth = this.strokeWidth;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      
      this.ctx.beginPath();
      this.ctx.moveTo(coords.x, coords.y);
    } else if (this.currentTool === 'polyline-grid') {
      // グリッド連続直線ツール（ペンツールと同じ描画方式）
      this.ctx.setTransform(this.scale, 0, 0, this.scale, this.translateX, this.translateY);
      
      console.log('Polyline-grid drawing start - setting color:', this.strokeColor);
      this.ctx.strokeStyle = this.strokeColor;
      this.ctx.lineWidth = this.strokeWidth + 6; // 直線ツールと同じ太さ
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      
      this.ctx.beginPath();
      this.ctx.moveTo(coords.x, coords.y);
    } else if (this.currentTool === 'text-horizontal' || this.currentTool === 'text-vertical') {
      // 新仕様：ドラッグでのテキストボックス作成は無効化
      return;
    }
  }

  // シンボル（開口部・○・□・×）を即座に描画するメソッド
  drawSymbolInstantly(coords) {
    console.log('🔵 シンボル即座描画開始:', this.doorType, coords);
    
    let size, snappedX, snappedY;
    
    if (this.doorType === 'smallbox') {
      // 開口部：サイズ可変
      let sizeMultiplier;
      switch (this.openingSize) {
        case 'quarter':
          sizeMultiplier = 0.25;
          break;
        case 'one':
          sizeMultiplier = 1;
          break;
        default: // 'half'
          sizeMultiplier = 0.5;
      }
      size = this.gridSize * sizeMultiplier;
      const quarterGrid = this.gridSize / 4;
      const snappedCenterX = Math.round(coords.x / quarterGrid) * quarterGrid;
      const snappedCenterY = Math.round(coords.y / quarterGrid) * quarterGrid;
      snappedX = snappedCenterX - size / 2;
      snappedY = snappedCenterY - size / 2;
    } else {
      // ○・□・×：0.5マス
      size = this.gridSize / 2;
      const halfGrid = this.gridSize / 2;
      const snappedCenterX = Math.round(coords.x / halfGrid) * halfGrid;
      const snappedCenterY = Math.round(coords.y / halfGrid) * halfGrid;
      snappedX = snappedCenterX - size / 2;
      snappedY = snappedCenterY - size / 2;
    }
    
    // シンボルのパスデータを作成
    const symbolData = {
      tool: 'door',
      doorType: this.doorType,
      openingSize: this.doorType === 'smallbox' ? this.openingSize : undefined, // 開口部の場合のみサイズ情報を保存
      startPoint: { x: snappedX, y: snappedY },
      endPoint: { x: snappedX + size, y: snappedY + size },
      strokeColor: this.strokeColor,
      strokeWidth: this.strokeWidth,
      lineStyle: this.lineStyle
    };
    
    // パス履歴に追加
    this.allPaths.push(symbolData);
    this.lastOperationType = 'path';
    this.redoStack = [];
    this.updateUndoRedoButtons();
    
    console.log('シンボルをパス履歴に追加:', symbolData);
    
    // キャンバスを再描画
    this.redrawCanvas();
  }

  // 開口部を即座に描画するメソッド（後方互換性のため残す）
  drawSmallBoxInstantly(coords) {
    console.log('📦 開口部即座描画開始:', coords);
    
    // サイズに応じたマス数を決定
    let sizeMultiplier;
    switch (this.openingSize) {
      case 'quarter':
        sizeMultiplier = 0.25; // 0.25マス
        break;
      case 'one':
        sizeMultiplier = 1; // 1マス
        break;
      default: // 'half'
        sizeMultiplier = 0.5; // 0.5マス
    }
    
    const boxSize = this.gridSize * sizeMultiplier;
    
    // クリック位置を0.25マスグリッドにスナップ（中央配置）
    const quarterGrid = this.gridSize / 4;
    const snappedCenterX = Math.round(coords.x / quarterGrid) * quarterGrid;
    const snappedCenterY = Math.round(coords.y / quarterGrid) * quarterGrid;
    
    // スナップした中央位置から左上角を計算
    const boxX = snappedCenterX - boxSize / 2;
    const boxY = snappedCenterY - boxSize / 2;
    
    // 開口部のパスデータを作成（左上角の座標で保存）
    const smallBoxData = {
      tool: 'door',
      doorType: 'smallbox',
      openingSize: this.openingSize, // サイズ情報を保存
      startPoint: { x: boxX, y: boxY },
      endPoint: { x: boxX + boxSize, y: boxY + boxSize },
      strokeColor: this.strokeColor,
      strokeWidth: this.strokeWidth,
      lineStyle: this.lineStyle
    };
    
    // パス履歴に追加
    this.allPaths.push(smallBoxData);
    this.lastOperationType = 'path';
    this.redoStack = []; // redo履歴をクリア
    
    // アンドゥ/リドゥボタンの状態を更新
    this.updateUndoRedoButtons();
    
    console.log('開口部をパス履歴に追加:', smallBoxData);
    
    // キャンバスを再描画
    this.redrawCanvas();
    
    console.log('📦 開口部即座描画完了');
  }

  draw(event) {
    // シンプルなマルチタッチチェック
    if (this.isMultiTouch || this.multiTouchCooldown) {
      return; // マルチタッチ中は描画処理をスキップ
    }
    
    // マルチタッチ中の移動を検出
    if (event.touches && event.touches.length > 1) {
      return; // マルチタッチ中は描画処理を完全にスキップ
    }
    
    const coords = this.getCoordinates(event);
    
    // タッチプレビュー中の場合、プレビュー位置を更新
    if (this.isShowingTouchPreview && this.currentTool === 'eraser') {
      this.eraserPreviewCoords = coords;
      this.redrawCanvas();
      return;
    }
    
    // 消しゴムツールで押し続けている場合は継続的に消去
    if (this.currentTool === 'eraser' && this.isEraserPressed) {
      this.eraseAtPoint(coords);
      return;
    }
    
    // リサイズ中の場合
    if (this.isResizing && this.selectedTextBox && this.resizeHandle) {
      this.resizeTextBox(this.selectedTextBox, this.resizeHandle, coords);
      this.redrawCanvas();
      return;
    }
    
    // テキストボックスをドラッグ中の場合（グリッドスナップを無効にして移動）
    if (this.isDraggingTextBox && this.selectedTextBox) {
      // グリッドスナップを適用しない座標を取得
      const rect = this.canvas.getBoundingClientRect();
      let x = event.clientX - rect.left;
      let y = event.clientY - rect.top;
      
      // 高DPI対応
      const dpr = window.devicePixelRatio || 1;
      x *= dpr;
      y *= dpr;
      
      // ズーム・パン変換を適用（座標を世界座標系に変換）
      x = (x - this.translateX) / this.scale;
      y = (y - this.translateY) / this.scale;
      
      // 座標を即座に更新（間引きなし）
      this.selectedTextBox.x = x - this.dragOffset.x;
      this.selectedTextBox.y = y - this.dragOffset.y;
      
      // 再描画は redrawCanvas の内部スロットリング（8ms）に任せる
      this.redrawCanvas();
      return;
    }
    
    if (!this.isDrawing) return;
    
    // マウス移動の間引き処理（描画中も適用）
    const now = performance.now();
    if (this.lastMouseMoveTime && (now - this.lastMouseMoveTime) < this.mouseMoveThrottleMs) {
      return;
    }
    this.lastMouseMoveTime = now;
    
    this.currentPath.push(coords);
    
    if (this.currentTool === 'pen') {
      // ズーム変換を適用
      this.ctx.setTransform(this.scale, 0, 0, this.scale, this.translateX, this.translateY);
      
      this.ctx.strokeStyle = this.strokeColor;
      this.ctx.lineWidth = this.strokeWidth;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      
      this.ctx.lineTo(coords.x, coords.y);
      this.ctx.stroke();
    } else if (this.currentTool === 'polyline-grid') {
      // ズーム変換を適用
      this.ctx.setTransform(this.scale, 0, 0, this.scale, this.translateX, this.translateY);
      
      // 描画設定を確実に適用
      console.log('Polyline-grid drawing - applying color:', this.strokeColor);
      this.ctx.strokeStyle = this.strokeColor;
      this.ctx.lineWidth = this.strokeWidth + 6; // 直線ツールと同じ太さ
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      
      this.ctx.lineTo(coords.x, coords.y);
      this.ctx.stroke();
    } else if (this.currentTool === 'fill') {
      // 塗りつぶしツールの場合、移動中も連続で塗りつぶす
      this.drawFillAt(coords);
    } else {
      // 図形描画の場合、リアルタイムプレビュー
      let endPoint = coords;
      if (false) {
        // Shift機能は無効化
        if (false) {
          // 垂直線
          endPoint = { x: this.startPoint.x, y: coords.y };
        }
      }
      
      // L字階段用：最初の動きを記録（一定距離動いた時点で確定）
      if (this.currentTool === 'stairs' && this.stairType === 'l-shape' && !this.firstMovePoint) {
        const dx = Math.abs(coords.x - this.startPoint.x);
        const dy = Math.abs(coords.y - this.startPoint.y);
        const threshold = this.gridSize * 0.3; // 閾値：0.3マス分移動したら判定
        
        if (dx > threshold || dy > threshold) {
          // 最初にどちらの方向に動いたかを記録
          this.firstMovePoint = {
            x: coords.x,
            y: coords.y,
            isHorizontalFirst: dx > dy // 水平方向に先に動いた場合true
          };
          console.log('L字階段：最初の動き検出', this.firstMovePoint.isHorizontalFirst ? '水平→' : '垂直→');
        }
      }
      
      // プレビュー情報を設定
      this.previewEndPoint = endPoint;
      this.showShapePreview = (this.currentTool !== 'text-horizontal' && this.currentTool !== 'text-vertical');
      
      // redrawCanvas内でプレビューも描画される
      this.redrawCanvas();
    }
  }

  stopDrawing(event) {
    // シンプルなマルチタッチチェック
    if (this.isMultiTouch || this.multiTouchCooldown) {
      console.log('マルチタッチ中またはクールダウン中のため停止処理をスキップ');
      return;
    }
    
    // タッチプレビューをキャンセル
    if (this.isShowingTouchPreview) {
      this.cancelTouchEraserPreview();
      return;
    }
    
    // リサイズ終了
    if (this.isResizing) {
      this.isResizing = false;
      this.resizeHandle = null;
      return;
    }
    
    // テキストボックスのドラッグ終了
    if (this.isDraggingTextBox) {
      this.isDraggingTextBox = false;
      // ドラッグ終了時にグリッドにスナップ（0.5マス単位 = 80px）
      if (this.selectedTextBox) {
        const snapSize = this.gridSize / 2; // 80px
        this.selectedTextBox.x = Math.round(this.selectedTextBox.x / snapSize) * snapSize;
        this.selectedTextBox.y = Math.round(this.selectedTextBox.y / snapSize) * snapSize;
        this.redrawCanvas();
      }
      return;
    }
    
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    this.canvas.classList.remove('drawing');
    
    let coords = this.getCoordinates(event);
    
    // 描画完了時の処理
    if (this.currentTool === 'text-horizontal' || this.currentTool === 'text-vertical') {
      // テキストボックスはボタンクリック時に作成済みのため、ここでは何もしない
      // this.createTextBox(this.startPoint, coords);
    } else if (this.currentTool === 'fill') {
      // 塗りつぶしツールの場合、記録した全ての位置を一つのパスとして保存
      if (this.fillPositions && this.fillPositions.length > 0) {
        const fillData = {
          tool: 'fill',
          positions: this.fillPositions, // 複数の塗りつぶし位置
          fillSize: this.fillSize,
          fillPattern: this.fillPattern, // パターン情報を保存
          strokeColor: this.strokeColor
        };
        this.allPaths.push(fillData);
        this.lastOperationType = 'path';
        this.redoStack = [];
        this.updateUndoRedoButtons();
        this.fillPositions = [];
        this.lastFillPos = null; // 次のストロークのためにリセット
      }
    } else {
      // 直線、四角形、扉は太い線で保存
      const actualStrokeWidth = (this.currentTool === 'line' || this.currentTool === 'rectangle' || this.currentTool === 'door' || this.currentTool === 'polyline-grid') 
        ? this.strokeWidth + 6 
        : this.strokeWidth;
        
      const strokeData = {
        tool: this.currentTool,
        path: this.currentPath,
        strokeWidth: actualStrokeWidth,
        strokeColor: this.strokeColor,
        startPoint: this.startPoint,
        endPoint: coords
      };
      
      // 直線の場合は線スタイルも保存
      if (this.currentTool === 'line') {
        strokeData.lineStyle = this.lineStyle;
        // 後方互換性のため個別フラグも保存
        strokeData.isDashed = this.isDashed;
        strokeData.hasArrow = this.hasArrow;
      }
      
      // 扉の場合は扉の種類も保存
      if (this.currentTool === 'door') {
        strokeData.doorType = this.doorType;
      }
      
      // 階段の場合は階段設定も保存
      if (this.currentTool === 'stairs') {
        strokeData.stairSteps = this.stairSteps;
        strokeData.stairWidth = this.stairWidth;
        strokeData.stairType = this.stairType; // 階段タイプも保存
        // L字階段の場合は方向も保存
        if (this.stairType === 'l-shape' && this.firstMovePoint) {
          strokeData.isHorizontalFirst = this.firstMovePoint.isHorizontalFirst;
        }
      }
      
      
      // 最後の操作タイプを設定
      if (this.currentTool === 'eraser') {
        // 消しゴムはクリック処理で履歴管理されるため、ここでは何もしない
        console.log('消しゴム操作 - クリック処理で完結');
      } else {
        // 通常のパス追加
        this.allPaths.push(strokeData);
        this.lastOperationType = 'path';
        
        // アンドゥ/リドゥボタンの状態を更新
        this.updateUndoRedoButtons();
      }
      
      this.redoStack = []; // Redo履歴をクリア
      
      // ペンツールまたはグリッド連続直線ツールの場合、図形認識を実行
      if (this.currentTool === 'pen' || this.currentTool === 'polyline-grid') {
        this.emit('drawingComplete', this.currentPath);
      }
    }
    
    // 消しゴムプレビューをクリア（描画完了時）
    if (this.currentTool === 'eraser') {
      this.showEraserPreview = false;
      this.eraserPreviewCoords = null;
      // 消しゴム操作終了
      this.stopEraserOperation();
    }
    
    // 図形プレビューをクリア（描画完了時）
    this.showShapePreview = false;
    this.previewEndPoint = null;
    this.firstMovePoint = null; // L字階段用の最初の動きもリセット
    
    this.currentPath = [];
    
    // 描画後にキャンバスを再描画
    this.redrawCanvas();
    
    // 自動最適化の実行
    if (this.allPaths.length > PERFORMANCE_CONFIG.OPTIMIZATION_THRESHOLD) {
      this.optimizePaths();
    }
  }

  drawShape(start, end) {
    // ズーム変換を適用
    this.ctx.setTransform(this.scale, 0, 0, this.scale, this.translateX, this.translateY);
    
    this.ctx.strokeStyle = this.strokeColor;
    // 直線と四角形は中心線より太く（元の太さ + 6）
    this.ctx.lineWidth = this.strokeWidth + 6;
    
    // 線スタイル設定（プレビュー時も含めて一貫して適用）
    if (this.currentTool === 'line' && this.lineStyle === 'dashed') {
      // より大きな点線パターン（固定値で見やすく）
      const dashLength = 20; // 20px線
      const gapLength = 15;  // 15px空白
      console.log('プレビューで点線を設定します:', { dashLength, gapLength, strokeWidth: this.strokeWidth });
      this.ctx.setLineDash([dashLength, gapLength]);
    } else {
      this.ctx.setLineDash([]); // 実線（矢印モードも含む）
    }
    
    this.ctx.beginPath();
    
    switch (this.currentTool) {
      case 'line':
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        break;
      case 'rectangle':
        const width = end.x - start.x;
        const height = end.y - start.y;
        this.ctx.rect(start.x, start.y, width, height);
        break;
      case 'door':
        this.drawDoor(start, end);
        // 扉描画では各メソッド内でstroke()を実行済みのため、ここではreturnする
        this.ctx.restore();
        return;
      case 'stairs':
        this.drawStairs(start, end);
        // 階段描画では各メソッド内でstroke()を実行済みのため、ここではreturnする
        this.ctx.restore();
        return;
      case 'fill':
        this.drawFill(coords);
        this.ctx.restore();
        return;
      // circleツールは廃止
    }
    
    this.ctx.stroke();
    
    // 直線で矢印が有効な場合は矢印を描画
    if (this.currentTool === 'line' && this.lineStyle === 'arrow') {
      console.log('プレビューで矢印を描画します:', { lineStyle: this.lineStyle });
      this.drawArrowHead(this.ctx, start.x, start.y, end.x, end.y);
    }
    
    // プレビュー中はLineDashをリセットしない（描画中の見た目を一貫させるため）
    // this.ctx.setLineDash([]);
  }

  drawDoor(start, end, openingSize = null) {
    // 四方向固定の扉描画（上下左右のみ）
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    // openingSizeが指定されていない場合は現在の設定を使用
    const effectiveOpeningSize = openingSize || this.openingSize;
    
    // 固定扉幅（0.5マス = 10px）
    const fixedDoorWidth = this.gridSize * 0.5; // 10px
    
    // 四方向のうち最も近い方向を決定
    let doorStart, doorEnd, direction;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // 水平方向（左右）
      if (dx > 0) {
        // 右向き
        direction = 'horizontal-right';
        doorStart = { x: start.x, y: start.y };
        doorEnd = { x: start.x + fixedDoorWidth, y: start.y };
      } else {
        // 左向き
        direction = 'horizontal-left';
        doorStart = { x: start.x, y: start.y };
        doorEnd = { x: start.x - fixedDoorWidth, y: start.y };
      }
    } else {
      // 垂直方向（上下）
      if (dy > 0) {
        // 下向き
        direction = 'vertical-down';
        doorStart = { x: start.x, y: start.y };
        doorEnd = { x: start.x, y: start.y + fixedDoorWidth };
      } else {
        // 上向き
        direction = 'vertical-up';
        doorStart = { x: start.x, y: start.y };
        doorEnd = { x: start.x, y: start.y - fixedDoorWidth };
      }
    }
    
    // 垂直方向のベクトル
    const perpDx = direction.startsWith('horizontal') ? 0 : 1;
    const perpDy = direction.startsWith('vertical') ? 0 : 1;
    
    // 扉の種類に応じて描画
    switch (this.doorType) {
      case 'single':
        // 片開き戸
        this.drawSingleDoor(doorStart, doorEnd, perpDx, perpDy, fixedDoorWidth, 'right');
        break;
      case 'double':
        // 両開き戸
        this.drawDoubleDoor(doorStart, doorEnd, perpDx, perpDy, fixedDoorWidth);
        break;
      case 'smallbox':
        // 開口部（サイズ可変）
        this.drawSmallBox(start, end, effectiveOpeningSize);
        break;
      case 'circle':
        // ○（丸）0.5マス×0.5マス
        this.drawCircleSymbol(start, end);
        break;
      case 'square':
        // □（四角）0.5マス×0.5マス
        this.drawSquareSymbol(start, end);
        break;
      case 'cross':
        // ×（バツ）0.5マス×0.5マス
        this.drawCrossSymbol(start, end);
        break;
      // 後方互換性のため古い値もサポート
      case 'single-left':
        this.drawSingleDoor(doorStart, doorEnd, perpDx, perpDy, fixedDoorWidth, 'left');
        break;
      case 'single-right':
        this.drawSingleDoor(doorStart, doorEnd, perpDx, perpDy, fixedDoorWidth, 'right');
        break;
    }
  }

  drawSingleDoor(start, end, perpDx, perpDy, width, direction) {
    // 建築図面標準：片開き戸
    // 壁の開口部（太い線）+ ヒンジから扉板への開き弧 + 扉の位置
    
    // 座標を整数化し、0.5pxずらしてシャープな線を描画
    const intStart = { x: Math.floor(start.x) + 0.5, y: Math.floor(start.y) + 0.5 };
    const intEnd = { x: Math.floor(end.x) + 0.5, y: Math.floor(end.y) + 0.5 };
    
    // 扉開口部の枠線（壁と同じ太さの6px、中を背景色で塗りつぶし）
    this.ctx.save();
    
    // まず太い背景色線で壁を上書き（背景）
    this.ctx.lineWidth = 6;
    this.ctx.strokeStyle = this.getBackgroundColor(); // ダークモード対応背景色
    this.ctx.beginPath();
    this.ctx.moveTo(intStart.x, intStart.y);
    this.ctx.lineTo(intEnd.x, intEnd.y);
    this.ctx.stroke();
    
    // まず太い背景色線で壁を上書き（背景）
    this.ctx.lineWidth = 6;
    this.ctx.strokeStyle = this.getBackgroundColor(); // ダークモード対応背景色
    this.ctx.beginPath();
    this.ctx.moveTo(intStart.x, intStart.y);
    this.ctx.lineTo(intEnd.x, intEnd.y);
    this.ctx.stroke();
    
    this.ctx.restore();
    
    // ヒンジ位置（右開きが標準）
    const hingePoint = direction === 'left' ? intEnd : intStart;
    const freePoint = direction === 'left' ? intStart : intEnd;
    
    // 扉の開き弧（90度の四分円）- 扉の幅と同じ半径
    const radius = width; // 扉の幅全体をカバー
    const baseAngle = Math.atan2(intEnd.y - intStart.y, intEnd.x - intStart.x);
    
    // 開き方向の決定
    let openAngle;
    if (direction === 'left') {
      openAngle = baseAngle + Math.PI/2;
    } else {
      openAngle = baseAngle - Math.PI/2;
    }
    
    // 開き弧を描画（細い線）- 端から端まで
    this.ctx.save();
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = this.getShapeColor(); // ダークモード対応色
    this.ctx.beginPath();
    this.ctx.arc(hingePoint.x, hingePoint.y, radius, 
                 Math.min(baseAngle, openAngle), 
                 Math.max(baseAngle, openAngle));
    this.ctx.stroke();
    this.ctx.restore();
    
    // 開いた扉の位置（細い線）
    const doorEndX = Math.floor(hingePoint.x + Math.cos(openAngle) * radius) + 0.5;
    const doorEndY = Math.floor(hingePoint.y + Math.sin(openAngle) * radius) + 0.5;
    
    this.ctx.save();
    this.ctx.lineWidth = 1; // 2pxから1pxに変更
    this.ctx.strokeStyle = this.getShapeColor(); // ダークモード対応色
    this.ctx.beginPath();
    this.ctx.moveTo(hingePoint.x, hingePoint.y);
    this.ctx.lineTo(doorEndX, doorEndY);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawDoubleDoor(start, end, perpDx, perpDy, width) {
    // 建築図面標準：両開き戸
    // 壁の開口部（太い線）+ 中央分割 + 左右の開き弧 + 両扉の位置
    
    // 座標を整数化し、0.5pxずらしてシャープな線を描画
    const intStart = { x: Math.floor(start.x) + 0.5, y: Math.floor(start.y) + 0.5 };
    const intEnd = { x: Math.floor(end.x) + 0.5, y: Math.floor(end.y) + 0.5 };
    
    // 扉開口部の枠線（壁と同じ太さの6px、中を背景色で塗りつぶし）
    this.ctx.save();
    
    // まず太い背景色線で壁を上書き（背景）
    this.ctx.lineWidth = 6;
    this.ctx.strokeStyle = this.getBackgroundColor(); // ダークモード対応背景色
    this.ctx.beginPath();
    this.ctx.moveTo(intStart.x, intStart.y);
    this.ctx.lineTo(intEnd.x, intEnd.y);
    this.ctx.stroke();
    
    this.ctx.restore();
    
    const midX = Math.floor((intStart.x + intEnd.x) / 2) + 0.5;
    const midY = Math.floor((intStart.y + intEnd.y) / 2) + 0.5;
    const halfWidth = width / 2;
    
    // 中央分割マーク（垂直の短い線）- 円弧と同じ細さ
    this.ctx.save();
    this.ctx.lineWidth = 1; // 円弧と同じ細さに変更
    this.ctx.strokeStyle = this.getShapeColor(); // ダークモード対応色
    this.ctx.beginPath();
    const markSize = 4;
    this.ctx.moveTo(midX + perpDx * markSize, midY + perpDy * markSize);
    this.ctx.lineTo(midX - perpDx * markSize, midY - perpDy * markSize);
    this.ctx.stroke();
    this.ctx.restore();
    
    const baseAngle = Math.atan2(intEnd.y - intStart.y, intEnd.x - intStart.x);
    const radius = halfWidth; // 半分の幅と同じ半径
    
    // 左側扉の開き弧（90度）- 中央から外側に開く
    this.ctx.save();
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = this.getShapeColor(); // ダークモード対応色
    this.ctx.beginPath();
    const leftOpenAngle = baseAngle - Math.PI/2; // 時計回りに90度
    // 角度の大小を正しく指定
    this.ctx.arc(intStart.x, intStart.y, radius, 
                 Math.min(baseAngle, leftOpenAngle), 
                 Math.max(baseAngle, leftOpenAngle));
    this.ctx.stroke();
    this.ctx.restore();
    
    // 左側扉の位置（細い線）- 独立したsave/restore
    this.ctx.save();
    this.ctx.lineWidth = 1; // 細い線に変更
    this.ctx.strokeStyle = this.getShapeColor(); // ダークモード対応色
    this.ctx.beginPath();
    const leftDoorX = Math.floor(intStart.x + Math.cos(leftOpenAngle) * radius) + 0.5;
    const leftDoorY = Math.floor(intStart.y + Math.sin(leftOpenAngle) * radius) + 0.5;
    this.ctx.moveTo(intStart.x, intStart.y);
    this.ctx.lineTo(leftDoorX, leftDoorY);
    this.ctx.stroke();
    this.ctx.restore();
    
    // 右側扉の開き弧（90度）- 中央から外側に開く（左側の鏡像）
    this.ctx.save();
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = this.getShapeColor(); // ダークモード対応色
    this.ctx.beginPath();
    const rightBaseAngle = baseAngle + Math.PI; // 180度回転した基準角度
    const rightOpenAngle = rightBaseAngle + Math.PI/2; // 反時計回りに90度
    // 角度の大小を正しく指定
    this.ctx.arc(intEnd.x, intEnd.y, radius, 
                 Math.min(rightBaseAngle, rightOpenAngle), 
                 Math.max(rightBaseAngle, rightOpenAngle));
    this.ctx.stroke();
    this.ctx.restore();
    
    // 右側扉の位置（細い線）- 独立したsave/restore
    this.ctx.save();
    this.ctx.lineWidth = 1; // 細い線に変更
    this.ctx.strokeStyle = this.getShapeColor(); // ダークモード対応色
    this.ctx.beginPath();
    const rightDoorX = Math.floor(intEnd.x + Math.cos(rightOpenAngle) * radius) + 0.5;
    const rightDoorY = Math.floor(intEnd.y + Math.sin(rightOpenAngle) * radius) + 0.5;
    this.ctx.moveTo(intEnd.x, intEnd.y);
    this.ctx.lineTo(rightDoorX, rightDoorY);
    this.ctx.stroke();
    this.ctx.restore();
  }

  // キャンバス用開口部描画メソッド
  drawSmallBox(start, end, openingSize = 'half') {
    console.log('📦 キャンバス用開口部描画開始:', { start, end, openingSize });
    
    // サイズに応じたマス数を決定
    let sizeMultiplier;
    switch (openingSize) {
      case 'quarter':
        sizeMultiplier = 0.25;
        break;
      case 'one':
        sizeMultiplier = 1;
        break;
      default: // 'half'
        sizeMultiplier = 0.5;
    }
    const boxSize = this.gridSize * sizeMultiplier;
    
    // startPointとendPointから開口部の位置を決定
    // 即座描画の場合、startPointに箱を配置
    const boxX = start.x;
    const boxY = start.y;
    
    this.ctx.save();
    
    // 開口部の描画（透けた青色の塗りつぶし）
    this.ctx.fillStyle = 'rgba(100, 150, 255, 0.3)'; // 透けた青色
    this.ctx.fillRect(boxX, boxY, boxSize, boxSize);
    
    // 境界線（青色）
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = '#4080ff'; // 青色の枠線
    this.ctx.strokeRect(boxX, boxY, boxSize, boxSize);
    
    this.ctx.restore();
    
    console.log('📦 キャンバス用開口部描画完了:', { boxX, boxY, boxSize });
  }

  // ○（丸）シンボル描画 - 0.5マス×0.5マス（塗りつぶし）
  drawCircleSymbol(start, end) {
    const size = this.gridSize / 2; // 0.5マス
    const centerX = start.x + size / 2;
    const centerY = start.y + size / 2;
    const radius = size / 2;
    
    this.ctx.save();
    this.ctx.fillStyle = this.strokeColor;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  // □（四角）シンボル描画 - 0.5マス×0.5マス（塗りつぶし）
  drawSquareSymbol(start, end) {
    const size = this.gridSize / 2; // 0.5マス
    
    this.ctx.save();
    this.ctx.fillStyle = this.strokeColor;
    this.ctx.fillRect(start.x, start.y, size, size);
    this.ctx.restore();
  }

  // ×（バツ）シンボル描画 - 0.5マス×0.5マス（太線）
  drawCrossSymbol(start, end) {
    const size = this.gridSize / 2; // 0.5マス
    
    this.ctx.save();
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.lineWidth = 10; // さらに太くする
    this.ctx.lineCap = 'round'; // 端を丸くする
    
    // 左上から右下への線
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(start.x + size, start.y + size);
    this.ctx.stroke();
    
    // 右上から左下への線
    this.ctx.beginPath();
    this.ctx.moveTo(start.x + size, start.y);
    this.ctx.lineTo(start.x, start.y + size);
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  drawStairs(start, end) {
    // 階段タイプに応じて描画を分岐
    switch (this.stairType) {
      case 'l-shape':
        this.drawLShapeStairs(start, end);
        break;
      case 'spiral':
        this.drawSpiralStairs(start, end);
        break;
      default: // 'straight'
        this.drawStraightStairs(start, end);
    }
  }

  // 塗りつぶし描画（プレビュー用）
  drawFill(coords) {
    let size;
    switch (this.fillSize) {
      case 'quarter':
        size = this.gridSize / 4; // 0.25マス = 40px
        break;
      case 'half':
        size = this.gridSize / 2; // 0.5マス = 80px
        break;
      case 'one':
        size = this.gridSize; // 1マス = 160px
        break;
      default:
        size = this.gridSize / 2;
    }
    
    // カーソル位置を含むマスにスナップ（選択したサイズ単位でスナップ）
    const snappedX = Math.floor(coords.x / size) * size;
    const snappedY = Math.floor(coords.y / size) * size;
    
    // パターンに応じて描画
    this.ctx.save();
    if (this.fillPattern === 'diagonal') {
      // 斜線パターン
      this.drawDiagonalPattern(snappedX, snappedY, size);
    } else {
      // 塗りつぶし
      this.ctx.fillStyle = this.strokeColor;
      this.ctx.fillRect(snappedX, snappedY, size, size);
    }
    this.ctx.restore();
  }

  // 斜線パターン描画
  drawDiagonalPattern(x, y, size) {
    this.ctx.save();
    
    // 現在の変換行列を取得
    const transform = this.ctx.getTransform();
    
    // ワールド座標をスクリーン座標に変換
    const screenX = x * transform.a + transform.e;
    const screenY = y * transform.d + transform.f;
    const screenSize = size * transform.a; // zoom倍率を適用
    
    // 変換をリセットして物理座標で描画
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.lineWidth = 2;
    
    const spacing = 16; // 斜線の間隔（物理ピクセル）
    
    // 背景に薄い色を塗る
    this.ctx.fillStyle = this.strokeColor + '20'; // 透明度12.5%
    this.ctx.fillRect(screenX, screenY, screenSize, screenSize);
    
    // クリッピング領域を設定（正方形内だけに描画）
    this.ctx.beginPath();
    this.ctx.rect(screenX, screenY, screenSize, screenSize);
    this.ctx.clip();
    
    // 左上から右下への斜線を描画
    this.ctx.beginPath();
    for (let offset = -screenSize; offset < screenSize * 2; offset += spacing) {
      this.ctx.moveTo(screenX + offset, screenY);
      this.ctx.lineTo(screenX + offset + screenSize, screenY + screenSize);
    }
    this.ctx.stroke();
    
    // クリッピングを解除
    this.ctx.restore();
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // 枠線を描画（クリッピング後に描画）
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(screenX, screenY, screenSize, screenSize);
    
    // 変換を元に戻す
    this.ctx.setTransform(transform);
    this.ctx.restore();
  }

  // 連続塗りつぶし用：位置を記録しながら描画
  drawFillAt(coords) {
    let size;
    switch (this.fillSize) {
      case 'quarter':
        size = this.gridSize / 4;
        break;
      case 'half':
        size = this.gridSize / 2;
        break;
      case 'one':
        size = this.gridSize;
        break;
      default:
        size = this.gridSize / 2;
    }
    
    // カーソル位置を含むマスにスナップ（選択したサイズ単位でスナップ）
    const snappedX = Math.floor(coords.x / size) * size;
    const snappedY = Math.floor(coords.y / size) * size;
    
    // 同じ位置に既に描画済みかチェック
    if (!this.fillPositions) {
      this.fillPositions = [];
      this.lastFillPos = null;
    }
    
    const posKey = `${snappedX},${snappedY}`;
    if (this.fillPositions.some(pos => `${pos.x},${pos.y}` === posKey)) {
      return; // 既に描画済み
    }
    
    // 前回の位置から現在の位置までの間を埋める
    if (this.lastFillPos) {
      const dx = snappedX - this.lastFillPos.x;
      const dy = snappedY - this.lastFillPos.y;
      const steps = Math.max(Math.abs(dx / size), Math.abs(dy / size));
      
      for (let i = 1; i <= steps; i++) { // i=1から開始（前回位置は既に描画済み）
        const t = steps > 0 ? i / steps : 0;
        const interpX = this.lastFillPos.x + Math.round(dx * t / size) * size;
        const interpY = this.lastFillPos.y + Math.round(dy * t / size) * size;
        const interpKey = `${interpX},${interpY}`;
        
        if (!this.fillPositions.some(pos => `${pos.x},${pos.y}` === interpKey)) {
          this.fillPositions.push({ x: interpX, y: interpY, size: size, pattern: this.fillPattern });
          
          // 変換行列を適用して描画
          this.ctx.setTransform(this.scale, 0, 0, this.scale, this.translateX, this.translateY);
          if (this.fillPattern === 'diagonal') {
            this.drawDiagonalPattern(interpX, interpY, size);
          } else {
            this.ctx.fillStyle = this.strokeColor;
            this.ctx.fillRect(interpX, interpY, size, size);
          }
        }
      }
    } else {
      // 最初の位置
      this.fillPositions.push({ x: snappedX, y: snappedY, size: size, pattern: this.fillPattern });
      this.ctx.setTransform(this.scale, 0, 0, this.scale, this.translateX, this.translateY);
      if (this.fillPattern === 'diagonal') {
        this.drawDiagonalPattern(snappedX, snappedY, size);
      } else {
        this.ctx.fillStyle = this.strokeColor;
        this.ctx.fillRect(snappedX, snappedY, size, size);
      }
    }
    
    this.lastFillPos = { x: snappedX, y: snappedY };
  }

  // 塗りつぶしを即座に実行してパスに追加（旧実装・削除予定）
  drawFillInstantly(coords) {
    console.log('Fill tool clicked at:', coords, 'fillSize:', this.fillSize, 'color:', this.strokeColor);
    let size;
    switch (this.fillSize) {
      case 'quarter':
        size = this.gridSize / 4;
        break;
      case 'half':
        size = this.gridSize / 2;
        break;
      case 'one':
        size = this.gridSize;
        break;
      default:
        size = this.gridSize / 2;
    }
    
    // グリッドにスナップ
    const snappedX = Math.round(coords.x / (this.gridSize / 4)) * (this.gridSize / 4);
    const snappedY = Math.round(coords.y / (this.gridSize / 4)) * (this.gridSize / 4);
    
    // パスデータを作成
    const fillData = {
      tool: 'fill',
      startPoint: { x: snappedX, y: snappedY },
      size: size,
      fillSize: this.fillSize,
      strokeColor: this.strokeColor
    };
    
    // パス履歴に追加
    this.allPaths.push(fillData);
    this.lastOperationType = 'path';
    this.redoStack = [];
    
    // 再描画
    this.redrawCanvas();
  }

  // 直線階段の描画
  drawStraightStairs(start, end) {
    // 階段記号を描画：矢印に横線（段鼻線）が複数本
    console.log(`直線階段描画開始: start(${start.x}, ${start.y}), end(${end.x}, ${end.y}), stairWidth: ${this.stairWidth}px`);
    
    this.ctx.save();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = this.getShapeColor(); // ダークモード対応色
    
    // 階段の方向ベクトル
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) {
      this.ctx.restore();
      return;
    }
    
    // 単位ベクトル
    const unitX = dx / length;
    const unitY = dy / length;
    
    // 垂直ベクトル（段鼻線用）
    const perpX = -unitY;
    const perpY = unitX;
    
    // 階段の実際の幅を計算（グリッドスナップ考慮）
    const stairWidth = this.stairWidth;
    const halfWidth = stairWidth / 2;
    
    console.log(`階段描画詳細:`, {
      length: `${length.toFixed(1)}px`,
      stairWidth: `${stairWidth}px`,
      gridUnits: `${(stairWidth/this.gridSize).toFixed(2)}マス`,
      halfWidth: `${halfWidth}px`,
      gridSize: `${this.gridSize}px`,
      currentSize: stairWidth === this.gridSize * 0.5 ? 'small' : 
                  stairWidth === this.gridSize * 1 ? 'medium' : 
                  stairWidth === this.gridSize * 1.5 ? 'large' : 'unknown'
    });
    
    // 矢印の中心線を描画
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();
    
    // 矢印の先端を描画
    const arrowLength = 20;
    const arrowAngle = Math.PI / 6; // 30度
    
    // 矢印の左側の線
    const leftArrowX = end.x - arrowLength * Math.cos(Math.atan2(dy, dx) - arrowAngle);
    const leftArrowY = end.y - arrowLength * Math.sin(Math.atan2(dy, dx) - arrowAngle);
    
    // 矢印の右側の線
    const rightArrowX = end.x - arrowLength * Math.cos(Math.atan2(dy, dx) + arrowAngle);
    const rightArrowY = end.y - arrowLength * Math.sin(Math.atan2(dy, dx) + arrowAngle);
    
    this.ctx.beginPath();
    this.ctx.moveTo(end.x, end.y);
    this.ctx.lineTo(leftArrowX, leftArrowY);
    this.ctx.moveTo(end.x, end.y);
    this.ctx.lineTo(rightArrowX, rightArrowY);
    this.ctx.stroke();
    
    // 段鼻線（横線）を描画
    const stepSpacing = length / (this.stairSteps + 1); // 段数+1で割って均等配置
    
    for (let i = 1; i <= this.stairSteps; i++) {
      const t = i * stepSpacing / length;
      if (t >= 1) break; // 矢印の先端を超えないように
      
      const stepX = start.x + dx * t;
      const stepY = start.y + dy * t;
      
      // 段鼻線の開始点と終了点
      const stepStartX = stepX + perpX * halfWidth;
      const stepStartY = stepY + perpY * halfWidth;
      const stepEndX = stepX - perpX * halfWidth;
      const stepEndY = stepY - perpY * halfWidth;
      
      this.ctx.beginPath();
      this.ctx.moveTo(stepStartX, stepStartY);
      this.ctx.lineTo(stepEndX, stepEndY);
      this.ctx.stroke();
    }
    
    // 起点に白丸を描画（オプション）
    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(start.x, start.y, 4, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  // L字階段の描画
  drawLShapeStairs(start, end) {
    console.log(`L字階段描画開始: start(${start.x}, ${start.y}), end(${end.x}, ${end.y})`);
    
    this.ctx.save();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = this.getShapeColor();
    
    // 方向を判定してL字の折り返し点を決定（一筆書き風）
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    
    let corner;
    let isHorizontalFirst;
    
    // 最初にドラッグした方向を使用（記録されている場合）
    if (this.firstMovePoint && this.firstMovePoint.isHorizontalFirst !== undefined) {
      isHorizontalFirst = this.firstMovePoint.isHorizontalFirst;
      console.log('L字階段: ドラッグ開始時の動きを使用 ->', isHorizontalFirst ? '水平→垂直' : '垂直→水平');
    } else {
      // フォールバック：終点位置から判定
      const minLength = this.stairWidth * 0.8;
      
      const isPatternAValid = absDx >= minLength && absDy >= minLength;
      const isPatternBValid = absDy >= minLength && absDx >= minLength;
      
      if (isPatternAValid && isPatternBValid) {
        // 両方有効な場合は長い方向を優先
        isHorizontalFirst = absDx >= absDy;
      } else if (isPatternAValid) {
        isHorizontalFirst = true;
      } else if (isPatternBValid) {
        isHorizontalFirst = false;
      } else {
        isHorizontalFirst = absDx >= absDy;
      }
      console.log('L字階段: 終点から判定 ->', isHorizontalFirst ? '水平→垂直' : '垂直→水平');
    }
    
    corner = isHorizontalFirst ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
    
    console.log(`L字階段描画: 横:${absDx.toFixed(0)}px 縦:${absDy.toFixed(0)}px, パターン:${isHorizontalFirst ? '水平→垂直' : '垂直→水平'}`);
    
    // 第一セグメント
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(corner.x, corner.y);
    this.ctx.stroke();
    
    // 第二セグメント
    this.ctx.beginPath();
    this.ctx.moveTo(corner.x, corner.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();
    
    // 終点の矢印
    const arrowLength = 20;
    let angle;
    if (isHorizontalFirst) {
      // 垂直方向の矢印
      angle = Math.atan2(end.y - corner.y, 0);
    } else {
      // 水平方向の矢印
      angle = Math.atan2(0, end.x - corner.x);
    }
    const arrowAngle = Math.PI / 6;
    
    this.ctx.beginPath();
    this.ctx.moveTo(end.x, end.y);
    this.ctx.lineTo(
      end.x - arrowLength * Math.cos(angle - arrowAngle),
      end.y - arrowLength * Math.sin(angle - arrowAngle)
    );
    this.ctx.moveTo(end.x, end.y);
    this.ctx.lineTo(
      end.x - arrowLength * Math.cos(angle + arrowAngle),
      end.y - arrowLength * Math.sin(angle + arrowAngle)
    );
    this.ctx.stroke();
    
    // 折り返し点に斜めの線を描画（踊り場を表現）
    const stairWidth = this.stairWidth;
    const halfWidth = stairWidth / 2;
    const diagonalLength = halfWidth * 1.4; // 対角線の長さ（√2倍程度）
    
    // ドラッグの方向（正負）を考慮して斜め線の向きを決定
    const signX = dx >= 0 ? 1 : -1; // 右方向なら1、左方向なら-1
    const signY = dy >= 0 ? 1 : -1; // 下方向なら1、上方向なら-1
    
    if (isHorizontalFirst) {
      // 水平→垂直の場合：第一セグメントに対して垂直な斜め線
      // 右に進んで下に曲がる → 左上から右下への斜め線
      this.ctx.beginPath();
      this.ctx.moveTo(corner.x - signX * diagonalLength * 0.7, corner.y + signY * diagonalLength * 0.7);
      this.ctx.lineTo(corner.x + signX * diagonalLength * 0.7, corner.y - signY * diagonalLength * 0.7);
      this.ctx.stroke();
    } else {
      // 垂直→水平の場合：第一セグメントに対して垂直な斜め線
      // 下に進んで右に曲がる → 左上から右下への斜め線
      this.ctx.beginPath();
      this.ctx.moveTo(corner.x + signX * diagonalLength * 0.7, corner.y - signY * diagonalLength * 0.7);
      this.ctx.lineTo(corner.x - signX * diagonalLength * 0.7, corner.y + signY * diagonalLength * 0.7);
      this.ctx.stroke();
    }
    
    // 段鼻線を各セグメントに描画（折り返し点付近は除外）
    const stepsPerSegment = Math.floor(this.stairSteps / 2);
    const cornerMargin = stairWidth * 0.6; // 折り返し点付近の除外範囲
    
    // 第一セグメントの段鼻線
    if (isHorizontalFirst) {
      // 水平セグメント：垂直な段鼻線
      const length1 = Math.abs(corner.x - start.x);
      if (length1 > 0) {
        for (let i = 1; i <= stepsPerSegment; i++) {
          const t = i / (stepsPerSegment + 1);
          const x = start.x + (corner.x - start.x) * t;
          const y = start.y;
          
          // 折り返し点から一定距離内は描画しない
          const distanceToCorner = Math.abs(x - corner.x);
          if (distanceToCorner > cornerMargin) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, y - halfWidth);
            this.ctx.lineTo(x, y + halfWidth);
            this.ctx.stroke();
          }
        }
      }
      
      // 第二セグメント：水平な段鼻線
      const length2 = Math.abs(end.y - corner.y);
      if (length2 > 0) {
        for (let i = 1; i <= stepsPerSegment; i++) {
          const t = i / (stepsPerSegment + 1);
          const x = corner.x;
          const y = corner.y + (end.y - corner.y) * t;
          
          // 折り返し点から一定距離内は描画しない
          const distanceToCorner = Math.abs(y - corner.y);
          if (distanceToCorner > cornerMargin) {
            this.ctx.beginPath();
            this.ctx.moveTo(x - halfWidth, y);
            this.ctx.lineTo(x + halfWidth, y);
            this.ctx.stroke();
          }
        }
      }
    } else {
      // 垂直セグメント：水平な段鼻線
      const length1 = Math.abs(corner.y - start.y);
      if (length1 > 0) {
        for (let i = 1; i <= stepsPerSegment; i++) {
          const t = i / (stepsPerSegment + 1);
          const x = start.x;
          const y = start.y + (corner.y - start.y) * t;
          
          // 折り返し点から一定距離内は描画しない
          const distanceToCorner = Math.abs(y - corner.y);
          if (distanceToCorner > cornerMargin) {
            this.ctx.beginPath();
            this.ctx.moveTo(x - halfWidth, y);
            this.ctx.lineTo(x + halfWidth, y);
            this.ctx.stroke();
          }
        }
      }
      
      // 第二セグメント：垂直な段鼻線
      const length2 = Math.abs(end.x - corner.x);
      if (length2 > 0) {
        for (let i = 1; i <= stepsPerSegment; i++) {
          const t = i / (stepsPerSegment + 1);
          const x = corner.x + (end.x - corner.x) * t;
          const y = corner.y;
          
          // 折り返し点から一定距離内は描画しない
          const distanceToCorner = Math.abs(x - corner.x);
          if (distanceToCorner > cornerMargin) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, y - halfWidth);
            this.ctx.lineTo(x, y + halfWidth);
            this.ctx.stroke();
          }
        }
      }
    }
    
    // 起点マーカー
    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.beginPath();
    this.ctx.arc(start.x, start.y, 4, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  // 螺旋階段の描画
  drawSpiralStairs(start, end) {
    console.log(`螺旋階段描画開始: start(${start.x}, ${start.y}), end(${end.x}, ${end.y})`);
    
    this.ctx.save();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = this.getShapeColor();
    
    // 螺旋の中心と半径を計算
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    const radius = Math.min(
      Math.abs(end.x - start.x) / 2,
      Math.abs(end.y - start.y) / 2,
      this.stairWidth
    );
    
    // 螺旋を描画（円形）
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    this.ctx.stroke();
    
    // 中心に小さな円（柱）
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius * 0.3, 0, 2 * Math.PI);
    this.ctx.stroke();
    
    // 放射状の段鼻線
    const angleStep = (2 * Math.PI) / this.stairSteps;
    const startAngle = Math.atan2(start.y - centerY, start.x - centerX);
    
    for (let i = 0; i < this.stairSteps; i++) {
      const angle = startAngle + angleStep * i;
      const innerRadius = radius * 0.3;
      const outerRadius = radius;
      
      const x1 = centerX + Math.cos(angle) * innerRadius;
      const y1 = centerY + Math.sin(angle) * innerRadius;
      const x2 = centerX + Math.cos(angle) * outerRadius;
      const y2 = centerY + Math.sin(angle) * outerRadius;
      
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }
    
    // 矢印で回転方向を示す
    const arrowAngle = startAngle + Math.PI / 4;
    const arrowX = centerX + Math.cos(arrowAngle) * radius;
    const arrowY = centerY + Math.sin(arrowAngle) * radius;
    const arrowLength = 15;
    
    this.ctx.beginPath();
    this.ctx.moveTo(arrowX, arrowY);
    this.ctx.lineTo(
      arrowX - arrowLength * Math.cos(arrowAngle - Math.PI / 6),
      arrowY - arrowLength * Math.sin(arrowAngle - Math.PI / 6)
    );
    this.ctx.moveTo(arrowX, arrowY);
    this.ctx.lineTo(
      arrowX - arrowLength * Math.cos(arrowAngle + Math.PI / 6),
      arrowY - arrowLength * Math.sin(arrowAngle + Math.PI / 6)
    );
    this.ctx.stroke();
    
    // 起点マーカー
    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.beginPath();
    this.ctx.arc(start.x, start.y, 4, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  redrawCanvas() {
    // 既に再描画が要求されている場合は重複呼び出しを避ける
    if (this.redrawRequested) return;
    
    this.redrawRequested = true;
    
    // デバウンシング処理で不要な再描画を防止
    if (this.redrawTimeout) {
      cancelAnimationFrame(this.redrawTimeout);
    }
    
    // パフォーマンス向上のため、再描画を間引く
    const now = performance.now();
    if (this.lastRedrawTime && (now - this.lastRedrawTime) < this.redrawThrottleMs) {
      this.redrawTimeout = setTimeout(() => {
        this.redrawRequested = false;
        this._performRedraw();
      }, this.redrawThrottleMs - (now - this.lastRedrawTime));
      return;
    }
    
    this.redrawTimeout = requestAnimationFrame(() => {
      this.redrawRequested = false;
      this.lastRedrawTime = performance.now();
      this._performRedraw();
    });
  }

  _performRedraw() {
    // キャンバスを完全にクリア
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // ズーム・パン変換を適用
    this.ctx.setTransform(this.scale, 0, 0, this.scale, this.translateX, this.translateY);

    // 背景画像（下絵）— グリッドより下に半透明で描画
    // 位置/回転/大きさ/不透明度はユーザーが調整可能
    if (this.backgroundImage) {
      this.ctx.save();
      this.ctx.globalAlpha = this.backgroundImageOpacity;
      this.ctx.translate(this.backgroundImageOffsetX, this.backgroundImageOffsetY);
      this.ctx.rotate(this.backgroundImageRotation);
      this.ctx.scale(this.backgroundImageScale, this.backgroundImageScale);
      const imgW = this.backgroundImage.naturalWidth;
      const imgH = this.backgroundImage.naturalHeight;
      this.ctx.drawImage(this.backgroundImage, -imgW / 2, -imgH / 2);
      this.ctx.restore();
    }

    // グリッドを描画
    this.drawGrid();

    // 出力範囲（PDF/画像/Excel 出力時に切り取られる領域）を描画
    this.drawExportBounds();

    // レイヤー順に描画：塗りつぶし → その他のオブジェクト
    // 1. 塗りつぶしを先に描画
    this.allPaths.forEach((pathData, index) => {
      if (pathData.tool === 'fill') {
        this.drawFillPath(pathData);
      }
    });
    
    // 2. その他のオブジェクト（線、図形、テキストなど）を後に描画
    this.allPaths.forEach((pathData, index) => {
      if (pathData.tool === 'fill') {
        return; // 塗りつぶしは既に描画済み
      }
      
      // 各パスごとに状態を保存・復元
      this.ctx.save();
      
      if (pathData.tool === 'pen') {
        // ペンツールの場合、同じスタイルのパスをバッチ処理
        this.ctx.strokeStyle = pathData.strokeColor;
        this.ctx.lineWidth = pathData.strokeWidth;
        this.ctx.beginPath();
        pathData.path.forEach((point, index) => {
          if (index === 0) {
            this.ctx.moveTo(point.x, point.y);
          } else {
            this.ctx.lineTo(point.x, point.y);
          }
        });
        this.ctx.stroke();
      } else if (pathData.tool === 'polyline-grid') {
        // グリッド連続直線ツールの場合、ペンツールと同じ描画方式
        this.ctx.strokeStyle = pathData.color || pathData.strokeColor;
        this.ctx.lineWidth = pathData.width || pathData.strokeWidth;
        this.ctx.beginPath();
        const points = pathData.points || pathData.path;
        points.forEach((point, index) => {
          if (index === 0) {
            this.ctx.moveTo(point.x, point.y);
          } else {
            this.ctx.lineTo(point.x, point.y);
          }
        });
        this.ctx.stroke();
      } else if (pathData.tool === 'text-horizontal' || pathData.tool === 'text-vertical') {
        // テキストの描画
        this.ctx.fillStyle = pathData.strokeColor;
        this.ctx.font = `${pathData.fontSize}px "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", Arial, sans-serif`;
        
        if (pathData.isVertical) {
          this.drawVerticalText(pathData.text, pathData.x, pathData.y, pathData.fontSize);
        } else {
          this.ctx.fillText(pathData.text, pathData.x, pathData.y);
        }
      } else if (pathData.tool === 'textbox') {
        // テキストボックスの描画
        this.drawTextBox(pathData);
      } else {
        // 図形の描画
        this.ctx.strokeStyle = pathData.strokeColor;
        this.ctx.lineWidth = pathData.strokeWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // 線スタイル設定
        if (pathData.tool === 'line') {
          const lineStyle = pathData.lineStyle || (pathData.isDashed ? 'dashed' : (pathData.hasArrow ? 'arrow' : 'solid'));
          if (lineStyle === 'dashed') {
            // より大きな点線パターン（固定値で見やすく）
            const dashLength = 20; // 20px線
            const gapLength = 15;  // 15px空白
            this.ctx.setLineDash([dashLength, gapLength]);
          } else {
            this.ctx.setLineDash([]); // 実線
          }
        } else {
          this.ctx.setLineDash([]); // 実線
        }
        
        this.ctx.beginPath();
        
        switch (pathData.tool) {
          case 'line':
            this.ctx.moveTo(pathData.startPoint.x, pathData.startPoint.y);
            this.ctx.lineTo(pathData.endPoint.x, pathData.endPoint.y);
            break;
          case 'rectangle':
            const width = pathData.endPoint.x - pathData.startPoint.x;
            const height = pathData.endPoint.y - pathData.startPoint.y;
            this.ctx.rect(pathData.startPoint.x, pathData.startPoint.y, width, height);
            break;
          case 'door':
            // 扉の描画時は扉の種類と開口部サイズも復元
            const savedDoorType = this.doorType;
            const savedStrokeColor = this.strokeColor;
            this.doorType = pathData.doorType || 'single';
            this.strokeColor = pathData.strokeColor || this.strokeColor;
            this.drawDoor(pathData.startPoint, pathData.endPoint, pathData.openingSize || 'half');
            this.doorType = savedDoorType;
            this.strokeColor = savedStrokeColor;
            // 扉描画では各メソッド内でstroke()済みのため、stroke()をスキップ
            this.ctx.restore();
            return; // forEachのコールバック内なのでreturnでスキップ
          case 'stairs':
            // 階段の描画時は階段設定も復元
            const savedStairSteps = this.stairSteps;
            const savedStairWidth = this.stairWidth;
            const savedStairType = this.stairType;
            const savedFirstMovePoint = this.firstMovePoint;
            
            this.stairSteps = pathData.stairSteps || 10;
            this.stairWidth = pathData.stairWidth || this.gridSize * 1; // デフォルト1マス
            this.stairType = pathData.stairType || 'straight'; // 階段タイプ復元
            
            // L字階段の場合は方向情報も復元
            if (this.stairType === 'l-shape' && pathData.isHorizontalFirst !== undefined) {
              this.firstMovePoint = {
                isHorizontalFirst: pathData.isHorizontalFirst
              };
            }
            
            this.drawStairs(pathData.startPoint, pathData.endPoint);
            
            // 設定を戻す
            this.stairSteps = savedStairSteps;
            this.stairWidth = savedStairWidth;
            this.stairType = savedStairType;
            this.firstMovePoint = savedFirstMovePoint;
            
            // 階段描画では各メソッド内でstroke()済みのため、stroke()をスキップ
            this.ctx.restore();
            return; // forEachのコールバック内なのでreturnでスキップ
          // circleツールは廃止
        }
        
        this.ctx.stroke();
        
        // 直線で矢印が有効な場合は矢印を描画
        if (pathData.tool === 'line') {
          const lineStyle = pathData.lineStyle || (pathData.hasArrow ? 'arrow' : 'solid');
          if (lineStyle === 'arrow') {
            this.drawArrowHead(this.ctx, pathData.startPoint.x, pathData.startPoint.y, pathData.endPoint.x, pathData.endPoint.y);
          }
        }
        
        // 個別図形でのLineDashリセットは削除（redrawCanvas最後で一括リセット）
      }
      
      this.ctx.restore();
    });
    
    // 選択されたテキストボックスのハンドルを描画（常に表示）
    if (this.selectedTextBox) {
      this.drawSelectionHandles(this.selectedTextBox);
    }
    
    // 消しゴムプレビューの描画
    if (this.showEraserPreview && this.eraserPreviewCoords) {
      this.drawEraserPreview();
    }
    
    // 図形プレビューの描画
    if (this.showShapePreview && this.startPoint && this.previewEndPoint) {
      this.drawShapePreview(this.startPoint, this.previewEndPoint);
    }
    
    // 描画中のポリライングリッドパスを描画
    if (this.isDrawing && this.currentTool === 'polyline-grid' && this.currentPath.length > 0) {
      this.ctx.setTransform(this.scale, 0, 0, this.scale, this.translateX, this.translateY);
      this.ctx.strokeStyle = this.strokeColor;
      this.ctx.lineWidth = this.strokeWidth + 6; // 直線ツールと同じ太さ
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      this.currentPath.forEach((point, index) => {
        if (index === 0) {
          this.ctx.moveTo(point.x, point.y);
        } else {
          this.ctx.lineTo(point.x, point.y);
        }
      });
      this.ctx.stroke();
    }
    
    // 変換をリセット
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // LineDashをリセット（グリッドや他の描画への影響を防ぐ）
    this.ctx.setLineDash([]);
    
    // 描画設定を復元（色変更が正しく反映されるように）
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.fillStyle = this.strokeColor;
    this.ctx.lineWidth = this.strokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  drawShapePreview(start, end) {
    // ズーム変換を適用
    this.ctx.setTransform(this.scale, 0, 0, this.scale, this.translateX, this.translateY);
    
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.lineWidth = this.strokeWidth + 6; // 直線と四角形は中心線より太く
    
    // 線スタイル設定（プレビュー時）
    if (this.currentTool === 'line') {
      console.log('プレビューでlineStyle:', this.lineStyle);
      
      if (this.lineStyle === 'dashed') {
        // より大きな点線パターン（固定値で見やすく）
        const dashLength = 20; // 20px線
        const gapLength = 15;  // 15px空白
        console.log('プレビューで点線を設定:', { dashLength, gapLength, strokeWidth: this.strokeWidth });
        this.ctx.setLineDash([dashLength, gapLength]);
      } else {
        this.ctx.setLineDash([]);
      }
    } else {
      this.ctx.setLineDash([]);
    }
    
    this.ctx.beginPath();
    
    switch (this.currentTool) {
      case 'line':
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();
        
        // 矢印モードの場合、プレビューでも矢印を描画
        if (this.lineStyle === 'arrow') {
          console.log('プレビューで矢印を描画:', { start, end });
          this.drawArrowHead(this.ctx, start.x, start.y, end.x, end.y);
        }
        break;
      case 'rectangle':
        const width = end.x - start.x;
        const height = end.y - start.y;
        this.ctx.rect(start.x, start.y, width, height);
        this.ctx.stroke();
        break;
      case 'door':
        this.drawDoor(start, end);
        return; // drawDoorは独自にstroke()を実行
      case 'stairs':
        this.drawStairs(start, end);
        return; // drawStairsは独自にstroke()を実行
    }
  }

  handleSelection(event) {
    console.log('handleSelection called');
    const coords = this.getCoordinates(event);
    console.log('Click coordinates:', coords);
    
    // リサイズハンドルをクリックしたかチェック
    if (this.selectedTextBox) {
      console.log('Already selected textbox:', this.selectedTextBox);
      const handle = this.getResizeHandle(coords, this.selectedTextBox);
      if (handle) {
        console.log('Resize handle clicked:', handle);
        this.isResizing = true;
        this.resizeHandle = handle;
        this.startPoint = coords;
        return;
      }
      
      // テキストボックス内をクリックしたかチェック（移動開始）
      if (this.isPointInTextBox(coords, this.selectedTextBox)) {
        console.log('Starting to drag textbox');
        this.isDraggingTextBox = true;
        this.dragOffset = {
          x: coords.x - this.selectedTextBox.x,
          y: coords.y - this.selectedTextBox.y
        };
        return;
      }
    }
    
    // 新しいテキストボックスを選択
    const clickedTextBox = this.getTextBoxAt(coords);
    console.log('Found textbox at click:', clickedTextBox);
    if (clickedTextBox) {
      console.log('Selecting textbox:', clickedTextBox);
      this.selectedTextBox = clickedTextBox;
      this.redrawCanvas();
    } else {
      // 空の場所をクリックした場合、選択を解除
      console.log('Deselecting textbox');
      this.selectedTextBox = null;
      this.redrawCanvas();
    }
  }

  handleSelectDrag(event) {
    const coords = this.getCoordinates(event);
    
    if (this.isResizing && this.selectedTextBox && this.resizeHandle) {
      // リサイズ処理：正しい関数を呼び出し
      this.resizeTextBox(this.selectedTextBox, this.resizeHandle, coords);
      this.redrawCanvas();
    } else if (this.isDraggingTextBox && this.selectedTextBox) {
      // 移動処理
      this.selectedTextBox.x = coords.x - this.dragOffset.x;
      this.selectedTextBox.y = coords.y - this.dragOffset.y;
      this.redrawCanvas();
    }
  }

  setStrokeWidth(width) {
    this.strokeWidth = width;
    this.ctx.lineWidth = width;
  }

  setPenWidth(width) {
    // ペン専用の太さ設定
    this.penWidth = width;
    // ペンツール選択時のみ実際の描画太さに反映
    if (this.currentTool === 'pen') {
      this.strokeWidth = width;
      this.ctx.lineWidth = width;
    }
  }

  setEraserSize(size) {
    // 消しゴムサイズを設定
    this.eraserSize = size;
  }

  setStrokeColor(color) {
    console.log('setStrokeColor called with:', color);
    this.strokeColor = color;
    this.ctx.strokeStyle = color;
    // fillStyleも同時に更新（テキスト描画用）
    this.ctx.fillStyle = color;
    console.log('Updated strokeColor:', this.strokeColor, 'ctx.strokeStyle:', this.ctx.strokeStyle);
  }

  setFontSize(size) {
    this.fontSize = size;
    
    // 選択されているテキストボックスがあれば、そのフォントサイズも変更
    if (this.selectedTextBox) {
      this.selectedTextBox.fontSize = size;
      
      // 現在編集中のテキスト入力があれば、サイズを更新
      if (this.textInput && this.textInput.parentNode) {
        const textBoxData = this.selectedTextBox;
        const maxFontSize = Math.min(
          textBoxData.fontSize,
          textBoxData.height / 2,
          textBoxData.width / 4
        );
        const adjustedFontSize = Math.max(8, maxFontSize);
    this.textInput.style.fontSize = `${adjustedFontSize * dpr}px`;
      }
      
      this.redrawCanvas();
    }
  }

  setTool(tool) {
    console.error('ツール切り替え:', { from: this.currentTool, to: tool });
    
    // 描画中の場合は描画を完了させる
    if (this.isDrawing && this.currentPath.length > 0) {
      console.log('描画中のため、現在の描画を完了させます');
      this.finishCurrentDrawing();
    }
    
    this.currentTool = tool;
    
    // 消しゴムプレビューの状態をクリア（ツール切り替え時）
    this.showEraserPreview = false;
    this.eraserPreviewCoords = null;
    this.cancelTouchEraserPreview(); // タッチプレビューもキャンセル
    
    // ペンツールの場合は専用の太さを適用
    if (tool === 'pen') {
      this.strokeWidth = this.penWidth;
      this.ctx.lineWidth = this.penWidth;
    } else {
      // その他のツールは標準の太さ（2）を使用
      this.strokeWidth = 2;
      this.ctx.lineWidth = 2;
    }
    
    // 色設定を確実に復元
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.fillStyle = this.strokeColor;
    
    this.updateCursor();
    
    // 画面を再描画してプレビューを消去
    this.redrawCanvas();
  }

  finishCurrentDrawing() {
    if (!this.isDrawing || this.currentPath.length === 0) {
      return;
    }
    
    console.log('現在の描画を完了:', { 
      tool: this.currentTool, 
      pathLength: this.currentPath.length 
    });
    
    switch (this.currentTool) {
      case 'polyline-grid':
        // ポリライン描画を完了
        if (this.currentPath.length > 1) {
          this.allPaths.push({
            tool: 'polyline-grid',
            color: this.strokeColor,
            points: [...this.currentPath],
            width: this.strokeWidth + 6  // 直線ツールと同じ太さに統一
          });
        }
        break;
        
      case 'pen':
        // ペン描画を完了
        if (this.currentPath.length > 0) {
          this.allPaths.push({
            tool: 'pen',
            color: this.strokeColor,
            points: [...this.currentPath],
            width: this.penWidth
          });
        }
        break;
        
      case 'line':
        // 直線描画を完了
        if (this.currentPath.length >= 2) {
          this.allPaths.push({
            tool: 'line',
            color: this.strokeColor,
            start: this.currentPath[0],
            end: this.currentPath[this.currentPath.length - 1],
            width: this.strokeWidth
          });
        }
        break;
        
      default:
        // その他のツールの場合、現在の描画を保存
        if (this.currentPath.length > 0) {
          this.allPaths.push({
            tool: this.currentTool,
            color: this.strokeColor,
            points: [...this.currentPath],
            width: this.strokeWidth
          });
        }
        break;
    }
    
    // 描画状態をリセット
    this.isDrawing = false;
    this.currentPath = [];
    
    // アンドゥ・リドゥのために操作タイプを設定
    this.lastOperationType = 'path';
    this.redoStack = []; // Redo履歴をクリア
    
    console.log('描画完了。allPaths数:', this.allPaths.length);
  }

  setSnapToGrid(enabled) {
    this.snapToGrid = enabled;
  }

  updateCursor() {
    // 以前のツールクラスを削除
    this.canvas.classList.remove('tool-pen', 'tool-line', 'tool-rectangle', 'tool-circle', 'tool-text-horizontal', 'tool-text-vertical', 'tool-select', 'tool-door', 'tool-stairs', 'tool-polyline-grid');
    
    // 現在のツールクラスを追加
    this.canvas.classList.add(`tool-${this.currentTool.replace('-', '-')}`);
    
    let cursor = 'crosshair';
    
    if (this.currentTool === 'pen') {
      cursor = 'crosshair';
    } else if (this.currentTool === 'line') {
      cursor = 'crosshair';
    } else if (this.currentTool === 'rectangle') {
      cursor = 'crosshair';
    } else if (this.currentTool === 'circle') {
      cursor = 'crosshair';
    } else if (this.currentTool === 'door') {
      cursor = 'crosshair';
    } else if (this.currentTool === 'stairs') {
      cursor = 'crosshair';
    } else if (this.currentTool === 'text-horizontal' || this.currentTool === 'text-vertical') {
      cursor = 'text';
    } else if (this.currentTool === 'select') {
      cursor = 'default';
    }
    
    this.canvas.style.cursor = cursor;
  }

  clear() {
    // パスの履歴をクリア
    this.allPaths = [];
    this.redoStack = [];
    
    // すべての履歴をクリア
    if (this.history) {
      this.history = [];
    }
    if (this.segmentHistory) {
      this.segmentHistory = [];
    }
    if (this.segmentRedoStack) {
      this.segmentRedoStack = [];
    }
    
    // 消しゴム履歴もクリア
    if (this.eraserHistory) {
      this.eraserHistory = [];
    }
    if (this.eraserRedoStack) {
      this.eraserRedoStack = [];
    }
    
    // 最後の操作タイプもリセット
    this.lastOperationType = null;
    
    // 初期状態として空の開口部履歴を保存しない（完全にクリア）
    
    this.redrawCanvas(); // グリッドを含めて再描画
  }

  // 消しゴム操作開始（押し続け対応）
  startEraserOperation(event) {
    if (this.isMultiTouch || this.multiTouchCooldown) {
      return; // マルチタッチ中は処理しない
    }
    
    console.log('消しゴム操作開始:', { 
      eventType: event.type,
      hasTouches: !!event.touches,
      touchCount: event.touches?.length,
      deviceType: /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'iOS' : 'PC'
    });
    
    this.isEraserPressed = true;
    this.eraserOperationActive = true;
    this.eraserOperationChanges = [];
    
    // 消しゴム操作開始時の状態をスナップショットとして保存
    this.eraserOperationStartSnapshot = this.allPaths.map(path => ({...path}));
    console.log('消しゴム操作開始スナップショット保存:', { pathCount: this.eraserOperationStartSnapshot.length });
    
    const coords = this.getCoordinates(event);
    console.log('消しゴム操作座標:', coords);
    this.eraseAtPoint(coords);
  }
  
  // 消しゴム操作終了
  stopEraserOperation() {
    console.log('stopEraserOperation呼び出し:', {
      isEraserPressed: this.isEraserPressed,
      eraserOperationActive: this.eraserOperationActive,
      eraserOperationChangesLength: this.eraserOperationChanges.length
    });
    
    if (!this.isEraserPressed) return;
    
    this.isEraserPressed = false;
    
    // 消しゴム操作完了処理（蓄積された変更をまとめて一つの履歴として保存）
    if (this.eraserOperationActive && this.eraserOperationChanges.length > 0) {
      console.log('消しゴム操作完了 - 蓄積された変更をまとめて一つの履歴として保存');
      
      // 完全削除と部分削除を分離
      const fullDeletes = this.eraserOperationChanges.filter(change => change.operationType === 'fullDelete');
      const partialDeletes = this.eraserOperationChanges.filter(change => change.operationType !== 'fullDelete');
      
      // 一つの消しゴム操作として統合してeraserHistoryに保存
      this.eraserHistory.push({
        type: 'eraserOperation',
        operationType: 'mixed', // 完全削除と部分削除の混合
        fullDeletes: fullDeletes.map(fd => ({
          deletedPath: fd.deletedPath,
          pathIndex: fd.pathIndex
        })),
        partialDeletes: partialDeletes.length > 0 ? {
          originalPath: partialDeletes[0].originalPath,
          pathIndex: partialDeletes[0].pathIndex
        } : null,
        allPathsSnapshot: this.eraserOperationStartSnapshot, // 操作開始時のスナップショット
        changeCount: this.eraserOperationChanges.length, // 変更回数
        timestamp: this.eraserOperationChanges[0].timestamp
      });
      console.log('統合された消しゴム履歴記録:', { 
        fullDeleteCount: fullDeletes.length,
        partialDeleteCount: partialDeletes.length,
        totalChangeCount: this.eraserOperationChanges.length 
      });
      
      this.eraserOperationActive = false;
      this.eraserOperationChanges = [];
      this.eraserOperationStartSnapshot = null; // スナップショットをリセット
      
      // 統合履歴保存後にundoボタン状態を更新
      this.updateUndoRedoButtons();
    } else {
      console.log('finishEraserOperation をスキップ:', {
        eraserOperationActive: this.eraserOperationActive,
        eraserOperationChangesLength: this.eraserOperationChanges.length
      });
      this.eraserOperationActive = false;
      this.eraserOperationChanges = [];
      this.eraserOperationStartSnapshot = null;
    }
  }

  
  eraseAtPoint(coords) {
    const eraserSize = this.eraserSize; // 独立した消しゴムサイズを使用
    const pathsToRemove = [];
    const pathsToModify = [];
    
    // 描画されたパスの中から消しゴムと接触するものを見つける
    for (let i = 0; i < this.allPaths.length; i++) {
      const pathData = this.allPaths[i];
      
      if (pathData.tool === 'pen') {
        // フリーハンドの場合 - 全体を削除
        for (let j = 0; j < pathData.path.length; j++) {
          const point = pathData.path[j];
          const distance = Math.sqrt(
            Math.pow(coords.x - point.x, 2) + Math.pow(coords.y - point.y, 2)
          );
          
          if (distance <= eraserSize) {
            pathsToRemove.push(i);
            break;
          }
        }
      } else if (pathData.tool === 'polyline-grid') {
        // グリッド連続直線の場合 - 部分削除
        const points = pathData.points || pathData.path;
        if (!points || points.length < 2) continue;
        
        // ポリラインを線分に分割
        const segments = [];
        for (let j = 0; j < points.length - 1; j++) {
          segments.push({
            start: points[j],
            end: points[j + 1],
            index: j
          });
        }
        
        // 消しゴムと接触する線分を見つける
        const segmentsToRemove = [];
        for (let j = 0; j < segments.length; j++) {
          const segment = segments[j];
          if (isPointNearLineSegment(coords, segment.start, segment.end, eraserSize)) {
            segmentsToRemove.push(j);
          }
        }
        
        // 端点近くで削除された場合、隣接する非常に短い線分も削除対象にする
        const expandedSegmentsToRemove = new Set(segmentsToRemove);
        const minSegmentLength = 10; // 10px未満の線分は端点削除時に一緒に削除
        
        for (const removeIndex of segmentsToRemove) {
          // 前の線分をチェック
          if (removeIndex > 0) {
            const prevSegment = segments[removeIndex - 1];
            const prevLength = Math.sqrt(
              Math.pow(prevSegment.end.x - prevSegment.start.x, 2) + 
              Math.pow(prevSegment.end.y - prevSegment.start.y, 2)
            );
            if (prevLength < minSegmentLength) {
              expandedSegmentsToRemove.add(removeIndex - 1);
              console.log('短い前隣接線分も削除:', prevLength + 'px');
            }
          }
          
          // 次の線分をチェック
          if (removeIndex < segments.length - 1) {
            const nextSegment = segments[removeIndex + 1];
            const nextLength = Math.sqrt(
              Math.pow(nextSegment.end.x - nextSegment.start.x, 2) + 
              Math.pow(nextSegment.end.y - nextSegment.start.y, 2)
            );
            if (nextLength < minSegmentLength) {
              expandedSegmentsToRemove.add(removeIndex + 1);
              console.log('短い後隣接線分も削除:', nextLength + 'px');
            }
          }
        }
        
        const finalSegmentsToRemove = Array.from(expandedSegmentsToRemove);
        
        if (finalSegmentsToRemove.length > 0) {
          // 残す線分から新しいポリラインを作成
          const newPolylines = [];
          let currentPolyline = [];
          const minLineLength = 5; // 最小線分長（5px未満は点として扱う）
          
          for (let j = 0; j < segments.length; j++) {
            if (!finalSegmentsToRemove.includes(j)) {
              // この線分は残す
              if (currentPolyline.length === 0) {
                currentPolyline.push(segments[j].start);
              }
              currentPolyline.push(segments[j].end);
            } else {
              // この線分は削除 - 現在のポリラインを完了
              if (currentPolyline.length >= 2) {
                // 線分の長さをチェックして短すぎる場合は削除
                const polylineLength = calculatePolylineLength(currentPolyline);
                if (polylineLength >= minLineLength) {
                  newPolylines.push({
                    tool: 'polyline-grid',
                    color: pathData.color || pathData.strokeColor,
                    points: [...currentPolyline],
                    width: pathData.width || pathData.strokeWidth
                  });
                } else {
                  console.log('短すぎるポリライン（点状）を削除:', polylineLength + 'px');
                }
              }
              currentPolyline = [];
            }
          }
          
          // 最後のポリラインを追加（長さチェック付き）
          if (currentPolyline.length >= 2) {
            const polylineLength = calculatePolylineLength(currentPolyline);
            if (polylineLength >= minLineLength) {
              newPolylines.push({
                tool: 'polyline-grid',
                color: pathData.color || pathData.strokeColor,
                points: [...currentPolyline],
                width: pathData.width || pathData.strokeWidth
              });
            } else {
              console.log('短すぎる最終ポリライン（点状）を削除:', polylineLength + 'px');
            }
          }
          
          // ポリライングリッドの部分削除を統合履歴で記録
          this.saveLineSegmentState(i, null, null, pathData, newPolylines.length);
          console.log('ポリライングリッド部分削除履歴記録:', { index: i, newPathsCount: newPolylines.length });
          
          pathsToModify.push({ index: i, newPaths: newPolylines });
        }
      } else if (pathData.tool === 'textbox') {
        // テキストボックスの場合 - 全体を削除
        console.log('テキストボックス削除チェック:', {
          eraserCoords: coords,
          textBoxX: pathData.x,
          textBoxY: pathData.y,
          textBoxWidth: pathData.width,
          textBoxHeight: pathData.height,
          text: pathData.text
        });
        if (this.isPointInTextBox(coords, pathData)) {
          pathsToRemove.push(i);
          console.log('テキストボックス削除対象に追加:', { index: i, text: pathData.text });
        } else {
          console.log('テキストボックス範囲外:', { 
            insideX: coords.x >= pathData.x && coords.x <= pathData.x + pathData.width,
            insideY: coords.y >= pathData.y && coords.y <= pathData.y + pathData.height
          });
        }
      } else if (pathData.tool === 'line') {
        // 矢印の場合は特別な処理を行う
        if (pathData.lineStyle === 'arrow') {
          // 矢印の先端部分に消しゴムが触れているかチェック
          const arrowHeadRegion = getArrowHeadRegion(pathData.startPoint, pathData.endPoint);
          const isErasingArrowHead = isPointInArrowHead(coords, arrowHeadRegion, eraserSize);
          
          if (isErasingArrowHead) {
            // 先端部分を消す場合は矢印全体を削除
            console.log('矢印の先端部分を削除するため、矢印全体を削除します');
            pathsToRemove.push(i);
          } else {
            // 線の部分のみの削除をチェック
            const segments = this.getLineSegmentsHalfGrid(pathData);
            const segmentsToRemove = [];
            
            for (let j = 0; j < segments.length; j++) {
              const segment = segments[j];
              // 先端部分と重複しないセグメントのみ削除対象とする
              if (!isSegmentInArrowHead(segment, arrowHeadRegion) &&
                  isPointNearLineSegment(coords, segment.start, segment.end, eraserSize)) {
                segmentsToRemove.push(j);
              }
            }
            
            if (segmentsToRemove.length > 0) {
              console.log('矢印の線部分のみを部分削除します');
              // 元のセグメント状態を保存
              const originalSegments = this.getLineSegmentsHalfGrid(pathData);
              // セグメントを削除して新しい線分を作成
              const newLines = this.removeLineSegmentsHalfGrid(pathData, segmentsToRemove);
              // セグメント状態を保存（新しい線分の統合セグメントを生成）
              let newSegments = [];
              newLines.forEach(line => {
                if (line.tool === 'line') {
                  const lineSegments = this.getLineSegmentsHalfGrid(line);
                  newSegments = newSegments.concat(lineSegments);
                }
              });
              // 元のパスと新しく作られるパス数を含めて保存
              this.saveLineSegmentState(i, originalSegments, newSegments, pathData, newLines.length);
              // 新しい線分にも矢印スタイルを継承
              newLines.forEach(line => {
                line.lineStyle = 'arrow';
              });
              pathsToModify.push({ index: i, newPaths: newLines });
            }
          }
          continue; // 矢印の処理完了
        }
        
        // 点線の場合は部分削除を可能にする（削除された部分は空白になる）
        if (pathData.lineStyle === 'dashed' || pathData.isDashed) {
          // 点線も通常の直線と同様に部分削除（半マスグリッドを使用）
          const segments = this.getLineSegmentsHalfGrid(pathData);
          const segmentsToRemove = [];
          
          for (let j = 0; j < segments.length; j++) {
            const segment = segments[j];
            if (isPointNearLineSegment(coords, segment.start, segment.end, eraserSize)) {
              segmentsToRemove.push(j);
            }
          }
          
          if (segmentsToRemove.length > 0) {
            console.log('点線の部分削除を実行します');
            // 元のセグメント状態を保存
            const originalSegments = this.getLineSegmentsHalfGrid(pathData);
            // セグメントを削除して新しい点線を作成
            const newLines = this.removeLineSegmentsHalfGrid(pathData, segmentsToRemove);
            // セグメント状態を保存（新しい線分の統合セグメントを生成）
            let newSegments = [];
            newLines.forEach(line => {
              if (line.tool === 'line') {
                const lineSegments = this.getLineSegmentsHalfGrid(line);
                newSegments = newSegments.concat(lineSegments);
              }
            });
            // 元のパスと新しく作られるパス数を含めて保存
            this.saveLineSegmentState(i, originalSegments, newSegments, pathData, newLines.length);
            // 新しい線分にも点線スタイルを継承
            newLines.forEach(line => {
              line.lineStyle = pathData.lineStyle || 'dashed';
              line.isDashed = true; // 後方互換性
            });
            pathsToModify.push({ index: i, newPaths: newLines });
          }
          continue; // 点線の処理完了
        }
        
        // 実線の直線の場合 - 半マス単位で部分削除（シンプル版）
        const segments = this.getLineSegmentsHalfGrid(pathData);
        const segmentsToRemove = [];
        
        for (let j = 0; j < segments.length; j++) {
          const segment = segments[j];
          if (isPointNearLineSegment(coords, segment.start, segment.end, eraserSize)) {
            segmentsToRemove.push(j);
          }
        }
        
        if (segmentsToRemove.length > 0) {
          // 元のセグメント状態を保存
          const originalSegments = this.getLineSegmentsHalfGrid(pathData);
          // セグメントを削除して新しい線分を作成
          const newLines = this.removeLineSegmentsHalfGrid(pathData, segmentsToRemove);
          // セグメント状態を保存（新しい線分の統合セグメントを生成）
          let newSegments = [];
          newLines.forEach(line => {
            if (line.tool === 'line') {
              const lineSegments = this.getLineSegmentsHalfGrid(line);
              newSegments = newSegments.concat(lineSegments);
            }
          });
          // 元のパスと新しく作られるパス数を含めて保存
          this.saveLineSegmentState(i, originalSegments, newSegments, pathData, newLines.length);
          pathsToModify.push({ index: i, newPaths: newLines });
        }
      } else if (pathData.tool === 'rectangle') {
        // 四角形の場合 - 半マス単位で辺ごとに部分削除
        const rectangleSegments = this.getRectangleSegmentsHalfGrid(pathData);
        const segmentsToRemove = [];
        
        for (let j = 0; j < rectangleSegments.length; j++) {
          const segment = rectangleSegments[j];
          if (isPointNearLineSegment(coords, segment.start, segment.end, eraserSize)) {
            segmentsToRemove.push(j);
          }
        }
        
        if (segmentsToRemove.length > 0) {
          // 元のセグメント状態を保存
          const originalSegments = this.getRectangleSegmentsHalfGrid(pathData);
          // 残った辺で新しい線分を作成
          const newLines = this.removeRectangleSegmentsHalfGrid(pathData, segmentsToRemove);
          // セグメント状態を保存（新しい線分の統合セグメントを生成）
          let newSegments = [];
          newLines.forEach(line => {
            if (line.tool === 'line') {
              const lineSegments = this.getLineSegmentsHalfGrid(line);
              newSegments = newSegments.concat(lineSegments);
            }
          });
          // 元のパスと新しく作られるパス数を含めて保存
          this.saveLineSegmentState(i, originalSegments, newSegments, pathData, newLines.length);
          pathsToModify.push({ index: i, newPaths: newLines });
        }
      } else if (pathData.tool === 'stairs') {
        // 階段の場合 - 階段記号全体を削除
        if (this.isPointNearShape(coords, pathData, eraserSize)) {
          console.log('階段を削除します:', { coords, startPoint: pathData.startPoint, endPoint: pathData.endPoint, stairWidth: pathData.stairWidth });
          pathsToRemove.push(i);
        } else {
          console.log('階段判定: ヒットせず', { coords, distance: distanceToLine(coords, pathData.startPoint, pathData.endPoint), eraserSize });
        }
      } else if (pathData.tool === 'door') {
        // 扉の場合 - 扉全体を削除
        if (this.isPointNearShape(coords, pathData, eraserSize)) {
          console.log('扉を削除します');
          pathsToRemove.push(i);
        }
      } else if (pathData.tool === 'fill') {
        // 塗りつぶしの場合 - 個別の位置を削除
        if (pathData.positions) {
          const remainingPositions = pathData.positions.filter(pos => {
            // 消しゴムの位置と塗りつぶし位置の距離を計算
            const centerX = pos.x + pos.size / 2;
            const centerY = pos.y + pos.size / 2;
            const distance = Math.sqrt(
              Math.pow(coords.x - centerX, 2) + Math.pow(coords.y - centerY, 2)
            );
            // 消しゴムサイズ + 塗りつぶしサイズの半分以内なら削除
            return distance > eraserSize + pos.size / 2;
          });
          
          if (remainingPositions.length === 0) {
            // 全ての位置が削除された場合、パス全体を削除
            pathsToRemove.push(i);
          } else if (remainingPositions.length < pathData.positions.length) {
            // 一部の位置が削除された場合、パスを更新
            pathData.positions = remainingPositions;
            console.log('塗りつぶしの一部を削除:', {
              削除前: pathData.positions.length + remainingPositions.length,
              削除後: remainingPositions.length
            });
          }
        }
      } else if (pathData.startPoint && pathData.endPoint) {
        // その他の図形の場合 - 全体を削除
        if (this.isPointNearShape(coords, pathData, eraserSize)) {
          pathsToRemove.push(i);
        }
      }
    }
    
    // 重複を除去して逆順でソート（インデックスが変わらないように）
    const uniqueIndices = [...new Set(pathsToRemove)].sort((a, b) => b - a);
    
    // パスが削除される場合は履歴を保存
    if (uniqueIndices.length > 0 || pathsToModify.length > 0) {
      console.error('消しゴム操作: パス削除前に履歴を保存', { uniqueIndices, pathsToModifyLength: pathsToModify.length, allPathsLength: this.allPaths.length });
      
      // 完全削除された要素を記録（統合処理のため）
      if (uniqueIndices.length > 0) {
        const indicesToDelete = [...uniqueIndices].sort((a, b) => a - b); // 昇順でソート
        for (const index of indicesToDelete) {
          const pathToDelete = this.allPaths[index];
          if (pathToDelete) {
            // 完全削除情報をeraserOperationChangesに蓄積
            this.eraserOperationChanges.push({
              operationType: 'fullDelete',
              pathIndex: index,
              deletedPath: {...pathToDelete},
              timestamp: Date.now()
            });
            console.log('完全削除を蓄積:', { index, pathTool: pathToDelete.tool, pathText: pathToDelete.text || 'N/A' });
          }
        }
      }
      
      // 部分削除は saveLineSegmentState で eraserOperationChanges に蓄積され、stopEraserOperationで保存
      console.log('部分削除対象:', pathsToModify.length, '個');
      
      // 消しゴム操作として lastOperationType を設定
      this.lastOperationType = 'eraser';
      
      console.log('消しゴム操作完了 - lastOperationType設定:', {
        lastOperationType: this.lastOperationType,
        pathsDeleted: uniqueIndices.length,
        pathsModified: pathsToModify.length
      });
      
      // 他のredoスタックをクリア（操作の整合性のため）
      this.redoStack = [];
      this.segmentRedoStack = [];
      this.eraserRedoStack = [];
    }
    
    // パスを削除
    for (const index of uniqueIndices) {
      console.error('パスを削除:', { index, pathTool: this.allPaths[index]?.tool });
      this.allPaths.splice(index, 1);
    }
    
    // 線分の部分削除を処理（削除後のインデックス調整が必要）
    pathsToModify.sort((a, b) => b.index - a.index); // 逆順でソート
    
    for (const modification of pathsToModify) {
      let adjustedIndex = modification.index;
      // 削除されたパスの数だけインデックスを調整
      for (const removedIndex of uniqueIndices) {
        if (removedIndex < modification.index) {
          adjustedIndex--;
        }
      }
      
      // 元のパスを削除
      this.allPaths.splice(adjustedIndex, 1);
      // 新しいパスを挿入
      this.allPaths.splice(adjustedIndex, 0, ...modification.newPaths);
    }
    
    if (uniqueIndices.length > 0 || pathsToModify.length > 0) {
      // 消しゴム操作として履歴管理
      this.lastOperationType = 'eraser';
      
      this.redrawCanvas();
      
      console.log('消しゴム操作完了:', {
        deletedPaths: uniqueIndices.length,
        modifiedPaths: pathsToModify.length,
        lastOperationType: this.lastOperationType
      });
    }
  }

  updateEraserPreview(event) {
    // マウス移動の間引き処理
    const now = performance.now();
    if (this.lastMouseMoveTime && (now - this.lastMouseMoveTime) < this.mouseMoveThrottleMs) {
      return;
    }
    this.lastMouseMoveTime = now;
    
    // デバウンシング処理で不要な再描画を防止
    if (this.eraserPreviewTimeout) {
      clearTimeout(this.eraserPreviewTimeout);
    }
    
    const coords = this.getCoordinates(event);
    this.eraserPreviewCoords = coords;
    this.showEraserPreview = true;
    
    this.eraserPreviewTimeout = setTimeout(() => {
      this.redrawCanvas();
    }, this.redrawThrottleMs); // 統一された間引き間隔を使用
  }

  // タッチデバイス用の消しゴムプレビュー開始
  startTouchEraserPreview(event) {
    const coords = this.getCoordinates(event);
    this.eraserPreviewCoords = coords;
    this.showEraserPreview = true;
    this.isShowingTouchPreview = true;
    this.redrawCanvas();
    
    // 短時間プレビューを表示してから消去開始
    this.touchPreviewTimer = setTimeout(() => {
      this.isShowingTouchPreview = false;
      this.isDrawing = true;
      this.startPoint = coords;
      this.currentPath = [coords];
      this.canvas.classList.add('drawing');
      this.eraseAtPoint(coords);
    }, 300); // 300ms後に消去開始
  }

  // タッチプレビューのキャンセル
  cancelTouchEraserPreview() {
    if (this.touchPreviewTimer) {
      clearTimeout(this.touchPreviewTimer);
      this.touchPreviewTimer = null;
    }
    this.isShowingTouchPreview = false;
    this.showEraserPreview = false;
    this.redrawCanvas();
  }

  drawEraserPreview() {
    if (!this.eraserPreviewCoords) return;
    
    const eraserSize = this.eraserSize; // 独立した消しゴムサイズを使用
    const coords = this.eraserPreviewCoords;
    
    // 消しゴムの範囲を表示
    this.ctx.save();
    
    // タッチプレビュー中はより目立つ表示
    if (this.isShowingTouchPreview) {
      this.ctx.strokeStyle = '#FF3030';
      this.ctx.fillStyle = 'rgba(255, 48, 48, 0.4)';
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([4, 4]);
    } else {
      this.ctx.strokeStyle = '#FF6B6B';
      this.ctx.fillStyle = 'rgba(255, 107, 107, 0.2)';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
    }
    
    // 消しゴムの円を描画
    this.ctx.beginPath();
    this.ctx.arc(coords.x, coords.y, eraserSize, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    // 中央のクロスヘア（タッチデバイス用）
    if (this.isShowingTouchPreview) {
      this.ctx.strokeStyle = '#FF3030';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(coords.x - 6, coords.y);
      this.ctx.lineTo(coords.x + 6, coords.y);
      this.ctx.moveTo(coords.x, coords.y - 6);
      this.ctx.lineTo(coords.x, coords.y + 6);
      this.ctx.stroke();
    }
    
    // 影響を受ける要素をハイライト
    this.highlightTargetElements(coords, eraserSize);
    
    this.ctx.restore();
  }

  highlightTargetElements(coords, eraserSize) {
    const targetElements = [];
    const targetSegments = [];
    
    // 削除対象の要素を見つける
    for (let i = 0; i < this.allPaths.length; i++) {
      const pathData = this.allPaths[i];
      let isTarget = false;
      
      if (pathData.tool === 'pen') {
        // フリーハンドの場合
        for (let j = 0; j < pathData.path.length; j++) {
          const point = pathData.path[j];
          const distance = Math.sqrt(
            Math.pow(coords.x - point.x, 2) + Math.pow(coords.y - point.y, 2)
          );
          
          if (distance <= eraserSize) {
            isTarget = true;
            break;
          }
        }
        
        if (isTarget) {
          targetElements.push(pathData);
        }
      } else if (pathData.tool === 'textbox') {
        // テキストボックスの場合
        if (this.isPointInTextBox(coords, pathData)) {
          targetElements.push(pathData);
        }
      } else if (pathData.tool === 'line') {
        // 直線の場合 - セグメント単位でハイライト
        const segments = this.getLineSegments(pathData);
        const matchingSegments = [];
        
        for (let j = 0; j < segments.length; j++) {
          const segment = segments[j];
          if (isPointNearLineSegment(coords, segment.start, segment.end, eraserSize)) {
            matchingSegments.push(segment);
          }
        }
        
        // 連続するセグメントをグループ化してハイライト
        if (matchingSegments.length > 0) {
          const groupedSegments = this.groupConsecutiveSegments(matchingSegments);
          targetSegments.push(...groupedSegments);
        }
      } else if (pathData.startPoint && pathData.endPoint) {
        // 四角形、円の場合
        if (this.isPointNearShape(coords, pathData, eraserSize)) {
          targetElements.push(pathData);
        }
      }
    }
    
    // 対象要素をハイライト（全体削除）
    this.ctx.save();
    this.ctx.strokeStyle = '#FF6B6B';
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([3, 3]);
    
    targetElements.forEach(pathData => {
      this.ctx.beginPath();
      
      if (pathData.tool === 'pen') {
        // フリーハンド描画のハイライト
        if (pathData.path.length > 0) {
          this.ctx.moveTo(pathData.path[0].x, pathData.path[0].y);
          pathData.path.forEach(point => {
            this.ctx.lineTo(point.x, point.y);
          });
        }
      } else if (pathData.tool === 'textbox') {
        // テキストボックスのハイライト
        this.ctx.rect(pathData.x, pathData.y, pathData.width, pathData.height);
      } else if (pathData.startPoint && pathData.endPoint) {
        // 図形のハイライト
        switch (pathData.tool) {
          case 'line':
            this.ctx.moveTo(pathData.startPoint.x, pathData.startPoint.y);
            this.ctx.lineTo(pathData.endPoint.x, pathData.endPoint.y);
            break;
          case 'rectangle':
            const width = pathData.endPoint.x - pathData.startPoint.x;
            const height = pathData.endPoint.y - pathData.startPoint.y;
            this.ctx.rect(pathData.startPoint.x, pathData.startPoint.y, width, height);
            break;
          case 'circle':
            const radius = Math.sqrt(
              Math.pow(pathData.endPoint.x - pathData.startPoint.x, 2) + 
              Math.pow(pathData.endPoint.y - pathData.startPoint.y, 2)
            );
            this.ctx.arc(pathData.startPoint.x, pathData.startPoint.y, radius, 0, 2 * Math.PI);
            break;
        }
      }
      
      this.ctx.stroke();
    });
    
    // 対象セグメントをハイライト（部分削除）
    this.ctx.strokeStyle = '#FF3030';
    this.ctx.lineWidth = 6; // より太く表示
    this.ctx.setLineDash([4, 2]); // より細かい点線
    
    targetSegments.forEach(segmentGroup => {
      this.ctx.beginPath();
      this.ctx.moveTo(segmentGroup.start.x, segmentGroup.start.y);
      this.ctx.lineTo(segmentGroup.end.x, segmentGroup.end.y);
      this.ctx.stroke();
    });
    
    this.ctx.setLineDash([]);
    this.ctx.restore();
  }
  
  // 連続するセグメントをグループ化
  groupConsecutiveSegments(segments) {
    if (segments.length === 0) return [];
    
    // インデックスでソート
    segments.sort((a, b) => a.index - b.index);
    
    const groups = [];
    let currentGroup = [segments[0]];
    
    for (let i = 1; i < segments.length; i++) {
      const current = segments[i];
      const previous = segments[i - 1];
      
      // 連続するインデックスの場合は同じグループに追加
      if (current.index === previous.index + 1) {
        currentGroup.push(current);
      } else {
        // グループを完了して新しいグループを開始
        if (currentGroup.length > 0) {
          groups.push({
            start: currentGroup[0].start,
            end: currentGroup[currentGroup.length - 1].end
          });
        }
        currentGroup = [current];
      }
    }
    
    // 最後のグループを追加
    if (currentGroup.length > 0) {
      groups.push({
        start: currentGroup[0].start,
        end: currentGroup[currentGroup.length - 1].end
      });
    }
    
    return groups;
  }

  isPointNearShape(coords, pathData, tolerance) {
    const { startPoint, endPoint } = pathData;
    
    switch (pathData.tool) {
      case 'line':
        return distanceToLine(coords, startPoint, endPoint) <= tolerance;
      case 'rectangle':
        return isPointNearRectangle(coords, startPoint, endPoint, tolerance);
      case 'circle':
        return isPointNearCircle(coords, startPoint, endPoint, tolerance);
      case 'stairs':
        // 階段は中心線（矢印線）と段鼻線（横線）の両方で判定
        return this.isPointNearStairs(coords, startPoint, endPoint, pathData.stairWidth || this.gridSize, tolerance);
      case 'door':
        // 扉は専用の判定メソッドで、扉の幅を考慮した判定
        return this.isPointNearDoor(coords, startPoint, endPoint, pathData.doorType, tolerance, pathData.openingSize);
      default:
        return false;
    }
  }

  // 階段との距離判定（矢印線と段鼻線の両方を考慮）
  isPointNearStairs(coords, startPoint, endPoint, stairWidth, tolerance) {
    // 1. 中心線（矢印線）との距離をチェック
    if (distanceToLine(coords, startPoint, endPoint) <= tolerance) {
      return true;
    }
    
    // 2. 段鼻線（横線）との距離をチェック
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return false;
    
    // 単位ベクトル
    const unitX = dx / length;
    const unitY = dy / length;
    
    // 垂直ベクトル（段鼻線用）
    const perpX = -unitY;
    const perpY = unitX;
    
    const halfWidth = stairWidth / 2;
    const stepSpacing = length / (10 + 1); // 固定段数10
    
    // 各段鼻線との距離をチェック
    for (let i = 1; i <= 10; i++) {
      const t = i * stepSpacing / length;
      if (t >= 1) break;
      
      const stepX = startPoint.x + dx * t;
      const stepY = startPoint.y + dy * t;
      
      const stepStart = {
        x: stepX + perpX * halfWidth,
        y: stepY + perpY * halfWidth
      };
      const stepEnd = {
        x: stepX - perpX * halfWidth,
        y: stepY - perpY * halfWidth
      };
      
      if (distanceToLine(coords, stepStart, stepEnd) <= tolerance) {
        return true;
      }
    }
    
    return false;
  }

  // 扉との距離判定（扉の幅を考慮した拡張判定）
  isPointNearDoor(coords, startPoint, endPoint, doorType, tolerance, openingSize = 'half') {
    // 開口部の場合は矩形範囲での判定
    if (doorType === 'smallbox') {
      // サイズに応じたマス数を決定
      let sizeMultiplier;
      switch (openingSize) {
        case 'quarter':
          sizeMultiplier = 0.25;
          break;
        case 'one':
          sizeMultiplier = 1;
          break;
        default: // 'half'
          sizeMultiplier = 0.5;
      }
      const boxSize = this.gridSize * sizeMultiplier;
      
      // 矩形範囲内かチェック
      const left = Math.min(startPoint.x, endPoint.x);
      const right = Math.max(startPoint.x, endPoint.x) || (startPoint.x + boxSize);
      const top = Math.min(startPoint.y, endPoint.y);
      const bottom = Math.max(startPoint.y, endPoint.y) || (startPoint.y + boxSize);
      
      // 許容範囲を加えた矩形判定
      return coords.x >= (left - tolerance) && 
             coords.x <= (right + tolerance) &&
             coords.y >= (top - tolerance) && 
             coords.y <= (bottom + tolerance);
    }
    
    // 通常の扉の当たり判定
    const baseDistance = distanceToLine(coords, startPoint, endPoint);
    
    // 扉の種類によって当たり判定の範囲を調整
    let expandedTolerance = tolerance;
    
    // 扉は視覚的に幅があるため、基本判定範囲を拡大
    expandedTolerance *= 2.0; // 基本の2倍に拡大
    
    // 両開き扉の場合はさらに範囲を拡大
    if (doorType === 'double') {
      expandedTolerance *= 1.5; // 両開きの場合はさらに1.5倍
    }
    
    // 基本の中心線判定
    if (baseDistance <= expandedTolerance) {
      return true;
    }
    
    // 扉の端部分（ヒンジ部分）の当たり判定も追加
    const doorWidth = 40; // 扉の標準幅
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return false;
    
    // 扉に垂直な方向のベクトル
    const perpDx = -dy / length;
    const perpDy = dx / length;
    
    // 扉の両端での当たり判定（ヒンジ付近）
    const doorEnd1 = {
      x: startPoint.x + perpDx * doorWidth / 2,
      y: startPoint.y + perpDy * doorWidth / 2
    };
    const doorEnd2 = {
      x: startPoint.x - perpDx * doorWidth / 2,
      y: startPoint.y - perpDy * doorWidth / 2
    };
    
    // 扉の端部分への当たり判定
    const distToEnd1 = Math.sqrt((coords.x - doorEnd1.x) ** 2 + (coords.y - doorEnd1.y) ** 2);
    const distToEnd2 = Math.sqrt((coords.x - doorEnd2.x) ** 2 + (coords.y - doorEnd2.y) ** 2);
    
    if (distToEnd1 <= tolerance || distToEnd2 <= tolerance) {
      return true;
    }
    
    return false;
  }

  // distanceToLine / isPointNearLineSegmentImproved / isPointNearRectangle / isPointNearCircle は
  // canvas/geometry.js に純関数として抽出済み（このクラスからは削除）

  // 直線を細かいセグメントに分割（消しゴムサイズベース、グリッド非依存）
  getLineSegments(pathData) {
    const { startPoint, endPoint } = pathData;
    const segments = [];
    
    // 直線の長さを計算
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    // 消しゴムサイズの1/3を基準にセグメント数を計算（非常に細かく分割）
    const eraserSize = this.strokeWidth * 4;
    const segmentLength = eraserSize / 3; // より細かく分割
    const segmentCount = Math.max(1, Math.ceil(length / segmentLength));
    
    // 各セグメントの開始点と終了点を計算
    for (let i = 0; i < segmentCount; i++) {
      const t1 = i / segmentCount;
      const t2 = (i + 1) / segmentCount;
      
      const segmentStart = {
        x: startPoint.x + dx * t1,
        y: startPoint.y + dy * t1
      };
      
      const segmentEnd = {
        x: startPoint.x + dx * t2,
        y: startPoint.y + dy * t2
      };
      
      segments.push({
        start: segmentStart,
        end: segmentEnd,
        index: i
      });
    }
    
    return segments;
  }

  // isPointNearLineSegment は canvas/geometry.js に抽出済み

  // 指定されたセグメントを削除して新しい線分を作成
  removeLineSegments(pathData, segmentsToRemove) {
    const allSegments = this.getLineSegments(pathData);
    const newLines = [];
    
    // 削除するセグメントのインデックスをセットに変換
    const removeSet = new Set(segmentsToRemove);
    
    // 連続する残存セグメントをグループ化
    let currentGroup = [];
    
    for (let i = 0; i < allSegments.length; i++) {
      if (!removeSet.has(i)) {
        // このセグメントは残す
        currentGroup.push(allSegments[i]);
      } else {
        // このセグメントは削除 - 現在のグループを完了
        if (currentGroup.length > 0) {
          const newLine = createLineFromSegments(currentGroup, pathData);
          if (newLine) {
            newLines.push(newLine);
          }
          currentGroup = [];
        }
      }
    }
    
    // 最後のグループを処理
    if (currentGroup.length > 0) {
      const newLine = createLineFromSegments(currentGroup, pathData);
      if (newLine) {
        newLines.push(newLine);
      }
    }
    
    return newLines;
  }

  // createLineFromSegments は canvas/geometry.js に抽出済み

  // ズーム機能
  zoomAt(x, y, zoom) {
    console.log('zoomAt called:', { x, y, zoom, currentScale: this.scale });
    
    const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * zoom));
    
    if (newScale !== this.scale) {
      // 高DPI対応
      const dpr = window.devicePixelRatio || 1;
      x *= dpr;
      y *= dpr;
      
      const scaleDiff = newScale / this.scale;
      
      // ズーム中心を基準に平行移動を調整
      this.translateX = x - (x - this.translateX) * scaleDiff;
      this.translateY = y - (y - this.translateY) * scaleDiff;
      
      this.scale = newScale;
      console.log('Zoom applied. New scale:', this.scale, 'translate:', this.translateX, this.translateY);
      this.redrawCanvas();
    }
  }

  // ピンチジェスチャー用ヘルパー
  getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getPinchCenter(touches) {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      x: ((touches[0].clientX + touches[1].clientX) / 2 - rect.left) * dpr,
      y: ((touches[0].clientY + touches[1].clientY) / 2 - rect.top) * dpr
    };
  }

  // ズームリセット
  resetZoom() {
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.redrawCanvas();
  }

  // グリッド描画
  drawGrid() {
    if (!this.snapToGrid) return;
    
    const ctx = this.ctx;
    
    // 現在のビューポートの範囲を計算（変換座標系で）
    const viewLeft = -this.translateX / this.scale;
    const viewTop = -this.translateY / this.scale;
    const viewRight = (this.canvas.width - this.translateX) / this.scale;
    const viewBottom = (this.canvas.height - this.translateY) / this.scale;
    
    ctx.save();
    
    // 0.5マスのグリッド線（20px間隔）- 薄いグレー
    const halfGridSize = this.gridSize / 2; // 20px
    const halfStartX = Math.floor(viewLeft / halfGridSize) * halfGridSize;
    const halfStartY = Math.floor(viewTop / halfGridSize) * halfGridSize;
    const halfEndX = Math.ceil(viewRight / halfGridSize) * halfGridSize;
    const halfEndY = Math.ceil(viewBottom / halfGridSize) * halfGridSize;
    
    // 0.5マス: ごく薄い細い実線（サブグリッド）
    ctx.strokeStyle = '#ececec';
    ctx.lineWidth = 0.5 / this.scale;
    ctx.beginPath();
    for (let x = halfStartX; x <= halfEndX; x += halfGridSize) {
      ctx.moveTo(x, viewTop);
      ctx.lineTo(x, viewBottom);
    }
    for (let y = halfStartY; y <= halfEndY; y += halfGridSize) {
      ctx.moveTo(viewLeft, y);
      ctx.lineTo(viewRight, y);
    }
    ctx.stroke();

    // 1マス: 中庸の実線（主グリッド、目立ちすぎないが視認できる程度）
    const startX = Math.floor(viewLeft / this.gridSize) * this.gridSize;
    const startY = Math.floor(viewTop / this.gridSize) * this.gridSize;
    const endX = Math.ceil(viewRight / this.gridSize) * this.gridSize;
    const endY = Math.ceil(viewBottom / this.gridSize) * this.gridSize;

    ctx.strokeStyle = '#bbbbbb';
    ctx.lineWidth = 1 / this.scale;
    ctx.setLineDash([]);
    ctx.beginPath();
    for (let x = startX; x <= endX; x += this.gridSize) {
      ctx.moveTo(x, viewTop);
      ctx.lineTo(x, viewBottom);
    }
    for (let y = startY; y <= endY; y += this.gridSize) {
      ctx.moveTo(viewLeft, y);
      ctx.lineTo(viewRight, y);
    }
    ctx.stroke();
    
    // 0.25マス間隔の点を描画（クォーターグリッド）
    const quarterGridSize = this.gridSize / 4; // 10px
    const quarterStartX = Math.floor(viewLeft / quarterGridSize) * quarterGridSize;
    const quarterStartY = Math.floor(viewTop / quarterGridSize) * quarterGridSize;
    const quarterEndX = Math.ceil(viewRight / quarterGridSize) * quarterGridSize;
    const quarterEndY = Math.ceil(viewBottom / quarterGridSize) * quarterGridSize;
    
    ctx.fillStyle = '#cccccc'; // 薄いグリッド線と同じ色の点
    
    // 0.25マス間隔で点を描画
    for (let x = quarterStartX; x <= quarterEndX; x += quarterGridSize) {
      for (let y = quarterStartY; y <= quarterEndY; y += quarterGridSize) {
        // グリッド線上には点を描画しない
        const isOnVerticalLine = (x % halfGridSize === 0); // 縦線上
        const isOnHorizontalLine = (y % halfGridSize === 0); // 横線上
        
        // 線上でない0.25マス位置のみに点を描画
        if (!isOnVerticalLine && !isOnHorizontalLine) {
          const pointSize = Math.max(1.5 / this.scale, 0.8); // 最小0.8px、ズームで調整
          ctx.beginPath();
          ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
    
    // 中心線を描画（X軸とY軸）
    ctx.strokeStyle = '#999999'; // グレーの中心線
    ctx.lineWidth = 3 / this.scale; // 少し太めの線
    ctx.setLineDash([]);
    ctx.beginPath();
    
    // キャンバスの真の中心座標を計算（0,0を中心とする）
    const centerX = 0; // ワールド座標系の中心X
    const centerY = 0; // ワールド座標系の中心Y
    
    // 垂直中心線（Y軸）- 中心を通る垂直線
    if (centerX >= viewLeft && centerX <= viewRight) {
      ctx.moveTo(centerX, viewTop);
      ctx.lineTo(centerX, viewBottom);
    }
    
    // 水平中心線（X軸）- 中心を通る水平線
    if (centerY >= viewTop && centerY <= viewBottom) {
      ctx.moveTo(viewLeft, centerY);
      ctx.lineTo(viewRight, centerY);
    }
    
    ctx.stroke();
    
    ctx.restore();
  }

  // セグメント変更の状態を保存
  saveLineSegmentState(pathIndex, originalSegments, newSegments, originalPath = null, newPathsCount = 0) {
    console.log('セグメント状態を保存:', { 
      pathIndex, 
      originalSegmentsCount: originalSegments?.length, 
      newSegmentsCount: newSegments?.length,
      newPathsCount 
    });
    
    // 消しゴム操作中の場合は、蓄積して後でまとめて保存
    if (this.eraserOperationActive) {
      this.eraserOperationChanges.push({
        pathIndex: pathIndex,
        originalSegments: originalSegments ? [...originalSegments] : null,
        newSegments: newSegments ? [...newSegments] : null,
        originalPath: originalPath ? JSON.parse(JSON.stringify(originalPath)) : null,
        newPathsCount: newPathsCount,
        timestamp: Date.now()
      });
      console.log('消しゴム操作中 - 変更を蓄積:', this.eraserOperationChanges.length);
      return;
    }
    
    // 通常のセグメント変更履歴に保存
    const segmentChange = {
      pathIndex: pathIndex,
      originalSegments: originalSegments ? [...originalSegments] : null,
      newSegments: newSegments ? [...newSegments] : null,
      originalPath: originalPath ? JSON.parse(JSON.stringify(originalPath)) : null,
      newPathsCount: newPathsCount,
      timestamp: Date.now()
    };
    
    this.segmentHistory.push(segmentChange);
    
    // セグメント操作として記録
    this.lastOperationType = 'segment';
    
    // セグメント変更時はredoスタックをクリア
    this.segmentRedoStack = [];
    
    console.log('セグメント履歴に保存完了:', {
      segmentHistoryLength: this.segmentHistory.length,
      savedChange: segmentChange
    });
  }

  // 消しゴム操作完了処理
  finishEraserOperation() {
    if (this.eraserOperationChanges.length === 0) {
      this.eraserOperationActive = false;
      return;
    }
    
    console.log('消しゴム操作完了 - まとめて履歴に保存:', this.eraserOperationChanges.length);
    
    // 1つの統合されたセグメント変更として保存
    const combinedChange = {
      pathIndex: -1, // 消しゴム操作の識別子
      originalSegments: null,
      newSegments: null,
      originalPath: null,
      newPathsCount: 0,
      eraserOperationChanges: [...this.eraserOperationChanges], // 個別変更の詳細
      timestamp: Date.now()
    };
    
    this.segmentHistory.push(combinedChange);
    this.lastOperationType = 'eraser';
    this.segmentRedoStack = [];
    
    console.log('消しゴム操作の統合履歴保存完了:', {
      segmentHistoryLength: this.segmentHistory.length,
      lastOperationType: this.lastOperationType,
      eraserChangesCount: this.eraserOperationChanges.length
    });
    
    // クリア
    this.eraserOperationActive = false;
    this.eraserOperationChanges = [];
    
    console.log('消しゴム操作の統合履歴保存完了');
  }

  // セグメント変更の状態を復元
  restoreLineSegmentState(segmentChange) {
    console.log('セグメント状態を復元:', segmentChange);
    
    // 統合された消しゴム操作の復元
    if (segmentChange.eraserOperationChanges) {
      console.log('統合された消しゴム操作を復元:', segmentChange.eraserOperationChanges.length);
      
      // 逆順で復元（最後の変更から先に戻す）
      for (let i = segmentChange.eraserOperationChanges.length - 1; i >= 0; i--) {
        const change = segmentChange.eraserOperationChanges[i];
        if (change.originalPath) {
          // パス復元
          this.allPaths.splice(change.pathIndex, change.newPathsCount);
          this.allPaths.splice(change.pathIndex, 0, change.originalPath);
        }
      }
      console.log('統合された消しゴム操作の復元完了');
      return true;
    }

    // 消しゴム操作の識別子チェック
    if (segmentChange.pathIndex === -1) {
      console.log('消しゴム操作データ（無効な操作）をスキップ');
      return false;
    }

    if (!segmentChange || typeof segmentChange.pathIndex !== 'number') {
      console.warn('無効なセグメント変更データ:', segmentChange);
      return false;
    }

    // パスインデックスの調整（削除されたパスがある場合を考慮）
    if (segmentChange.pathIndex >= this.allPaths.length) {
      console.warn('復元対象のパスインデックスが範囲外:', segmentChange.pathIndex, 'allPathsLength:', this.allPaths.length);
      return false;
    }
    
    // 元のパス情報が保存されている場合はそれを使用
    if (segmentChange.originalPath) {
      console.log('元のパス情報から復元:', {
        pathIndex: segmentChange.pathIndex,
        newPathsCount: segmentChange.newPathsCount || 1
      });
      
      // 新しく作られたパス（分割された線分）を削除
      const pathsToRemove = segmentChange.newPathsCount || 1;
      this.allPaths.splice(segmentChange.pathIndex, pathsToRemove);
      
      // 元のパスを復元
      this.allPaths.splice(segmentChange.pathIndex, 0, segmentChange.originalPath);
      
      console.log('パス復元完了:', {
        restoredPath: segmentChange.originalPath.tool,
        newAllPathsLength: this.allPaths.length
      });
      
      return true;
    }
    
    // フォールバック: セグメントから再構築（後方互換性）
    if (segmentChange.originalSegments && segmentChange.originalSegments.length > 0) {
      console.log('セグメントから再構築（フォールバック）:', {
        pathIndex: segmentChange.pathIndex,
        originalSegmentsCount: segmentChange.originalSegments.length
      });
      
      // 分割されたパスを削除
      const pathsToRemove = segmentChange.newPathsCount || 1;
      this.allPaths.splice(segmentChange.pathIndex, pathsToRemove);
      
      // セグメントから新しいパスを再構築
      const reconstructedPaths = this.reconstructPathsFromSegments(segmentChange.originalSegments);
      this.allPaths.splice(segmentChange.pathIndex, 0, ...reconstructedPaths);
      
      console.log('パス再構築完了:', {
        reconstructedPathsCount: reconstructedPaths.length,
        newAllPathsLength: this.allPaths.length
      });
      
      return true;
    }
    
    console.warn('復元するデータがありません');
    return false;
  }

  // セグメントからパスを再構築するメソッド
  reconstructPathsFromSegments(segments) {
    if (!segments || segments.length === 0) return [];
    
    console.log('セグメントからパス再構築開始:', { segmentsCount: segments.length });
    
    // セグメントを辺ごとに分類（四角形の場合）
    const segmentsBySide = {};
    const lineSegments = [];
    
    segments.forEach(segment => {
      if (segment.side) {
        // 四角形のセグメント
        if (!segmentsBySide[segment.side]) {
          segmentsBySide[segment.side] = [];
        }
        segmentsBySide[segment.side].push(segment);
      } else {
        // 直線のセグメント
        lineSegments.push(segment);
      }
    });
    
    const reconstructedPaths = [];
    
    // 四角形の辺を再構築
    Object.keys(segmentsBySide).forEach(side => {
      const sideSegments = segmentsBySide[side];
      if (sideSegments.length === 0) return;
      
      // 連続するセグメントを結合して線分を作成
      const lines = this.combineSegmentsToLines(sideSegments);
      reconstructedPaths.push(...lines);
    });
    
    // 直線セグメントを再構築
    if (lineSegments.length > 0) {
      const lines = this.combineSegmentsToLines(lineSegments);
      reconstructedPaths.push(...lines);
    }
    
    console.log('パス再構築完了:', { reconstructedPathsCount: reconstructedPaths.length });
    return reconstructedPaths;
  }

  // セグメントを結合して線分に変換
  combineSegmentsToLines(segments) {
    if (segments.length === 0) return [];
    
    // セグメントを位置でソート
    segments.sort((a, b) => {
      const aDist = Math.sqrt(a.start.x * a.start.x + a.start.y * a.start.y);
      const bDist = Math.sqrt(b.start.x * b.start.x + b.start.y * b.start.y);
      return aDist - bDist;
    });
    
    const lines = [];
    let currentLine = null;
    
    for (const segment of segments) {
      if (!currentLine) {
        currentLine = {
          tool: 'line',
          startPoint: { ...segment.start },
          endPoint: { ...segment.end },
          strokeColor: segment.strokeColor || '#000000',
          strokeWidth: segment.strokeWidth || 2
        };
      } else {
        // 連続するセグメントかチェック
        const distance = Math.sqrt(
          Math.pow(currentLine.endPoint.x - segment.start.x, 2) +
          Math.pow(currentLine.endPoint.y - segment.start.y, 2)
        );
        
        if (distance < 5) { // 5px以内なら連続
          currentLine.endPoint = { ...segment.end };
        } else {
          lines.push(currentLine);
          currentLine = {
            tool: 'line',
            startPoint: { ...segment.start },
            endPoint: { ...segment.end },
            strokeColor: segment.strokeColor || '#000000',
            strokeWidth: segment.strokeWidth || 2
          };
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  undo() {
    console.log('Undo実行前の状態:', {
      allPathsLength: this.allPaths.length,
      redoStackLength: this.redoStack.length,
      segmentHistoryLength: this.segmentHistory.length,
      segmentRedoStackLength: this.segmentRedoStack.length,
      eraserHistoryLength: this.eraserHistory.length,
      lastOperationType: this.lastOperationType
    });
    
    // 最後の操作タイプに基づいて正しい順序でundoを実行
    let undone = false;
    
    // 0. 最後の操作タイプが消しゴム操作の場合
    if (this.lastOperationType === 'eraser' && this.eraserHistory.length > 0) {
      console.log('消しゴム操作をundo');
      // 消しゴム操作のundo（最後に削除されたオブジェクトを一つ復元）
      const eraserOp = this.eraserHistory.pop();
      console.error('消しゴム操作をundo中:', eraserOp);
      
      if (eraserOp.operationType === 'mixed') {
        // 混合操作（完全削除と部分削除の組み合わせ）の復元
        console.error('混合消しゴム操作をundo:', { 
          fullDeleteCount: eraserOp.fullDeletes?.length || 0,
          hasPartialDelete: !!eraserOp.partialDeletes 
        });
        
        // redoスタックに情報を保存
        this.eraserRedoStack.push({
          operationType: 'mixed',
          fullDeletes: eraserOp.fullDeletes ? [...eraserOp.fullDeletes] : [],
          partialDeletes: eraserOp.partialDeletes ? {...eraserOp.partialDeletes} : null,
          allPathsSnapshot: eraserOp.allPathsSnapshot ? eraserOp.allPathsSnapshot.map(path => ({...path})) : null,
          timestamp: Date.now()
        });
        
        // 操作開始時のスナップショットに復元
        if (eraserOp.allPathsSnapshot) {
          console.error('混合操作: 全体スナップショットを使用した復元');
          this.allPaths = eraserOp.allPathsSnapshot.map(path => ({...path}));
          console.error('混合操作復元完了:', { 
            restoredPathsCount: this.allPaths.length,
            fullDeleteCount: eraserOp.fullDeletes?.length || 0,
            hasPartialDelete: !!eraserOp.partialDeletes
          });
        }
        
      } else if (eraserOp.operationType === 'fullDelete') {
        // 完全削除の復元
        // redoスタックに削除情報を保存（redo用）
        this.eraserRedoStack.push({
          operationType: 'fullDelete',
          deletedPath: {...eraserOp.deletedPath},
          deleteIndex: eraserOp.deleteIndex,
          allPathsSnapshot: eraserOp.allPathsSnapshot ? eraserOp.allPathsSnapshot.map(path => ({...path})) : null,
          deletedIndices: eraserOp.deletedIndices ? [...eraserOp.deletedIndices] : null,
          timestamp: Date.now()
        });
        
        // 新方式: 全体スナップショットがある場合は正確な復元を実行
        if (eraserOp.allPathsSnapshot && eraserOp.deletedIndices) {
          console.error('全体スナップショットを使用した正確な復元を実行');
          
          // 削除前の状態に戻す
          this.allPaths = eraserOp.allPathsSnapshot.map(path => ({...path}));
          
          console.error('正確な復元完了:', { 
            restoredPathsCount: this.allPaths.length,
            restoredPath: eraserOp.deletedPath.tool,
            originalIndex: eraserOp.deleteIndex
          });
        } else {
          // 旧方式: フォールバック（後方互換性）
          console.error('フォールバック: 従来方式での復元');
          
          // 削除されたオブジェクトを適切な位置に復元
          let adjustedIndex = eraserOp.deleteIndex;
          
          // より安全なインデックス調整: 削除されたオブジェクトの数を考慮
          if (eraserOp.deletedIndices && eraserOp.deletedIndices.length > 1) {
            // 複数削除の場合、自分より後ろのオブジェクトが削除された数だけ調整
            const deletedAfterThisIndex = eraserOp.deletedIndices.filter(idx => idx > eraserOp.deleteIndex).length;
            adjustedIndex = eraserOp.deleteIndex - (eraserOp.deletedIndices.length - deletedAfterThisIndex - 1);
          }
          
          if (adjustedIndex < 0) adjustedIndex = 0;
          if (adjustedIndex > this.allPaths.length) {
            adjustedIndex = this.allPaths.length; // 配列の最後に追加
          }
          
          this.allPaths.splice(adjustedIndex, 0, eraserOp.deletedPath);
          console.error('フォールバック復元完了:', { originalIndex: eraserOp.deleteIndex, adjustedIndex, pathTool: eraserOp.deletedPath.tool });
        }
        
      } else if (eraserOp.operationType === 'partialDelete') {
        // 部分削除の復元
        // redoスタックに部分削除情報を保存（redo用）
        this.eraserRedoStack.push({
          operationType: 'partialDelete',
          originalPath: {...eraserOp.originalPath},
          modifiedPaths: eraserOp.modifiedPaths.map(path => ({...path})),
          pathIndex: eraserOp.pathIndex,
          allPathsSnapshot: eraserOp.allPathsSnapshot ? eraserOp.allPathsSnapshot.map(path => ({...path})) : null,
          timestamp: Date.now()
        });
        
        // 新方式: 全体スナップショットがある場合は正確な復元を実行
        if (eraserOp.allPathsSnapshot) {
          console.error('全体スナップショットを使用した部分削除の正確な復元');
          
          // 削除前の状態に戻す
          this.allPaths = eraserOp.allPathsSnapshot.map(path => ({...path}));
          
          console.error('部分削除の正確な復元完了:', { 
            restoredPathsCount: this.allPaths.length,
            restoredPath: eraserOp.originalPath.tool,
            pathIndex: eraserOp.pathIndex
          });
        } else {
          // 旧方式: フォールバック（後方互換性）
          console.error('フォールバック: 従来方式での部分削除復元');
          
          // 元のパスに復元（分割されたパスを元の一つのパスに戻す）
          if (eraserOp.pathIndex < this.allPaths.length) {
            // 現在分割されているパス群を削除
            const currentPath = this.allPaths[eraserOp.pathIndex];
            this.allPaths.splice(eraserOp.pathIndex, 1);
            
            // 元のパスを挿入
            this.allPaths.splice(eraserOp.pathIndex, 0, {...eraserOp.originalPath});
            console.error('フォールバック部分削除復元:', { pathIndex: eraserOp.pathIndex, pathTool: eraserOp.originalPath.tool, pathLength: eraserOp.originalPath.path?.length });
          } else {
            console.error('部分削除パス復元エラー: インデックスが範囲外', { pathIndex: eraserOp.pathIndex, allPathsLength: this.allPaths.length });
          }
        }
      }
      
      // 他のredoスタックをクリア（操作の整合性のため）
      this.redoStack = [];
      this.segmentRedoStack = [];
      
      // 次のundo操作のためにlastOperationTypeを更新
      this.lastOperationType = this.eraserHistory.length > 0 ? 'eraser' :
                              this.segmentHistory.length > 0 ? 'segment' :
                              this.allPaths.length > 0 ? 'path' : null;
      undone = true;
      
    // 1. 最後の操作タイプがセグメント変更の場合
    } else if (this.lastOperationType === 'segment' && this.segmentHistory.length > 0) {
      console.log('セグメント変更をundo（1つずつ復元）');
      
      const segmentChange = this.segmentHistory.pop();
      
      // 現在の状態をredoスタックに保存
      const currentSegmentState = {
        pathIndex: segmentChange.pathIndex,
        originalSegments: segmentChange.newSegments ? [...segmentChange.newSegments] : null,
        newSegments: segmentChange.originalSegments ? [...segmentChange.originalSegments] : null,
        timestamp: Date.now()
      };
      this.segmentRedoStack.push(currentSegmentState);
      
      // セグメント状態を復元
      if (this.restoreLineSegmentState(segmentChange)) {
        undone = true;
        
        // セグメント履歴が残っている場合は引き続きsegment操作として維持
        // すべてのセグメント履歴が復元された場合のみパス削除順序に移行
        if (this.segmentHistory.length > 0) {
          this.lastOperationType = 'segment';
          console.log('セグメント変更のundo完了 - 残りセグメント履歴:', this.segmentHistory.length);
        } else {
          this.lastOperationType = this.allPaths.length > 0 ? 'path' : null;
          console.log('全セグメント履歴復元完了 - 次回は通常のパス削除順序');
        }
      }
      
    } else if (!undone && this.allPaths.length > 0) {
      console.log('パスをundo（メイン処理またはフォールバック）');
      // 通常のパスのundo
      const lastPath = this.allPaths.pop();
      this.redoStack.push(lastPath);
      
      // 次のundo操作のためにlastOperationTypeを更新
      this.lastOperationType = this.allPaths.length > 0 ? 'path' : null;
      undone = true;
      
    } else {
      console.log('undo可能な操作がありません');
    }
    
    if (undone) {
      this.updateUndoRedoButtons();
      this.redrawCanvas();
    } else {
      console.log('何もundoしませんでした');
    }
  }

  redo() {
    console.log('Redo実行前の状態:', {
      redoStackLength: this.redoStack.length,
      segmentRedoStackLength: this.segmentRedoStack.length,
      eraserRedoStackLength: this.eraserRedoStack.length,
      lastOperationType: this.lastOperationType
    });
    
    // redo履歴に基づいて適切なredoを実行
    // 重要: lastOperationTypeに基づいて優先順位を決める
    let redone = false;
    
    // 1. 最後の操作タイプがeraserの場合のみ、消しゴム操作のredoを優先
    if (this.lastOperationType === 'eraser' && this.eraserRedoStack.length > 0) {
      console.log('消しゴム操作をredo（最後の操作が消しゴムの場合）');
      const redoOperation = this.eraserRedoStack.pop();
      
      if (redoOperation.operationType === 'fullDelete') {
        // 完全削除の再実行（一つずつ）
        console.error('消しゴム操作: 一つのオブジェクトを再削除');
        
        // 削除操作を再実行する前に、履歴に保存
        this.eraserHistory.push({
          type: 'eraserOperation',
          operationType: 'fullDelete',
          deletedPath: {...redoOperation.deletedPath},
          deleteIndex: redoOperation.deleteIndex,
          allPathsSnapshot: redoOperation.allPathsSnapshot ? redoOperation.allPathsSnapshot.map(path => ({...path})) : null,
          deletedIndices: redoOperation.deletedIndices ? [...redoOperation.deletedIndices] : null,
          timestamp: Date.now()
        });
        
        // 一つずつ削除：該当のオブジェクトを検索して削除
        const pathToDelete = redoOperation.deletedPath;
        let deletedCount = 0;
        
        for (let i = this.allPaths.length - 1; i >= 0; i--) {
          const currentPath = this.allPaths[i];
          // パスの内容を比較して同じオブジェクトを特定
          if (this.pathsAreEqual(currentPath, pathToDelete)) {
            this.allPaths.splice(i, 1);
            deletedCount++;
            console.error('一つずつ再削除完了:', { 
              deletedIndex: i, 
              originalIndex: redoOperation.deleteIndex, 
              pathTool: pathToDelete.tool 
            });
            break; // 一つだけ削除
          }
        }
        
        if (deletedCount === 0) {
          console.error('再削除対象が見つからないため、消しゴムredoをスキップ:', pathToDelete.tool);
          // 次の利用可能なredo操作を試行
          redone = this.tryNextRedo();
        } else {
          redone = true;
        }
        
      } else if (redoOperation.operationType === 'partialDelete') {
        // 部分削除の再実行（一つずつ）
        console.error('消しゴム操作: 一つの部分削除を再適用');
        
        // 削除操作を再実行する前に、履歴に保存
        this.eraserHistory.push({
          type: 'eraserOperation',
          operationType: 'partialDelete',
          originalPath: {...redoOperation.originalPath},
          modifiedPaths: redoOperation.modifiedPaths.map(path => ({...path})),
          pathIndex: redoOperation.pathIndex,
          allPathsSnapshot: redoOperation.allPathsSnapshot ? redoOperation.allPathsSnapshot.map(path => ({...path})) : null,
          timestamp: Date.now()
        });
        
        // 一つずつ部分削除：元のパスを見つけて分割されたパス群に置き換える
        const originalPath = redoOperation.originalPath;
        let modifiedCount = 0;
        
        for (let i = 0; i < this.allPaths.length; i++) {
          const currentPath = this.allPaths[i];
          if (this.pathsAreEqual(currentPath, originalPath)) {
            // 元のパスを削除して分割されたパス群に置き換える
            this.allPaths.splice(i, 1, ...redoOperation.modifiedPaths);
            modifiedCount++;
            console.error('一つずつ部分削除再適用完了:', { 
              modifiedIndex: i, 
              originalTool: originalPath.tool, 
              newPathsCount: redoOperation.modifiedPaths.length 
            });
            break; // 一つだけ処理
          }
        }
        
        if (modifiedCount === 0) {
          console.error('部分削除再適用対象が見つからないため、消しゴムredoをスキップ:', originalPath.tool);
          // 次の利用可能なredo操作を試行
          redone = this.tryNextRedo();
        } else {
          redone = true;
        }
      }
      
      if (redone) {
        console.log('消しゴム操作のredo完了（一つずつ処理）');
      }
      
    } else {
      // 2. 通常の優先順位でredo実行
      redone = this.tryNextRedo();
    }
    
    if (redone) {
      this.updateUndoRedoButtons();
      this.redrawCanvas();
    } else {
      console.log('redo可能な操作がありません');
    }
  }

  // 次の利用可能なredo操作を試行するヘルパーメソッド
  tryNextRedo() {
    // セグメント変更のredo
    if (this.segmentRedoStack.length > 0) {
      console.log('セグメント変更をredo');
      const segmentChange = this.segmentRedoStack.pop();
      
      // 消しゴム操作の識別子チェック - 次の操作を試行
      if (segmentChange.pathIndex === -1) {
        console.log('消しゴム操作データをスキップして次の操作を試行');
        return this.tryNextRedo();
      }
      
      // 現在の状態を履歴に戻す
      const currentSegmentState = {
        pathIndex: segmentChange.pathIndex,
        originalSegments: segmentChange.newSegments ? [...segmentChange.newSegments] : null,
        newSegments: segmentChange.originalSegments ? [...segmentChange.originalSegments] : null,
        timestamp: Date.now()
      };
      this.segmentHistory.push(currentSegmentState);
      
      // セグメント状態を復元
      if (this.restoreLineSegmentState(segmentChange)) {
        this.lastOperationType = 'segment';
        console.log('セグメント変更のredo完了');
        return true;
      }
      
    } else if (this.redoStack.length > 0) {
      // 通常パスのredo（一つずつ復元）
      console.log('通常パスをredo（一つずつ復元）');
      const pathToRestore = this.redoStack.pop();
      this.allPaths.push(pathToRestore);
      this.lastOperationType = 'path';
      return true;
      
    } else if (this.eraserRedoStack.length > 0) {
      // 最後に残った消しゴム操作のredo（fallback）
      console.log('残存する消しゴム操作をredo（fallback）');
      const redoOperation = this.eraserRedoStack.pop();
      console.warn('消しゴムredo（fallback）をスキップ - 対象が存在しない可能性:', redoOperation.operationType);
      // 再帰的に次のredo操作を試行
      return this.tryNextRedo();
    }
    
    return false;
  }

  // パスが等しいかどうかを判定するヘルパーメソッド
  pathsAreEqual(path1, path2) {
    if (!path1 || !path2) return false;
    
    // 基本プロパティの比較
    if (path1.tool !== path2.tool || 
        path1.strokeColor !== path2.strokeColor || 
        path1.strokeWidth !== path2.strokeWidth) {
      return false;
    }
    
    // ツール固有の比較
    switch (path1.tool) {
      case 'pen':
        // フリーハンドの場合はパス配列を比較
        return JSON.stringify(path1.path) === JSON.stringify(path2.path);
      
      case 'line':
      case 'rectangle':
      case 'circle':
      case 'door':
      case 'stairs':
        // 図形の場合は開始点と終了点を比較
        return (path1.startPoint && path2.startPoint &&
                path1.endPoint && path2.endPoint &&
                path1.startPoint.x === path2.startPoint.x &&
                path1.startPoint.y === path2.startPoint.y &&
                path1.endPoint.x === path2.endPoint.x &&
                path1.endPoint.y === path2.endPoint.y);
      
      case 'textbox':
        // テキストボックスの場合は位置とテキスト内容を比較
        return (path1.x === path2.x &&
                path1.y === path2.y &&
                path1.width === path2.width &&
                path1.height === path2.height &&
                path1.text === path2.text);
      
      default:
        // その他の場合は全体を比較
        return JSON.stringify(path1) === JSON.stringify(path2);
    }
  }

  // 履歴スタックに項目を追加（上限管理付き）
  addToHistoryStack(stack, item) {
    stack.push(item);
    // 上限を超えた場合、最も古い項目を削除
    if (stack.length > PERFORMANCE_CONFIG.MAX_HISTORY_SIZE) {
      stack.shift();
      console.log(`履歴スタックが上限(${PERFORMANCE_CONFIG.MAX_HISTORY_SIZE})を超えたため、最古の項目を削除しました`);
    }
  }

  // redoスタックをクリアする際に呼び出す（メモリ解放も考慮）
  clearRedoStack() {
    this.redoStack = [];
    this.segmentRedoStack = [];
    this.eraserRedoStack = [];
  }

  replaceLastStroke(shapeData) {
    if (this.allPaths.length > 0) {
      this.allPaths[this.allPaths.length - 1] = shapeData;
      this.redrawCanvas();
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    // 画像データの保存は削除（高DPI環境では正常に動作しない）
    
    this.setupHighDPI();
    
    // 描画内容を復元
    this.redrawCanvas();
  }

  // パスの最適化（類似パスの統合）
  optimizePaths() {
    if (this.allPaths.length < 2) return;
    
    const beforeCount = this.allPaths.length;
    const optimizedPaths = [];
    let currentBatch = null;
    
    this.allPaths.forEach(pathData => {
      if (pathData.tool === 'pen' && currentBatch && 
          currentBatch.strokeColor === pathData.strokeColor &&
          currentBatch.strokeWidth === pathData.strokeWidth) {
        // 同じスタイルのペンパスを統合
        currentBatch.path.push(...pathData.path);
      } else {
        if (currentBatch) {
          optimizedPaths.push(currentBatch);
        }
        currentBatch = { ...pathData };
      }
    });
    
    if (currentBatch) {
      optimizedPaths.push(currentBatch);
    }
    
    this.allPaths = optimizedPaths;
    const afterCount = this.allPaths.length;
    const saved = beforeCount - afterCount;
    
    if (saved > 0) {
      console.log(`🚀 自動最適化実行: ${beforeCount} → ${afterCount} パス (${saved}個統合)`);
    }
  }

  // イベントエミッター機能
  on(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);
  }

  emit(eventName, data) {
    if (this.eventListeners[eventName]) {
      this.eventListeners[eventName].forEach(callback => callback(data));
    }
  }

  // 直線を半マス単位でセグメント分割（角度考慮版）
  getLineSegmentsHalfGrid(pathData) {
    const segments = [];
    const quarterGrid = this.gridSize / 4; // 40ピクセル = 0.25マス
    const start = pathData.startPoint;
    const end = pathData.endPoint;
    
    // 直線の方向ベクトル
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return segments;
    
    // 線の角度を計算
    const angle = Math.abs(Math.atan2(dy, dx));
    const angleInDegrees = (angle * 180) / Math.PI;
    
    // 角度に応じたセグメント長を計算
    let effectiveSegmentLength = quarterGrid;
    
    // 45度付近（35-55度）の場合は√2倍にして、グリッド上の0.25マス距離に合わせる
    if (angleInDegrees >= 35 && angleInDegrees <= 55) {
      effectiveSegmentLength = quarterGrid * Math.sqrt(2);
    }
    
    // 単位ベクトル
    const unitX = dx / length;
    const unitY = dy / length;
    
    // セグメント数を計算
    const minSegmentCount = Math.max(1, Math.ceil(length / effectiveSegmentLength));
    
    // 実際のセグメント長（均等分割で精度向上）
    const exactSegmentLength = length / minSegmentCount;
    
    // 等間隔でセグメント分割
    for (let i = 0; i < minSegmentCount; i++) {
      const startDistance = i * exactSegmentLength;
      const endDistance = Math.min((i + 1) * exactSegmentLength, length);
      
      const segStart = {
        x: start.x + unitX * startDistance,
        y: start.y + unitY * startDistance
      };
      const segEnd = {
        x: start.x + unitX * endDistance,
        y: start.y + unitY * endDistance
      };
      
      segments.push({ 
        start: segStart, 
        end: segEnd,
        index: i,
        length: endDistance - startDistance,
        distance: startDistance
      });
    }
    
    return segments;
  }

  // 四角形を半マス単位でセグメント分割（辺ごと）
  getRectangleSegmentsHalfGrid(pathData) {
    const segments = [];
    const quarterGrid = this.gridSize / 4;
    const start = pathData.startPoint;
    const end = pathData.endPoint;
    
    // 四角形の4つの辺
    const topLeft = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) };
    const topRight = { x: Math.max(start.x, end.x), y: Math.min(start.y, end.y) };
    const bottomLeft = { x: Math.min(start.x, end.x), y: Math.max(start.y, end.y) };
    const bottomRight = { x: Math.max(start.x, end.x), y: Math.max(start.y, end.y) };
    
    const edges = [
      { start: topLeft, end: topRight, side: 'top' },
      { start: topRight, end: bottomRight, side: 'right' },
      { start: bottomRight, end: bottomLeft, side: 'bottom' },
      { start: bottomLeft, end: topLeft, side: 'left' }
    ];
    
    // 各辺を0.25マス単位で分割
    edges.forEach(edge => {
      const dx = edge.end.x - edge.start.x;
      const dy = edge.end.y - edge.start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      if (length === 0) return;
      
      const unitX = dx / length;
      const unitY = dy / length;
      
      for (let i = 0; i < length; i += quarterGrid) {
        const segStart = {
          x: edge.start.x + unitX * i,
          y: edge.start.y + unitY * i
        };
        const segEnd = {
          x: edge.start.x + unitX * Math.min(i + quarterGrid, length),
          y: edge.start.y + unitY * Math.min(i + quarterGrid, length)
        };
        segments.push({ 
          start: segStart, 
          end: segEnd, 
          side: edge.side,
          originalEdge: edge
        });
      }
    });
    
    return segments;
  }

  // 半マス単位で直線セグメントを削除（改良版：確実な結合）
  removeLineSegmentsHalfGrid(pathData, segmentsToRemove) {
    const allSegments = this.getLineSegmentsHalfGrid(pathData);
    const removeSet = new Set(segmentsToRemove);
    
    // 連続する残存セグメントのグループを特定
    const groups = [];
    let currentGroup = [];
    
    for (let i = 0; i < allSegments.length; i++) {
      if (!removeSet.has(i)) {
        // このセグメントは残す
        currentGroup.push(allSegments[i]);
      } else {
        // このセグメントは削除 - 現在のグループを完了
        if (currentGroup.length > 0) {
          groups.push([...currentGroup]);
          currentGroup = [];
        }
      }
    }
    
    // 最後のグループを追加
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    // 各グループから線分を作成
    const newLines = [];
    for (const group of groups) {
      if (group.length === 0) continue;
      
      // グループの最初と最後のセグメントから線分を作成
      const firstSegment = group[0];
      const lastSegment = group[group.length - 1];
      
      const newLine = {
        tool: 'line',
        startPoint: { ...firstSegment.start },
        endPoint: { ...lastSegment.end },
        strokeColor: pathData.strokeColor,
        strokeWidth: pathData.strokeWidth
      };
      
      // 線分の長さをチェック（極小の線分は除外）
      const lineLength = Math.sqrt(
        Math.pow(newLine.endPoint.x - newLine.startPoint.x, 2) +
        Math.pow(newLine.endPoint.y - newLine.startPoint.y, 2)
      );
      
      if (lineLength > 1) { // 1ピクセル以上の線分のみ保持
        newLines.push(newLine);
      }
    }
    
    return newLines;
  }

  // 半マス単位で四角形セグメントを削除
  removeRectangleSegmentsHalfGrid(pathData, segmentsToRemove) {
    const allSegments = this.getRectangleSegmentsHalfGrid(pathData);
    const remainingSegments = allSegments.filter((_, index) => !segmentsToRemove.includes(index));
    
    // 辺ごとにグループ化
    const segmentsBySide = {
      top: [],
      right: [],
      bottom: [],
      left: []
    };
    
    remainingSegments.forEach(segment => {
      segmentsBySide[segment.side].push(segment);
    });
    
    const newLines = [];
    
    // 各辺で連続するセグメントを結合
    Object.keys(segmentsBySide).forEach(side => {
      const segments = segmentsBySide[side];
      if (segments.length === 0) return;
      
      let currentLine = null;
      
      for (const segment of segments) {
        if (!currentLine) {
          currentLine = {
            tool: 'line',
            startPoint: { ...segment.start },
            endPoint: { ...segment.end },
            strokeColor: pathData.strokeColor,
            strokeWidth: pathData.strokeWidth
          };
        } else {
          const distance = Math.sqrt(
            Math.pow(currentLine.endPoint.x - segment.start.x, 2) +
            Math.pow(currentLine.endPoint.y - segment.start.y, 2)
          );
          
          if (distance < this.gridSize / 4) {
            currentLine.endPoint = { ...segment.end };
          } else {
            newLines.push(currentLine);
            currentLine = {
              tool: 'line',
              startPoint: { ...segment.start },
              endPoint: { ...segment.end },
              strokeColor: pathData.strokeColor,
              strokeWidth: pathData.strokeWidth
            };
          }
        }
      }
      
      if (currentLine) {
        newLines.push(currentLine);
      }
    });
    
    return newLines;
  }

  // 扉関連のメソッド
  setDoorType(doorType) {
    this.doorType = doorType;
    console.log(`扉の種類を変更: ${doorType}`);
  }

  setDoorWidth(width) {
    // 扉の幅を0.25マス（5px）単位に調整
    const quarterGrid = this.gridSize / 4; // 0.25マス = 5px
    this.doorWidth = Math.round(width / quarterGrid) * quarterGrid;
    console.log(`扉の幅を変更: ${this.doorWidth}px (0.25マス単位調整済み)`);
  }

  setOpeningSize(size) {
    this.openingSize = size;
    console.log(`開口部サイズを変更: ${size}`);
  }

  getDoorTypes() {
    return [
      { value: 'smallbox', label: '開口部' },
      { value: 'single', label: '片開き戸' },
      { value: 'double', label: '両開き戸' }
    ];
  }

  // 線スタイル設定メソッド
  setLineStyle(style) {
    this.lineStyle = style;
    console.log(`線スタイルを変更: ${style}`);
  }

  // 後方互換性のため残存
  setLineDashed(isDashed) {
    this.lineStyle = isDashed ? 'dashed' : 'solid';
    console.log(`線スタイルを変更: ${this.lineStyle}`);
  }

  // 後方互換性のため残存
  setLineArrow(hasArrow) {
    this.lineStyle = hasArrow ? 'arrow' : 'solid';
    console.log(`線スタイルを変更: ${this.lineStyle}`);
  }

  // プロパティアクセス用（後方互換性）
  get isDashed() {
    return this.lineStyle === 'dashed';
  }

  get hasArrow() {
    return this.lineStyle === 'arrow';
  }

  // 階段設定メソッド
  setStairSize(size) {
    // サイズに応じて横線長さを設定（1マスを基本、0.5マス単位で調整）
    const previousWidth = this.stairWidth;
    switch (size) {
      case 'small':
        this.stairWidth = this.gridSize * 0.5; // 0.5マス（小）= 80px
        break;
      case 'large':
        this.stairWidth = this.gridSize * 1.5; // 1.5マス（大）= 240px
        break;
      default: // medium
        this.stairWidth = this.gridSize * 1; // 1マス（基本）= 160px
    }
    console.log(`階段サイズ変更詳細:`, {
      size: size,
      gridSize: this.gridSize,
      previousWidth: previousWidth,
      newWidth: this.stairWidth,
      calculation: `${this.gridSize} * ${size === 'small' ? 0.5 : size === 'large' ? 1.5 : 1} = ${this.stairWidth}`,
      gridUnits: `${this.stairWidth/this.gridSize}マス`
    });
  }

  setStairWidth(width) {
    // 階段の横線長さを0.25マス単位に調整（後方互換性のため残存）
    const quarterGrid = this.gridSize / 4;
    this.stairWidth = Math.round(width / quarterGrid) * quarterGrid;
    console.log(`階段の横線長さを変更: ${this.stairWidth}px (0.25マス単位調整済み)`);
  }

  // 階段タイプを設定
  setStairType(type) {
    if (['straight', 'l-shape', 'spiral'].includes(type)) {
      this.stairType = type;
      console.log(`階段タイプを変更: ${type}`);
    }
  }

  setFillSize(size) {
    if (['quarter', 'half', 'one'].includes(size)) {
      this.fillSize = size;
      console.log(`塗りつぶしサイズを変更: ${size}`);
    }
  }

  setFillPattern(pattern) {
    if (['solid', 'diagonal'].includes(pattern)) {
      this.fillPattern = pattern;
      console.log(`塗りつぶしパターンを変更: ${pattern}`);
    }
  }

  getStairWidth() {
    return this.stairWidth;
  }

  // 矢印を描画するヘルパーメソッド
  drawArrowHead(ctx, fromX, fromY, toX, toY, arrowSize = 10) {
    // 矢印の方向を計算
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    
    // 矢印のサイズを線の太さに応じて調整
    const adjustedSize = Math.max(arrowSize, ctx.lineWidth * 3);
    
    // 矢印の頂点を計算
    const arrowAngle = Math.PI / 6; // 30度
    const x1 = toX - adjustedSize * Math.cos(angle - arrowAngle);
    const y1 = toY - adjustedSize * Math.sin(angle - arrowAngle);
    const x2 = toX - adjustedSize * Math.cos(angle + arrowAngle);
    const y2 = toY - adjustedSize * Math.sin(angle + arrowAngle);
    
    // 矢印を描画
    ctx.save();
    ctx.setLineDash([]); // 矢印は実線で描画
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(x1, y1);
    ctx.moveTo(toX, toY);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  // getArrowHeadRegion / isPointInArrowHead / isSegmentInArrowHead / distanceToLineSegment は
  // canvas/geometry.js に抽出済み

  // 描画範囲を取得する関数
  getDrawingBounds() {
    if (this.allPaths.length === 0) {
      return null;
    }
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    // 全パスの範囲を計算
    this.allPaths.forEach(pathData => {
      if (pathData.tool === 'pen') {
        pathData.path.forEach(point => {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
        });
      } else if (pathData.tool === 'textbox') {
        minX = Math.min(minX, pathData.x);
        minY = Math.min(minY, pathData.y);
        maxX = Math.max(maxX, pathData.x + pathData.width);
        maxY = Math.max(maxY, pathData.y + pathData.height);
      } else if (pathData.startPoint && pathData.endPoint) {
        minX = Math.min(minX, pathData.startPoint.x, pathData.endPoint.x);
        minY = Math.min(minY, pathData.startPoint.y, pathData.endPoint.y);
        maxX = Math.max(maxX, pathData.startPoint.x, pathData.endPoint.x);
        maxY = Math.max(maxY, pathData.startPoint.y, pathData.endPoint.y);
      }
    });
    
    return {
      minX: minX,
      minY: minY,
      maxX: maxX,
      maxY: maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }


  // PDF/画像/Excel用の OnContext 系メソッド16個は canvas/pdfRenderer.js に抽出済み
  // exportToImage / renderDrawingToBlob / drawImageHeader / drawImageLogo /
  // shareImageViaAPI / downloadImage / showImageForSaving / triggerMobileDownload /
  // exportToPDF / addPDFHeader / addPDFFooter / addPDFLogo は canvas/export.js に抽出済み
  // （いずれも Object.assign で prototype に注入される）

  // プロジェクトデータの取得（保存用）
  getProjectData() {
    const projectData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      settings: {
        gridSize: this.gridSize,
        scale: this.scale,
        offsetX: this.offsetX,
        offsetY: this.offsetY,
        snapToGrid: this.snapToGrid
      },
      paths: this.allPaths.map(path => {
        // パスデータのクリーンアップ（不要なプロパティを除外）
        const cleanPath = { ...path };
        
        // 選択状態やプレビュー関連のプロパティを除外
        delete cleanPath.isSelected;
        delete cleanPath.isPreview;
        delete cleanPath.tempData;
        
        return cleanPath;
      }),
      statistics: {
        totalPaths: this.allPaths.length,
        pathsByTool: this.getPathStatistics()
      }
    };

    return projectData;
  }

  // パス統計の取得
  getPathStatistics() {
    const stats = {};
    this.allPaths.forEach(path => {
      const tool = path.tool || 'unknown';
      stats[tool] = (stats[tool] || 0) + 1;
    });
    return stats;
  }

  // プロジェクトデータからの読み込み
  loadFromData(projectData) {
    if (!projectData) return;

    try {
      // 既存のパスをクリア
      this.allPaths = [];
      this.history = [];
      this.redoStack = [];
      this.segmentHistory = [];
      this.segmentRedoStack = [];

      // パスデータの復元
      if (projectData.paths && Array.isArray(projectData.paths)) {
        this.allPaths = [...projectData.paths];
      }

      // 設定の復元
      if (projectData.settings) {
        if (projectData.settings.gridSize) {
          this.gridSize = projectData.settings.gridSize;
        }
        if (projectData.settings.scale !== undefined) {
          this.scale = projectData.settings.scale;
        }
        if (projectData.settings.offsetX !== undefined || projectData.settings.offsetY !== undefined) {
          this.translateX = projectData.settings.offsetX || 0;
          this.translateY = projectData.settings.offsetY || 0;
        }
        if (projectData.settings.snapToGrid !== undefined) {
          this.snapToGrid = projectData.settings.snapToGrid;
        }
      }

      // 注: 再描画は呼び出し元（main.js の restoreProjectData）で行う
      // ここで呼ぶとスロットリングにより後続の再描画がスキップされる可能性がある
      
      console.log(`プロジェクトデータを読み込みました: ${this.allPaths.length}個のパス`);

    } catch (error) {
      console.error('プロジェクトデータの読み込みに失敗:', error);
      throw error;
    }
  }

  // 選択状態のクリア
  clearSelection() {
    try {
      // 全てのパスの選択状態をクリア
      this.allPaths.forEach(path => {
        if (path.isSelected) {
          path.isSelected = false;
        }
      });

      // テキストボックスの選択状態もクリア
      this.clearTextBoxSelection();

      // 選択関連の変数をリセット
      this.selectedPaths = [];
      this.isDragging = false;
      this.isResizing = false;
      
      console.log('選択状態をクリアしました');
      
    } catch (error) {
      console.error('選択状態のクリア中にエラー:', error);
    }
  }

  // ダークモード対応のデフォルト色を取得
  getDefaultStrokeColor() {
    // ダークモードかどうかを判定
    const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
    return isDarkMode ? '#ffffff' : '#000000';
  }

  // ダークモード対応の図形色を取得（扉、階段用）
  getShapeColor() {
    // 建具ツールで図形（○□×）の場合は専用色を使用
    if (this.tool === 'door' && ['circle', 'square', 'cross'].includes(this.doorType)) {
      return this.doorSymbolColor || this.getDefaultStrokeColor();
    }
    return this.getDefaultStrokeColor();
  }

  // ダークモード対応の背景色を取得（扉枠用）
  getBackgroundColor() {
    const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
    return isDarkMode ? '#000000' : '#ffffff';
  }

  // ダークモード切り替え時の色更新
  updateStrokeColorForTheme() {
    console.log('updateStrokeColorForTheme が呼び出されました');
    console.log('現在のallPaths数:', this.allPaths.length);
    
    // 現在の色がデフォルト色（黒または白）の場合のみ更新
    if (this.strokeColor === '#000000' || this.strokeColor === '#ffffff') {
      this.strokeColor = this.getDefaultStrokeColor();
      console.log('ダークモード切り替えに応じて線色を更新:', this.strokeColor);
      
      // カラーピッカーの値も更新
      const colorPicker = document.getElementById('stroke-color');
      if (colorPicker) {
        colorPicker.value = this.strokeColor;
      }
    }

    // 既存の図形の色を更新（黒→白、白→黒）
    const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
    const oldColor = isDarkMode ? '#000000' : '#ffffff';
    const newColor = isDarkMode ? '#ffffff' : '#000000';

    console.log(`ダークモード: ${isDarkMode}, ${oldColor} → ${newColor} に変更予定`);

    let hasUpdated = false;
    this.allPaths.forEach((pathData, index) => {
      console.log(`パス${index}: tool=${pathData.tool}, 現在色=${pathData.strokeColor}`);
      if (pathData.strokeColor === oldColor) {
        pathData.strokeColor = newColor;
        hasUpdated = true;
        console.log(`パス${index}の色を ${oldColor} → ${newColor} に更新しました`);
      }
    });

    // 既存の図形の色が更新された場合、キャンバスを再描画
    if (hasUpdated) {
      console.log(`ダークモード切り替えで既存図形の色を ${oldColor} → ${newColor} に更新`);
      this.redrawCanvas();
    } else {
      console.log('更新対象の図形がありませんでした');
    }
  }

  // calculatePolylineLength は canvas/geometry.js に抽出済み

  // Undo/Redoボタンの状態を更新
  updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    
    // Undo可能かチェック（いずれかの履歴が存在するか）
    const canUndo = this.allPaths.length > 0 || 
                   this.segmentHistory.length > 0 || 
                   this.eraserHistory.length > 0;
    
    // Redo可能かチェック（いずれかのredoスタックが存在するか）
    const canRedo = this.redoStack.length > 0 || 
                   this.segmentRedoStack.length > 0 || 
                   this.eraserRedoStack.length > 0;
    
    if (undoBtn) {
      undoBtn.disabled = !canUndo;
      undoBtn.style.opacity = canUndo ? '1' : '0.5';
    }
    
    if (redoBtn) {
      redoBtn.disabled = !canRedo;
      redoBtn.style.opacity = canRedo ? '1' : '0.5';
    }
    
    console.log('Undo/Redoボタン状態更新:', { canUndo, canRedo });
  }

  // 履歴を完全にクリアする（ホーム戻り時用）
  clearAllHistory() {
    this.allPaths = [];
    this.redoStack = [];
    this.segmentHistory = [];
    this.segmentRedoStack = [];
    this.eraserHistory = [];
    this.eraserRedoStack = [];
    this.lastOperationType = null;
    if (this.operationHistory) {
      this.operationHistory = [];
    }
    
    // ビューポート・変換行列の初期化
    this.scale = 1;
    
    // 初期位置を中心に設定（setupHighDPIと同じ方法）
    this.translateX = this.canvas.width / 2;
    this.translateY = this.canvas.height / 2;
    
    // キャンバスの変換行列も初期化
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // 描画状態の初期化
    this.isDrawing = false;
    this.currentPath = [];
    this.polylinePoints = [];
    this.isPolylineActive = false;
    this.selectedTextBox = null;
    this.isResizing = false;
    this.resizeHandle = null;
    
    // プレビュー状態の初期化
    this.showShapePreview = false;
    this.showEraserPreview = false;
    this.eraserPreviewCoords = null;
    this.previewEndPoint = null;
    
    // ボタン状態も更新
    this.updateUndoRedoButtons();

    console.log('全履歴・状態クリア完了');
  }

  drawFillPath(pathData) {
    // 塗りつぶしの描画
    const pattern = pathData.fillPattern || 'solid';
    if (pathData.positions) {
      // 新形式：複数位置
      pathData.positions.forEach(pos => {
        const posPattern = pos.pattern || pattern;
        if (posPattern === 'diagonal') {
          // 現在の変換行列を取得
          const transform = this.ctx.getTransform();
          
          // ワールド座標をスクリーン座標に変換
          const screenX = pos.x * transform.a + transform.e;
          const screenY = pos.y * transform.d + transform.f;
          const screenSize = pos.size * transform.a;
          
          // 一時的に変換をリセットして物理座標で描画
          this.ctx.save();
          this.ctx.setTransform(1, 0, 0, 1, 0, 0);
          
          this.ctx.strokeStyle = pathData.strokeColor;
          this.ctx.lineWidth = 2;
          const spacing = 16;
          
          // 背景に薄い色を塗る
          this.ctx.fillStyle = pathData.strokeColor + '20'; // 透明度12.5%
          this.ctx.fillRect(screenX, screenY, screenSize, screenSize);
          
          // クリッピング領域を設定（正方形内だけに描画）
          this.ctx.beginPath();
          this.ctx.rect(screenX, screenY, screenSize, screenSize);
          this.ctx.clip();
          
          // 斜線を描画
          this.ctx.beginPath();
          for (let offset = -screenSize; offset < screenSize * 2; offset += spacing) {
            this.ctx.moveTo(screenX + offset, screenY);
            this.ctx.lineTo(screenX + offset + screenSize, screenY + screenSize);
          }
          this.ctx.stroke();
          
          // 枠線を描画（クリッピング適用後）
          this.ctx.strokeStyle = pathData.strokeColor;
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(screenX, screenY, screenSize, screenSize);
          
          // 変換を元に戻す（1回だけrestore）
          this.ctx.restore();
        } else {
          this.ctx.fillStyle = pathData.strokeColor;
          this.ctx.fillRect(pos.x, pos.y, pos.size, pos.size);
        }
      });
    } else if (pathData.startPoint) {
      // 旧形式：単一位置（後方互換性）
      this.ctx.fillStyle = pathData.strokeColor;
      this.ctx.fillRect(pathData.startPoint.x, pathData.startPoint.y, pathData.size, pathData.size);
    }
  }

  updateCursorForPosition(event) {
    const coords = this.getCoordinates(event);
    
    // まず、選択中のテキストボックスのハンドルをチェック（最優先）
    if (this.selectedTextBox) {
      const handle = this.getResizeHandle(coords, this.selectedTextBox);
      if (handle) {
        // ハンドルの種類に応じてカーソルを変更
        switch (handle) {
          case 'nw':
          case 'se':
            this.canvas.style.cursor = 'nw-resize';
            break;
          case 'ne':
          case 'sw':
            this.canvas.style.cursor = 'ne-resize';
            break;
          case 'n':
          case 's':
            this.canvas.style.cursor = 'ns-resize';
            break;
          case 'w':
          case 'e':
            this.canvas.style.cursor = 'ew-resize';
            break;
          default:
            this.canvas.style.cursor = 'default';
        }
        return;
      }
      
      // テキストボックス内かチェック
      if (this.isPointInTextBox(coords, this.selectedTextBox)) {
        // 移動エリアかリサイズエリアかで分ける
        if (this.isPointInMoveArea(coords, this.selectedTextBox)) {
          this.canvas.style.cursor = 'move';
        } else {
          this.canvas.style.cursor = 'grab';
        }
        return;
      }
    }
    
    // 他のテキストボックスのハンドルをチェック
    for (let i = this.allPaths.length - 1; i >= 0; i--) {
      const pathData = this.allPaths[i];
      if (pathData.tool === 'textbox') {
        const handle = this.getResizeHandle(coords, pathData);
        if (handle) {
          switch (handle) {
            case 'nw':
            case 'se':
              this.canvas.style.cursor = 'nw-resize';
              break;
            case 'ne':
            case 'sw':
              this.canvas.style.cursor = 'ne-resize';
              break;
            case 'n':
            case 's':
              this.canvas.style.cursor = 'ns-resize';
              break;
            case 'w':
            case 'e':
              this.canvas.style.cursor = 'ew-resize';
              break;
            default:
              this.canvas.style.cursor = 'default';
          }
          return;
        }
        
        // テキストボックス内でもカーソルを変更
        if (this.isPointInTextBox(coords, pathData)) {
          if (this.isPointInMoveArea(coords, pathData)) {
            this.canvas.style.cursor = 'move';
          } else {
            this.canvas.style.cursor = 'pointer';
          }
          return;
        }
      }
    }
    
    // デフォルトカーソル
    this.updateCursor();
  }

  removeCurrentTextBox() {
    console.log('=== removeCurrentTextBox 開始 ===');
    console.log('削除前の状態:', {
      textInput: this.textInput,
      allPathsCount: this.allPaths.length,
      selectedTextBox: this.selectedTextBox
    });
    
    // テキスト入力フィールドを削除
    this.removeTextInput();
    
    // 編集中（選択状態）で空のテキストボックスのみを allPaths から削除
    const editingIndex = this.allPaths.findIndex(path => 
      path.tool === 'textbox' && path.isSelected && (!path.text || path.text.trim() === '')
    );
    
    console.log('削除対象の空テキストボックスのインデックス:', editingIndex);
    
    if (editingIndex !== -1) {
      const removedPath = this.allPaths.splice(editingIndex, 1)[0];
      console.log('削除された空のテキストボックス:', removedPath);
      console.log('空のテキストボックスを削除しました');
      
      // アンドゥ/リドゥボタンの状態を更新
      this.updateUndoRedoButtons();
    } else {
      console.log('削除対象の空テキストボックスが見つかりませんでした');
      
      // テキストが入力済みの選択状態テキストボックスがある場合は削除せず選択解除のみ
      const selectedTextBoxWithText = this.allPaths.find(path => 
        path.tool === 'textbox' && path.isSelected && path.text && path.text.trim() !== ''
      );
      
      if (selectedTextBoxWithText) {
        console.log('テキストが入力済みのテキストボックスは削除せず選択解除のみ行います:', selectedTextBoxWithText);
        selectedTextBoxWithText.isSelected = false;
      }
    }
    
    // 選択状態をクリア
    this.selectedTextBox = null;
    
    console.log('削除後の状態:', {
      allPathsCount: this.allPaths.length,
      selectedTextBox: this.selectedTextBox
    });
    
    // 画面を再描画
    this.redrawCanvas();
    console.log('=== removeCurrentTextBox 完了 ===');
  }
}

// PDF/画像/Excel 出力用のメソッド群を DrawingCanvas のプロトタイプに注入
Object.assign(DrawingCanvas.prototype, pdfRendererMethods);
Object.assign(DrawingCanvas.prototype, exportMethods);
Object.assign(DrawingCanvas.prototype, backgroundImageMethods);
Object.assign(DrawingCanvas.prototype, textBoxMethods);
