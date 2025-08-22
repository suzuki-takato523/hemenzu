// 定数定義
const PERFORMANCE_CONFIG = {
  DEBOUNCE_DELAY: 16, // 約60FPS
  REDRAW_DEBOUNCE: 8,  // 再描画のデバウンス時間
  MAX_PATH_POINTS: 1000, // パスの最大ポイント数
  OPTIMIZATION_THRESHOLD: 50 // パス最適化を実行するしきい値（より頻繁に実行）
};

const DRAWING_CONFIG = {
  GRID_SIZE: 20,
  DEFAULT_STROKE_WIDTH: 2,
  DEFAULT_STROKE_COLOR: '#000000',
  ERASER_MIN_SIZE: 5,
  ERASER_MAX_SIZE: 50
};

/**
 * 描画キャンバスクラス
 * タッチペン対応の描画機能を提供
 */
export class DrawingCanvas {
  constructor(canvasSelector) {
    this.canvas = document.querySelector(canvasSelector);
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.isDrawing = false;
    this.currentPath = [];
    this.allPaths = [];
    this.redoStack = [];
    // 開口部のundo/redo管理
    this.openingsHistory = []; // 開口部の履歴
    this.openingsRedoStack = []; // 開口部のredo履歴
    // 統合操作履歴（最後の操作タイプを追跡）
    this.lastOperationType = null; // 'path' or 'opening'
    this.strokeWidth = 2;
    this.penWidth = 2; // ペン専用の太さ
    this.eraserSize = 30; // 消しゴムサイズ（独立して設定可能）- デフォルトを30に
    this.strokeColor = '#000000';
    this.currentTool = 'pen';
    this.lineStyle = 'solid'; // 線スタイル: 'solid', 'dashed', 'arrow'
    this.doorType = 'opening'; // 扉の種類（初期値：開口部）
    this.doorWidth = 75; // 扉の幅（0.25マス単位: 3.75マス = 75px）
    
    // グリッドサイズを先に設定
    this.gridSize = 160; // グリッドサイズをさらに大きくして見やすく
    
    // 階段設定（gridSizeが設定された後に実行）
    this.stairSteps = 10; // 固定段数
    this.stairWidth = this.gridSize * 1; // 階段の横線長さ（デフォルト1マス = 160px）
    console.log(`初期化: gridSize=${this.gridSize}px, 初期stairWidth=${this.stairWidth}px`);
    
    this.startPoint = null;
    this.previewEndPoint = null; // プレビュー用の終点
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
    
    // 開口部管理用のプロパティ
    this.openings = []; // 開口部の配列
    this.selectedOpening = null; // 選択中の開口部
    this.isDraggingOpening = false; // 開口部のドラッグ中フラグ
    this.openingDragOffset = { x: 0, y: 0 }; // ドラッグオフセット
    this.showOpeningPreview = false; // 開口部プレビュー表示フラグ
    this.openingPreviewCoords = null; // プレビュー座標
    this.touchPreviewTimer = null; // タッチプレビュー用タイマー
    this.isShowingTouchPreview = false; // タッチプレビュー状態
    this.isMultiTouch = false; // マルチタッチ検出フラグ
    this.multiTouchCooldown = false; // マルチタッチ終了後のクールダウン
    this.lastMultiTouchTime = 0; // 最後のマルチタッチ時刻（シンプル化）
    
    // ズーム関連
    this.scale = 1;
    this.minScale = 0.1;
    this.maxScale = 5;
    this.translateX = 0;
    this.translateY = 0;
    this.lastPinchDistance = 0;
    this.isPinching = false;
    this.pinchCenter = { x: 0, y: 0 };
    this.lastPanPoint = null; // 二本指パン用
    
    this.initCanvas();
    this.setupEventListeners();
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
    
    // 初期状態として空の開口部履歴を保存
    this.saveOpeningsState();
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
    // マウスイベント
    this.canvas.addEventListener('mousedown', (e) => {
      // テキストボックスツール時もstartDrawingを呼ぶ（編集・移動・選択のため）
      this.startDrawing(e);
    });
    this.canvas.addEventListener('mousemove', (e) => {
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
    this.canvas.addEventListener('mouseup', (e) => this.stopDrawing(e));
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
      
      // ズーム倍率を計算
      const zoomIntensity = 0.1;
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
    
    // キーボードイベント（Shiftキー用）
    this.isShiftPressed = false;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') {
        this.isShiftPressed = true;
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
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;
    
    // 高DPI対応
    const dpr = window.devicePixelRatio || 1;
    x *= dpr;
    y *= dpr;
    
    // ズーム・パン変換を適用（座標を世界座標系に変換）
    x = (x - this.translateX) / this.scale;
    y = (y - this.translateY) / this.scale;
    
    // グリッドスナップ機能（テキストツールと消しゴムツールは除外）
    if (this.snapToGrid) {
      // ペンツール、テキストツール、消しゴムツール以外はグリッドにスナップ
      if (this.currentTool !== 'pen' && 
          this.currentTool !== 'text-horizontal' && 
          this.currentTool !== 'text-vertical' &&
          this.currentTool !== 'eraser') {
        
        // 扉ツールと階段ツールの場合は0.25マス（クォーターグリッド）にスナップ
        if (this.currentTool === 'door' || this.currentTool === 'stairs') {
          const quarterGrid = this.gridSize / 4;
          x = Math.round(x / quarterGrid) * quarterGrid;
          y = Math.round(y / quarterGrid) * quarterGrid;
        }
        // 直線ツールで点線または矢印の場合は0.25マス（クォーターグリッド）にスナップ
        else if (this.currentTool === 'line' && (this.lineStyle === 'dashed' || this.lineStyle === 'arrow')) {
          const quarterGrid = this.gridSize / 4;
          x = Math.round(x / quarterGrid) * quarterGrid;
          y = Math.round(y / quarterGrid) * quarterGrid;
        }
        // 直線モード（実線のみ）と四角モードの場合は半マス（グリッドサイズの半分）にスナップ
        else if ((this.currentTool === 'line' && this.lineStyle === 'solid') || this.currentTool === 'rectangle') {
          const halfGrid = this.gridSize / 2;
          x = Math.round(x / halfGrid) * halfGrid;
          y = Math.round(y / halfGrid) * halfGrid;
        } else {
          // その他の図形は通常のグリッドにスナップ
          x = Math.round(x / this.gridSize) * this.gridSize;
          y = Math.round(y / this.gridSize) * this.gridSize;
        }
      }
      // ペンツールでも、Shiftキーが押されている場合はスナップ（テキストツールと消しゴムツールは除外）
      else if (this.isShiftPressed && this.currentTool === 'pen') {
        x = Math.round(x / this.gridSize) * this.gridSize;
        y = Math.round(y / this.gridSize) * this.gridSize;
      }
    }
    
    return { x, y };
  }

  startDrawing(event) {
    console.log('startDrawing called with tool:', this.currentTool);
    
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
      
      // ダブルクリックの場合は編集モードに（テキストボックス全体で判定）
      if (this.lastClickTime && Date.now() - this.lastClickTime < 500) {
        console.log('ダブルクリック検出、編集モード開始');
        this.editTextBox(clickedTextBox);
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
        console.log('エリア外でリサイズハンドル検出:', resizeHandle);
        this.isResizing = true;
        this.resizeHandle = resizeHandle;
        this.dragOffset = { x: coords.x, y: coords.y };
        this.lastClickTime = Date.now();
        this.redrawCanvas();
        return;
      }
      
      // どちらでもない場合はデフォルトで移動準備
      console.log('デフォルト移動準備');
      this.isDraggingTextBox = true;
      this.dragOffset = {
        x: coords.x - clickedTextBox.x,
        y: coords.y - clickedTextBox.y
      };
      this.lastClickTime = Date.now();
      this.redrawCanvas();
      return;
    }
    
    // 開口部をクリックしたかチェック（全ツールで有効）
    const clickedOpening = this.getOpeningAt(coords);
    console.log('開口部クリックチェック:', {
      coords: coords,
      openingsCount: this.openings.length,
      clickedOpening: clickedOpening,
      currentTool: this.currentTool
    });
    
    if (clickedOpening) {
      console.log('開口部をクリックしました');
      
      // 移動前に状態保存（開口部が実際に存在する場合のみ）
      this.saveOpeningsState();
      // 注意: ここではlastOperationTypeは変更しない（移動は新規作成ではない）
      
      // 他の開口部の選択を解除
      this.openings.forEach(opening => {
        opening.isSelected = false;
      });
      
      // クリックした開口部を選択
      clickedOpening.isSelected = true;
      this.selectedOpening = clickedOpening;
      
      // 移動準備
      this.isDraggingOpening = true;
      this.openingDragOffset = {
        x: coords.x - clickedOpening.x,
        y: coords.y - clickedOpening.y
      };
      
      this.redrawCanvas();
      return;
    }
    
    // 【ここから先は通常の描画処理】
    // テキストボックス以外をクリックした場合、選択解除
    if (this.selectedTextBox) {
      this.clearTextBoxSelection();
      this.redrawCanvas();
    }
    
    // 開口部以外をクリックした場合、開口部の選択解除
    if (this.selectedOpening) {
      this.openings.forEach(opening => {
        opening.isSelected = false;
      });
      this.selectedOpening = null;
      this.redrawCanvas();
    }
    
    this.isDrawing = true;
    this.startPoint = coords;
    this.currentPath = [coords];
    
    this.canvas.classList.add('drawing');
    
    // 開口部ツールの場合、プレビューを開始
    if (this.currentTool === 'door' && this.doorType === 'opening') {
      this.showOpeningPreview = true;
      this.openingPreviewCoords = coords;
      this.redrawCanvas(); // プレビューを表示
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
    } else if (this.currentTool === 'eraser') {
      // 消しゴム開始
      this.eraseAtPoint(coords);
    } else if (this.currentTool === 'text-horizontal' || this.currentTool === 'text-vertical') {
      // 新仕様：ドラッグでのテキストボックス作成は無効化
      return;
    }
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
    
    // リサイズ中の場合
    if (this.isResizing && this.selectedTextBox && this.resizeHandle) {
      this.resizeTextBox(this.selectedTextBox, this.resizeHandle, coords);
      this.redrawCanvas();
      return;
    }
    
    // 開口部のドラッグ中の場合
    if (this.isDraggingOpening && this.selectedOpening) {
      this.selectedOpening.x = coords.x - this.openingDragOffset.x;
      this.selectedOpening.y = coords.y - this.openingDragOffset.y;
      this.redrawCanvas();
      return;
    }
    
    // 開口部プレビュー中の場合
    if (this.showOpeningPreview && this.currentTool === 'door' && this.doorType === 'opening') {
      this.openingPreviewCoords = coords;
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
      
      // グリッドスナップを適用せずに移動
      this.selectedTextBox.x = x - this.dragOffset.x;
      this.selectedTextBox.y = y - this.dragOffset.y;
      this.redrawCanvas();
      return;
    }
    
    if (!this.isDrawing) return;
    
    this.currentPath.push(coords);
    
    if (this.currentTool === 'pen') {
      // ズーム変換を適用
      this.ctx.setTransform(this.scale, 0, 0, this.scale, this.translateX, this.translateY);
      
      // 描画設定を確実に適用
      console.log('Pen drawing - applying color:', this.strokeColor);
      this.ctx.strokeStyle = this.strokeColor;
      this.ctx.lineWidth = this.strokeWidth;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      
      this.ctx.lineTo(coords.x, coords.y);
      this.ctx.stroke();
    } else if (this.currentTool === 'eraser') {
      // 消しゴム機能
      this.eraseAtPoint(coords);
    } else {
      // 図形描画の場合、リアルタイムプレビュー
      // 直線ツールでShiftキーが押されている場合、水平・垂直線に制限
      let endPoint = coords;
      if (this.currentTool === 'line' && this.isShiftPressed) {
        const dx = Math.abs(coords.x - this.startPoint.x);
        const dy = Math.abs(coords.y - this.startPoint.y);
        
        // より長い方向に線を制限
        if (dx > dy) {
          // 水平線
          endPoint = { x: coords.x, y: this.startPoint.y };
        } else {
          // 垂直線
          endPoint = { x: this.startPoint.x, y: coords.y };
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
      return;
    }
    
    // 開口部のドラッグ終了
    if (this.isDraggingOpening) {
      this.isDraggingOpening = false;
      return;
    }
    
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    this.canvas.classList.remove('drawing');
    
    // 開口部プレビューを終了
    this.showOpeningPreview = false;
    this.openingPreviewCoords = null;
    
    let coords = this.getCoordinates(event);
    
    // 直線ツールでShiftキーが押されている場合、水平・垂直線に制限
    if (this.currentTool === 'line' && this.isShiftPressed) {
      const dx = Math.abs(coords.x - this.startPoint.x);
      const dy = Math.abs(coords.y - this.startPoint.y);
      
      if (dx > dy) {
        coords = { x: coords.x, y: this.startPoint.y };
      } else {
        coords = { x: this.startPoint.x, y: coords.y };
      }
    }
    
    // 描画完了時の処理
    if (this.currentTool === 'text-horizontal' || this.currentTool === 'text-vertical') {
      // テキストボックスはボタンクリック時に作成済みのため、ここでは何もしない
      // this.createTextBox(this.startPoint, coords);
    } else if (this.currentTool === 'door' && this.doorType === 'opening') {
      // 開口部の場合は特別処理 - タッチを離した場所（coords）に配置
      // 重要: 開口部作成時のみlastOperationTypeが設定される
      this.createOpening(coords); // startPointではなくcoordsを使用
    } else {
      // 直線、四角形、扉は太い線で保存
      const actualStrokeWidth = (this.currentTool === 'line' || this.currentTool === 'rectangle' || this.currentTool === 'door') 
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
      }
      
      this.allPaths.push(strokeData);
      this.redoStack = []; // Redo履歴をクリア
      this.lastOperationType = 'path'; // 最後の操作をpath型として記録
      console.log('パス追加:', {
        tool: strokeData.tool,
        pathCount: this.allPaths.length,
        lastOperationType: this.lastOperationType
      });
      
      // ペンツールの場合、図形認識を実行
      if (this.currentTool === 'pen') {
        this.emit('drawingComplete', this.currentPath);
      }
    }
    
    // 消しゴムプレビューをクリア（描画完了時）
    if (this.currentTool === 'eraser') {
      this.showEraserPreview = false;
      this.eraserPreviewCoords = null;
    }
    
    // 図形プレビューをクリア（描画完了時）
    this.showShapePreview = false;
    this.previewEndPoint = null;
    
    this.currentPath = [];
    
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

  drawDoor(start, end) {
    // 四方向固定の扉描画（上下左右のみ）
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
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
      case 'opening':
        // 開口部 - 自由配置（四方向固定しない）
        this.drawOpening(doorStart, doorEnd, perpDx, perpDy, fixedDoorWidth);
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
    
    // 扉開口部の枠線（壁と同じ太さの6px、中を白で塗りつぶし）
    this.ctx.save();
    
    // まず太い白線で壁を上書き（背景）
    this.ctx.lineWidth = 6;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.moveTo(intStart.x, intStart.y);
    this.ctx.lineTo(intEnd.x, intEnd.y);
    this.ctx.stroke();
    
    // まず太い白線で壁を上書き（背景）
    this.ctx.lineWidth = 6;
    this.ctx.strokeStyle = '#ffffff';
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
    this.ctx.strokeStyle = '#000000'; // 片開き扉の弧線は常に黒色で固定
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
    this.ctx.strokeStyle = '#000000'; // 片開き扉の位置線は常に黒色で固定
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
    
    // 扉開口部の枠線（壁と同じ太さの6px、中を白で塗りつぶし）
    this.ctx.save();
    
    // まず太い白線で壁を上書き（背景）
    this.ctx.lineWidth = 6;
    this.ctx.strokeStyle = '#ffffff';
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
    this.ctx.strokeStyle = '#000000'; // 両開き扉の分割線は常に黒色で固定
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
    this.ctx.strokeStyle = '#000000'; // 両開き扉の弧線は常に黒色で固定
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
    this.ctx.strokeStyle = '#000000'; // 両開き扉の位置線は常に黒色で固定
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
    this.ctx.strokeStyle = '#000000'; // 両開き扉の弧線は常に黒色で固定
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
    this.ctx.strokeStyle = '#000000'; // 両開き扉の位置線は常に黒色で固定
    this.ctx.beginPath();
    const rightDoorX = Math.floor(intEnd.x + Math.cos(rightOpenAngle) * radius) + 0.5;
    const rightDoorY = Math.floor(intEnd.y + Math.sin(rightOpenAngle) * radius) + 0.5;
    this.ctx.moveTo(intEnd.x, intEnd.y);
    this.ctx.lineTo(rightDoorX, rightDoorY);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawOpening(start, end, perpDx, perpDy, width) {
    // 開口部：2.5マス程度の四角形 - 自由配置
    // この関数では実際の作成は行わず、stopDrawingで作成する
    // 何もしない - stopDrawingで作成する
  }

  drawStairs(start, end) {
    // 階段記号を描画：矢印に横線（段鼻線）が複数本
    console.log(`階段描画開始: start(${start.x}, ${start.y}), end(${end.x}, ${end.y}), stairWidth: ${this.stairWidth}px`);
    
    this.ctx.save();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#000000'; // 階段は常に黒色で固定
    
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
  
  drawSingleOpening(opening) {
    // 単一の開口部を描画
    this.ctx.save();
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = '#000000'; // 開口部の枠線は常に黒色で固定
    this.ctx.fillStyle = 'rgba(240, 240, 240, 0.9)'; // グレー塗りつぶし
    
    // 四角形を描画
    this.ctx.beginPath();
    this.ctx.rect(opening.x + 0.5, opening.y + 0.5, opening.width, opening.height);
    this.ctx.fill();
    this.ctx.stroke();
    
    // 選択されている場合は分かりやすい青い枠を描画
    if (opening.isSelected) {
      this.ctx.lineWidth = 3; // より太く
      this.ctx.strokeStyle = '#0080ff'; // より明るい青
      this.ctx.setLineDash([8, 4]); // より大きな点線
      this.ctx.strokeRect(opening.x - 2, opening.y - 2, opening.width + 4, opening.height + 4);
      this.ctx.setLineDash([]);
      
      // 中央に移動可能アイコン（十字）を表示
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = '#0080ff';
      const centerX = opening.x + opening.width / 2;
      const centerY = opening.y + opening.height / 2;
      const iconSize = 8;
      
      // 十字マーク
      this.ctx.beginPath();
      this.ctx.moveTo(centerX - iconSize, centerY);
      this.ctx.lineTo(centerX + iconSize, centerY);
      this.ctx.moveTo(centerX, centerY - iconSize);
      this.ctx.lineTo(centerX, centerY + iconSize);
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }

  // 開口部をクリックしたかを判定
  getOpeningAt(coords) {
    for (let i = this.openings.length - 1; i >= 0; i--) {
      const opening = this.openings[i];
      if (coords.x >= opening.x && coords.x <= opening.x + opening.width &&
          coords.y >= opening.y && coords.y <= opening.y + opening.height) {
        return opening;
      }
    }
    return null;
  }

  // 開口部を作成
  createOpening(endPoint) {
    // 現在の開口部状態を履歴に保存
    this.saveOpeningsState();
    
    const gridSize = 20; // グリッドサイズ
    const openingSize = gridSize * 2.5; // 2.5マス分のサイズ（50px）
    
    // 開口部オブジェクトを作成（タッチを離した場所を中心に配置）
    const opening = {
      x: Math.floor(endPoint.x) - openingSize / 2,
      y: Math.floor(endPoint.y) - openingSize / 2,
      width: openingSize,
      height: openingSize,
      isSelected: true // 作成時に選択状態にして分かりやすく
    };
    
    // 他の開口部の選択を解除
    this.openings.forEach(existingOpening => {
      existingOpening.isSelected = false;
    });
    
    // 開口部配列に追加
    this.openings.push(opening);
    this.selectedOpening = opening;
    
    // 実際に開口部が作成された時のみlastOperationTypeを設定
    this.lastOperationType = 'opening';
    console.log('開口部作成完了: lastOperationType = opening');
    
    // 再描画
    this.redrawCanvas();
  }

  // 開口部プレビューを描画
  drawOpeningPreview() {
    const gridSize = 20; // グリッドサイズ
    const openingSize = gridSize * 2.5; // 2.5マス分のサイズ（50px）
    
    // プレビュー四角形の位置
    const x = Math.floor(this.openingPreviewCoords.x) - openingSize / 2;
    const y = Math.floor(this.openingPreviewCoords.y) - openingSize / 2;
    
    this.ctx.save();
    
    // 半透明の四角形を描画
    this.ctx.fillStyle = 'rgba(240, 240, 240, 0.6)'; // より薄く
    this.ctx.strokeStyle = '#0080ff'; // 青い枠
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([6, 3]); // 点線
    
    this.ctx.beginPath();
    this.ctx.rect(x + 0.5, y + 0.5, openingSize, openingSize);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    // プレビューであることを示すテキスト
    this.ctx.fillStyle = '#0080ff';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('開口部', x + openingSize / 2, y - 5);
    
    this.ctx.restore();
  }

  redrawCanvas() {
    // デバウンシング処理で不要な再描画を防止
    if (this.redrawTimeout) {
      cancelAnimationFrame(this.redrawTimeout);
    }
    
    this.redrawTimeout = requestAnimationFrame(() => {
      this._performRedraw();
    });
  }

  _performRedraw() {
    // キャンバスを完全にクリア
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // ズーム・パン変換を適用
    this.ctx.setTransform(this.scale, 0, 0, this.scale, this.translateX, this.translateY);
    
    // グリッドを描画
    this.drawGrid();
    
    console.log('redrawCanvas: パス数=', this.allPaths.length, 'scale:', this.scale);
    
    this.allPaths.forEach((pathData, index) => {
      console.log(`パス${index}: ${pathData.tool}`);
      
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
      } else if (pathData.tool === 'text-horizontal' || pathData.tool === 'text-vertical') {
        // テキストの描画
        console.log(`テキスト: "${pathData.text}" at (${pathData.x}, ${pathData.y})`);
        this.ctx.fillStyle = pathData.strokeColor;
        this.ctx.font = `${pathData.fontSize}px "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", Arial, sans-serif`;
        
        if (pathData.isVertical) {
          this.drawVerticalText(pathData.text, pathData.x, pathData.y, pathData.fontSize);
        } else {
          this.ctx.fillText(pathData.text, pathData.x, pathData.y);
        }
      } else if (pathData.tool === 'textbox') {
        // テキストボックスの描画
        console.log('テキストボックスを描画:', pathData);
        this.drawTextBox(pathData);
      } else {
        // 図形の描画
        console.log(`図形: ${pathData.tool} (${pathData.startPoint.x},${pathData.startPoint.y}) → (${pathData.endPoint.x},${pathData.endPoint.y})`);
        this.ctx.strokeStyle = pathData.strokeColor;
        this.ctx.lineWidth = pathData.strokeWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // 線スタイル設定
        if (pathData.tool === 'line') {
          const lineStyle = pathData.lineStyle || (pathData.isDashed ? 'dashed' : (pathData.hasArrow ? 'arrow' : 'solid'));
          if (lineStyle === 'dashed') {
            console.log('保存済み図形で点線を設定します:', lineStyle);
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
            // 扉の描画時は扉の種類も復元
            const savedDoorType = this.doorType;
            this.doorType = pathData.doorType || 'opening';
            this.drawDoor(pathData.startPoint, pathData.endPoint);
            this.doorType = savedDoorType;
            // 扉描画では各メソッド内でstroke()済みのため、stroke()をスキップ
            this.ctx.restore();
            return; // forEachのコールバック内なのでreturnでスキップ
          case 'stairs':
            // 階段の描画時は階段設定も復元
            const savedStairSteps = this.stairSteps;
            const savedStairWidth = this.stairWidth;
            this.stairSteps = pathData.stairSteps || 10;
            this.stairWidth = pathData.stairWidth || this.gridSize * 1; // デフォルト1マス
            this.drawStairs(pathData.startPoint, pathData.endPoint);
            this.stairSteps = savedStairSteps;
            this.stairWidth = savedStairWidth;
            // 階段描画では各メソッド内でstroke()済みのため、stroke()をスキップ
            this.ctx.restore();
            return; // forEachのコールバック内なのでreturnでスキップ
          // circleツールは廃止
        }
        
        this.ctx.stroke();
        
        // 直線で矢印が有効な場合は矢印を描画
        if (pathData.tool === 'line') {
          const lineStyle = pathData.lineStyle || (pathData.hasArrow ? 'arrow' : 'solid');
          console.log('保存済み直線の線スタイル確認:', { 
            lineStyle: lineStyle, 
            pathDataLineStyle: pathData.lineStyle,
            pathDataHasArrow: pathData.hasArrow 
          });
          if (lineStyle === 'arrow') {
            console.log('保存済み図形で矢印を描画します');
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
    
    // 開口部を描画
    this.openings.forEach(opening => {
      this.drawSingleOpening(opening);
    });
    
    // 開口部プレビューを描画
    if (this.showOpeningPreview && this.openingPreviewCoords) {
      this.drawOpeningPreview();
    }
    
    // 消しゴムプレビューの描画
    if (this.showEraserPreview && this.eraserPreviewCoords) {
      this.drawEraserPreview();
    }
    
    // 図形プレビューの描画
    if (this.showShapePreview && this.startPoint && this.previewEndPoint) {
      this.drawShapePreview(this.startPoint, this.previewEndPoint);
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

  drawSelectionHandles(textBox) {
    // 現在の描画設定を保存
    const originalStrokeStyle = this.ctx.strokeStyle;
    const originalFillStyle = this.ctx.fillStyle;
    const originalLineWidth = this.ctx.lineWidth;
    const originalFont = this.ctx.font;
    const originalTextAlign = this.ctx.textAlign;
    const originalTextBaseline = this.ctx.textBaseline;
    
    // テキストの実際の描画サイズを計算
    const actualSize = this.calculateActualTextBoxSize(textBox);
    const handles = this.getResizeHandles(textBox);
    
    // 選択枠を描画（薄い紫色）- 実際のテキストサイズで描画
    this.ctx.strokeStyle = '#8B5CF6';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([3, 3]);
    this.ctx.beginPath();
    this.ctx.rect(textBox.x, textBox.y, actualSize.width, actualSize.height);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    // 移動エリアを薄く表示（視覚的ガイド）- 実際のテキストサイズに基づく
    const margin = this.handleSize;
    const moveAreaX = textBox.x + margin;
    const moveAreaY = textBox.y + margin;
    const moveAreaWidth = Math.max(0, actualSize.width - margin * 2);
    const moveAreaHeight = Math.max(0, actualSize.height - margin * 2);
    
    if (moveAreaWidth > 0 && moveAreaHeight > 0) {
      this.ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
      this.ctx.fillRect(moveAreaX, moveAreaY, moveAreaWidth, moveAreaHeight);
      
      // 移動アイコンを中央に表示
      const centerX = textBox.x + textBox.width / 2;
      const centerY = textBox.y + textBox.height / 2;
      
      this.ctx.fillStyle = 'rgba(139, 92, 246, 0.5)';
      this.ctx.font = '10px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('⊹', centerX, centerY);
    }
    
    // ハンドルを描画（小さくてスタイリッシュに）
    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = '#8B5CF6';
    this.ctx.lineWidth = 1.5;
    
    for (let handleName in handles) {
      const handle = handles[handleName];
      
      // 横方向のリサイズハンドルのみ表示
      if (handleName === 'w' || handleName === 'e') {
        // 影の描画
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        this.ctx.fillRect(
          handle.x - this.handleSize / 2 + 1,
          handle.y - this.handleSize / 2 + 1,
          this.handleSize,
          this.handleSize
        );
        this.ctx.restore();
        
        // ハンドル本体の描画
        this.ctx.beginPath();
        this.ctx.rect(
          handle.x - this.handleSize / 2,
          handle.y - this.handleSize / 2,
          this.handleSize,
          this.handleSize
        );
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fill();
        this.ctx.strokeStyle = '#8B5CF6';
        this.ctx.stroke();
        
        // 中央にドットを追加（操作しやすくするため）
        this.ctx.beginPath();
        this.ctx.arc(handle.x, handle.y, 1.5, 0, 2 * Math.PI);
        this.ctx.fillStyle = '#8B5CF6';
        this.ctx.fill();
      }
    }
    
    // 元の描画設定を復元
    this.ctx.strokeStyle = originalStrokeStyle;
    this.ctx.fillStyle = originalFillStyle;
    this.ctx.lineWidth = originalLineWidth;
    this.ctx.font = originalFont;
    this.ctx.textAlign = originalTextAlign;
    this.ctx.textBaseline = originalTextBaseline;
  }

  drawVerticalText(text, x, y, fontSize) {
    const chars = text.split('');
    chars.forEach((char, index) => {
      this.ctx.fillText(char, x, y + (index * fontSize));
    });
  }

  drawTextBoxPreview(start, end) {
    // テキストボックスのプレビュー枠を描画
    this.ctx.strokeStyle = '#007AFF';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    
    const width = end.x - start.x;
    const height = end.y - start.y;
    this.ctx.rect(start.x, start.y, width, height);
    this.ctx.stroke();
    this.ctx.setLineDash([]); // 点線をリセット
  }

  createTextBox(start, end) {
    // テキストボックスを作成
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    const isVertical = this.currentTool === 'text-vertical';
    
    // 最小サイズを確保
    const minWidth = isVertical ? 60 : 120;
    const minHeight = 60;
    const actualWidth = Math.max(width, minWidth);
    const actualHeight = Math.max(height, minHeight);
    
    this.createTextBoxAuto(centerX, centerY, actualWidth, actualHeight, isVertical);
  }

  // 新仕様：自動サイズ・自動配置のテキストボックス生成
  createTextBoxAuto(centerX, centerY, width, height, isVertical) {
    console.log('=== createTextBoxAuto が呼ばれました ===');
    console.log('既存のテキスト入力状態:', {
      textInput: this.textInput,
      parentNode: this.textInput ? this.textInput.parentNode : null,
      allPathsCount: this.allPaths.length
    });
    
    // 編集中のテキストボックスがある場合は新しいボックスを作成しない
    const hasEditingTextBox = this.allPaths.some(path => 
      path.tool === 'textbox' && path.isSelected
    );
    
    if (hasEditingTextBox || (this.textInput && this.textInput.parentNode)) {
      console.log('編集中のテキストボックスがあるため、新しいテキストボックスの作成をスキップします');
      return;
    }
    
    // テキストボックスデータを作成
    const textBoxData = {
      tool: 'textbox',
      x: centerX - width / 2,
      y: centerY - height / 2,
      width: width,
      height: height,
      text: '',
      fontSize: this.fontSize,
      fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", Arial, sans-serif',
      strokeColor: this.strokeColor,
      isVertical: isVertical,
      isSelected: true
    };
    // 他のテキストボックスの選択を解除
    this.allPaths.forEach(path => {
      if (path.tool === 'textbox') {
        path.isSelected = false;
      }
    });
    this.setSelectedTextBox(textBoxData);
    this.allPaths.push(textBoxData);
    this.redoStack = [];
    this.lastOperationType = 'path'; // テキストボックスもpathとして扱う
    console.log('テキストボックス作成: lastOperationType = path');
    console.log('作成されたテキストボックス:', textBoxData);
    console.log('allPaths配列:', this.allPaths);
    this.redrawCanvas();
    this.editTextBox(textBoxData);
  }

  editTextBox(textBoxData) {
    console.log('=== editTextBox 開始 ===');
    console.log('textBoxData:', textBoxData);
    console.log('isVertical:', textBoxData.isVertical);
    
    // 他の編集中のテキストボックスがある場合は何もしない
    const hasOtherEditingTextBox = this.allPaths.some(path => 
      path.tool === 'textbox' && path.isSelected && path !== textBoxData
    );
    
    if (hasOtherEditingTextBox || (this.textInput && this.textInput.parentNode)) {
      console.log('他の編集中のテキストボックスがあるため、編集をスキップします');
      // 新しく作成されたテキストボックスを削除
      const index = this.allPaths.indexOf(textBoxData);
      if (index > -1) {
        this.allPaths.splice(index, 1);
        console.log('重複テキストボックスを削除');
        this.redrawCanvas();
      }
      return;
    }
    
    // 既存のテキスト入力があれば削除
    this.removeTextInput();
    
    const rect = this.canvas.getBoundingClientRect();
    const container = this.canvas.parentElement;
    
    // テキスト入力要素を作成
    if (textBoxData.isVertical) {
      // 縦書きの場合はdivを使用（iPad対応）
      this.textInput = document.createElement('div');
      this.textInput.contentEditable = true;
      this.textInput.setAttribute('role', 'textbox');
      this.textInput.setAttribute('aria-multiline', 'true');
      this.textInput.textContent = textBoxData.text || '';
    } else {
      // 横書きの場合はtextareaを使用
      this.textInput = document.createElement('textarea');
      this.textInput.value = textBoxData.text;
      this.textInput.placeholder = '横書きテキスト';
    }
    this.textInput.className = 'text-input-overlay';
    
    // フォントサイズは指定値をそのまま使う
    const adjustedFontSize = textBoxData.fontSize;
    const padding = Math.max(4, adjustedFontSize * 0.2);
    // 高DPI対応
    const dpr = window.devicePixelRatio || 1;
    // ワールド座標をスクリーン座標に変換
    const screenX = textBoxData.x * this.scale + this.translateX;
    const screenY = textBoxData.y * this.scale + this.translateY;
    const screenWidth = textBoxData.width * this.scale;
    const screenHeight = textBoxData.height * this.scale;
    
    // スタイル設定
    this.textInput.style.position = 'absolute';
    
    if (textBoxData.isVertical) {
      // 縦書きの場合は左側に配置（3行分の幅を考慮してフォントサイズ×3.0分左にずらす）
      this.textInput.style.left = `${screenX / dpr + rect.left - container.offsetLeft + padding - adjustedFontSize * 3.0}px`;
      this.textInput.style.top = `${screenY / dpr + rect.top - container.offsetTop + padding}px`;
    } else {
      // 横書きの場合は通常の位置
      this.textInput.style.left = `${screenX / dpr + rect.left - container.offsetLeft + padding}px`;
      this.textInput.style.top = `${screenY / dpr + rect.top - container.offsetTop + padding}px`;
    }
    // iPad等タッチ端末では最小サイズを大きめに
    if (textBoxData.isVertical) {
      // 縦書きの場合：3行分の幅を確保
      const minW = Math.max(adjustedFontSize * 3.5, 80);
      const minH = Math.max(adjustedFontSize * 10, 250);
      this.textInput.style.width = `${minW}px`;
      this.textInput.style.height = `${minH}px`;
    } else {
      // 横書きの場合
      const minW = Math.max(80, screenWidth - padding * 2, adjustedFontSize * 5);
      const minH = Math.max(40, screenHeight / dpr - padding * 2, adjustedFontSize * 2);
      this.textInput.style.width = `${minW}px`;
      this.textInput.style.height = `${minH}px`;
    }
    this.textInput.style.fontSize = `${adjustedFontSize / dpr}px`;
    this.textInput.style.fontFamily = textBoxData.fontFamily;
    this.textInput.style.color = textBoxData.strokeColor;
    this.textInput.style.background = 'rgba(255, 255, 255, 0.8)'; // より透明にして背景が見えるように
    this.textInput.style.border = '2px solid #007AFF';
    this.textInput.style.borderRadius = '4px';
    this.textInput.style.padding = '2px';
    this.textInput.style.resize = 'none';
    this.textInput.style.zIndex = '1000';
    this.textInput.style.overflow = 'hidden';
    this.textInput.style.boxSizing = 'border-box';
    this.textInput.style.lineHeight = '1.3';
    this.textInput.style.cursor = 'text';
    
    if (textBoxData.isVertical) {
      console.log('縦書きテキストボックス編集 - 縦書きスタイルを適用');
      // CSSクラスを追加
      this.textInput.classList.add('vertical');
      this.textInput.classList.remove('horizontal');
      
      // iPad/Safari対応のため複数の縦書きプロパティを設定
      this.textInput.style.setProperty('writing-mode', 'vertical-rl', 'important');
      this.textInput.style.setProperty('-webkit-writing-mode', 'vertical-rl', 'important');
      this.textInput.style.setProperty('-ms-writing-mode', 'tb-rl', 'important');
      this.textInput.style.setProperty('text-orientation', 'upright', 'important');
      this.textInput.style.setProperty('-webkit-text-orientation', 'upright', 'important');
      this.textInput.style.setProperty('direction', 'ltr', 'important');
      
      // 縦書き用のサイズ調整
      this.textInput.style.minWidth = '40px';
      this.textInput.style.minHeight = '80px';
      
      // iPad専用の追加設定
      this.textInput.setAttribute('dir', 'ltr');
    } else {
      console.log('横書きテキストボックス編集 - 横書きスタイルを適用');
      // CSSクラスを追加
      this.textInput.classList.add('horizontal');
      this.textInput.classList.remove('vertical');
      
      // 横書きの場合は縦書きスタイルをリセット
      this.textInput.style.setProperty('writing-mode', 'horizontal-tb', 'important');
      this.textInput.style.setProperty('-webkit-writing-mode', 'horizontal-tb', 'important');
      this.textInput.style.setProperty('-ms-writing-mode', 'lr-tb', 'important');
      this.textInput.style.setProperty('text-orientation', 'mixed', 'important');
      this.textInput.style.setProperty('-webkit-text-orientation', 'mixed', 'important');
      this.textInput.style.setProperty('direction', 'ltr', 'important');
      
      this.textInput.removeAttribute('dir');
    }
    
    // 現在編集中のテキストボックスを保存
    this.selectedTextBox = textBoxData;
    this.currentTextBox = textBoxData;
    
    // イベントリスナー
    this.textInput.addEventListener('blur', () => this.finishTextBoxEdit());
    this.textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.cancelTextBoxEdit();
      } else if (e.key === 'Enter') {
        if (textBoxData.isVertical && this.textInput.contentEditable) {
          // 縦書きcontenteditable divの場合
          if (e.ctrlKey) {
            // Ctrl+Enterで入力完了
            e.preventDefault();
            this.finishTextBoxEdit();
          } else {
            // 通常のEnterで改行を挿入
            e.preventDefault();
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            const br = document.createElement('br');
            range.deleteContents();
            range.insertNode(br);
            range.setStartAfter(br);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } else if (textBoxData.isVertical) {
          // 縦書きtextareaの場合は通常のEnterで改行を許可
          if (e.ctrlKey) {
            // Ctrl+Enterで入力完了
            e.preventDefault();
            this.finishTextBoxEdit();
          }
        } else {
          // 横書きの場合はCtrl+Enterで入力完了
          if (e.ctrlKey) {
            e.preventDefault();
            this.finishTextBoxEdit();
          }
        }
      }
    });
    
    container.appendChild(this.textInput);
    
    console.log('=== テキスト入力要素のスタイル確認 ===');
    console.log('writingMode:', this.textInput.style.writingMode);
    console.log('textOrientation:', this.textInput.style.textOrientation);
    console.log('isVertical:', textBoxData.isVertical);
    
    // フォーカスを設定
    setTimeout(() => {
      this.textInput.focus();
      // カーソルスタイルを確実に設定
      this.textInput.style.cursor = 'text';
      // textareaとdivで選択方法を分ける
      if (this.textInput.select) {
        this.textInput.select(); // textarea用
      } else {
        // contenteditable div用
        const range = document.createRange();
        range.selectNodeContents(this.textInput);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }, 10);
  }

  finishTextBoxEdit() {
    if (!this.textInput || !this.selectedTextBox) return;
    
    // テキストを取得（divとtextareaの両方に対応）
    const text = (this.textInput.value !== undefined 
      ? this.textInput.value 
      : this.textInput.textContent || this.textInput.innerText || '').trim();
    this.selectedTextBox.text = text;
    
    this.removeTextInput();
    this.selectedTextBox = null;
    this.currentTextBox = null;
    this.redrawCanvas();
  }

  cancelTextBoxEdit() {
    if (!this.selectedTextBox) return;
    
    // テキストが空の場合、テキストボックスを削除
    if (!this.selectedTextBox.text.trim()) {
      const index = this.allPaths.indexOf(this.selectedTextBox);
      if (index > -1) {
        this.allPaths.splice(index, 1);
      }
    }
    
    this.removeTextInput();
    this.selectedTextBox = null;
    this.currentTextBox = null;
    this.redrawCanvas();
  }

  drawTextBox(textBoxData) {
    console.log('=== drawTextBox 開始 ===');
    console.log('textBoxData:', textBoxData);
    
    // テキストボックスの枠線を描画
    this.ctx.strokeStyle = '#CCCCCC';
    this.ctx.lineWidth = 1;
    let { x, y, width, height, text, fontSize, fontFamily, strokeColor, isVertical } = textBoxData;
    // フォントサイズはズーム倍率を掛けず、図面上のサイズで描画
    this.ctx.font = `${fontSize}px ${fontFamily}`;

    // 折り返し判定も元の幅で行う
    const boxWidth = width;
    const boxHeight = height;
    const padding = Math.max(4, fontSize * 0.2);
    const lineHeight = fontSize * 1.3;

    // テキストサイズを計算し、必要ならボックスを拡張
    if (text && text.trim()) {
      this.ctx.fillStyle = strokeColor;
      if (isVertical) {
        // 縦書き：改行を処理して列ごとに文字を配置
        const inputLines = text.split('\n'); // 改行で分割
        let maxLineLength = 0;
        let totalColumns = inputLines.length;
        
        for (let inputLine of inputLines) {
          maxLineLength = Math.max(maxLineLength, inputLine.length);
        }
        
        const textHeight = maxLineLength * fontSize + padding * 2;
        const textWidth = totalColumns * fontSize * 1.2 + padding * 2;
        if (height < textHeight) height = textHeight;
        if (width < textWidth) width = textWidth;
      } else {
        // 横書き：改行と自動折り返しを処理
        const inputLines = text.split('\n'); // 改行で分割
        let allLines = [];
        let maxLineWidth = 0;
        
        for (let inputLine of inputLines) {
          if (inputLine === '') {
            // 空行の場合はそのまま追加
            allLines.push('');
            continue;
          }
          
          // 各行について自動折り返しを適用
          const chars = inputLine.split('');
          let line = '';
          for (let char of chars) {
            const testLine = line + char;
            const metrics = this.ctx.measureText(testLine);
            if (metrics.width > boxWidth - padding * 2 && line !== '') {
              allLines.push(line);
              maxLineWidth = Math.max(maxLineWidth, this.ctx.measureText(line).width);
              line = char;
            } else {
              line = testLine;
            }
          }
          if (line) {
            allLines.push(line);
            maxLineWidth = Math.max(maxLineWidth, this.ctx.measureText(line).width);
          }
        }
        
        const textHeight = allLines.length * lineHeight + padding * 2;
        if (height < textHeight) height = textHeight;
        if (width < maxLineWidth + padding * 2) width = maxLineWidth + padding * 2;
      }
    }
    // ボックスを描画
    this.ctx.beginPath();
    this.ctx.rect(x, y, width, height);
    console.log('テキストボックス枠を描画:', { x, y, width, height });
    this.ctx.stroke();
    // テキストを描画
    if (text && text.trim()) {
      this.ctx.fillStyle = strokeColor;
      if (isVertical) {
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // 縦書き：改行を処理して列ごとに文字を配置（完全中央配置）
        const inputLines = text.split('\n');
        const totalColumns = inputLines.length;
        const columnSpacing = fontSize * 1.2;
        const totalTextWidth = totalColumns * columnSpacing;
        
        // 最長の列の文字数を取得
        const maxLineLength = Math.max(...inputLines.map(line => line.length));
        const totalTextHeight = maxLineLength * fontSize;
        
        // 完全中央配置のための開始座標を計算
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const startX = centerX - (totalTextWidth - columnSpacing) / 2;
        const startY = centerY - totalTextHeight / 2;
        
        inputLines.forEach((line, columnIndex) => {
          const chars = line.split('');
          const columnX = startX + (columnIndex * columnSpacing);
          
          chars.forEach((char, charIndex) => {
            const yy = startY + (charIndex * fontSize) + fontSize / 2;
            this.ctx.fillText(char, columnX, yy);
          });
        });
      } else {
        // 横テキスト：文字位置を改善（中央寄せ）
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle'; // 中央ベースラインに変更
        
        // 改行と自動折り返しを処理
        const inputLines = text.split('\n'); // 改行で分割
        let allLines = [];
        
        for (let inputLine of inputLines) {
          if (inputLine === '') {
            // 空行の場合はそのまま追加
            allLines.push('');
            continue;
          }
          
          // 各行について自動折り返しを適用
          const chars = inputLine.split('');
          let line = '';
          for (let char of chars) {
            const testLine = line + char;
            const metrics = this.ctx.measureText(testLine);
            if (metrics.width > width - padding * 2 && line !== '') {
              allLines.push(line);
              line = char;
            } else {
              line = testLine;
            }
          }
          if (line) {
            allLines.push(line);
          }
        }
        
        // 各行を描画（上下左右中央揃え）
        const totalTextHeight = allLines.length * lineHeight;
        const startY = y + (height - totalTextHeight) / 2 + fontSize/2;
        
        allLines.forEach((lineText, index) => {
          const xx = x + padding;
          const yy = startY + (index * lineHeight);
          this.ctx.fillText(lineText, xx, yy);
        });
      }
      this.ctx.textAlign = 'start';
      this.ctx.textBaseline = 'alphabetic';
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

  getTextBoxAt(coords) {
    console.log('Searching for textbox at:', coords);
    console.log('Total paths:', this.allPaths.length);
    
    // allPathsを逆順で検索（最後に描いたものが優先）
    for (let i = this.allPaths.length - 1; i >= 0; i--) {
      const pathData = this.allPaths[i];
      console.log(`Path ${i}:`, pathData.tool, pathData);
      if (pathData.tool === 'textbox' && this.isPointInTextBox(coords, pathData)) {
        console.log('Found matching textbox:', pathData);
        return pathData;
      }
    }
    console.log('No textbox found at coordinates');
    return null;
  }

  isPointInTextBox(coords, textBox) {
    // テキストの実際の描画サイズを計算
    const actualSize = this.calculateActualTextBoxSize(textBox);
    
    return coords.x >= textBox.x && 
           coords.x <= textBox.x + actualSize.width &&
           coords.y >= textBox.y && 
           coords.y <= textBox.y + actualSize.height;
  }

  // テキストボックスの実際の描画サイズを計算
  calculateActualTextBoxSize(textBox) {
    if (!textBox.text || !textBox.text.trim()) {
      return { width: textBox.width, height: textBox.height };
    }

    // 一時的にフォントを設定
    const originalFont = this.ctx.font;
    this.ctx.font = `${textBox.fontSize}px ${textBox.fontFamily || 'Arial'}`;
    
    let { width, height, fontSize, isVertical, text } = textBox;
    const padding = Math.max(4, fontSize * 0.2);
    const lineHeight = fontSize * 1.3;

    if (isVertical) {
      // 縦書き：改行を処理して列ごとに文字を配置
      const inputLines = text.split('\n');
      let maxLineLength = 0;
      let totalColumns = inputLines.length;
      
      for (let inputLine of inputLines) {
        maxLineLength = Math.max(maxLineLength, inputLine.length);
      }
      
      const textHeight = maxLineLength * fontSize + padding * 2;
      const textWidth = totalColumns * fontSize * 1.2 + padding * 2;
      height = Math.max(height, textHeight);
      width = Math.max(width, textWidth);
    } else {
      // 横書き：改行と自動折り返しを処理
      const inputLines = text.split('\n');
      let allLines = [];
      let maxLineWidth = 0;
      
      // まず、各行の自然な幅を測定（折り返しなし）
      for (let inputLine of inputLines) {
        if (inputLine === '') {
          allLines.push('');
          continue;
        }
        
        // 行の自然な幅を測定
        const naturalLineWidth = this.ctx.measureText(inputLine).width;
        maxLineWidth = Math.max(maxLineWidth, naturalLineWidth);
        
        // 現在のテキストボックス幅での折り返しも計算
        const chars = inputLine.split('');
        let line = '';
        for (let char of chars) {
          const testLine = line + char;
          const metrics = this.ctx.measureText(testLine);
          if (metrics.width > width - padding * 2 && line !== '') {
            allLines.push(line);
            line = char;
          } else {
            line = testLine;
          }
        }
        if (line) {
          allLines.push(line);
        }
      }
      
      const textHeight = allLines.length * lineHeight + padding * 2;
      height = Math.max(height, textHeight);
      
      // 自然な最大行幅に基づいて幅を決定（折り返しを最小限に）
      const naturalRequiredWidth = maxLineWidth + padding * 2;
      width = Math.max(width, naturalRequiredWidth);
    }

    // フォントを元に戻す
    this.ctx.font = originalFont;
    
    return { width, height };
  }

  // テキストボックスの中央移動エリアをチェック
  isPointInMoveArea(coords, textBox) {
    // テキストの実際の描画サイズを計算
    const actualSize = this.calculateActualTextBoxSize(textBox);
    
    // リサイズハンドルを除いた中央エリアを移動エリアとする
    const margin = this.handleSize; // ハンドルサイズ分の余白
    const moveAreaX = textBox.x + margin;
    const moveAreaY = textBox.y + margin;
    const moveAreaWidth = Math.max(0, actualSize.width - margin * 2);
    const moveAreaHeight = Math.max(0, actualSize.height - margin * 2);
    
    const isInMoveArea = coords.x >= moveAreaX && 
                        coords.x <= moveAreaX + moveAreaWidth &&
                        coords.y >= moveAreaY && 
                        coords.y <= moveAreaY + moveAreaHeight;
    
    console.log('移動エリア判定:', {
      coords: coords,
      moveArea: { x: moveAreaX, y: moveAreaY, width: moveAreaWidth, height: moveAreaHeight },
      actualSize: actualSize,
      isInMoveArea: isInMoveArea
    });
    
    return isInMoveArea;
  }

  getResizeHandle(coords, textBox) {
    const handles = this.getResizeHandles(textBox);
    // タッチデバイスを考慮した検出範囲
    const detectionSize = this.handleSize * 2.5;
    
    console.log('ハンドル検出試行:', {
      coords: coords,
      textBox: { x: textBox.x, y: textBox.y, width: textBox.width, height: textBox.height },
      detectionSize: detectionSize
    });
    
    // 横方向のハンドルのみを検出対象とする
    const handlePriority = ['w', 'e'];
    
    for (let handleName of handlePriority) {
      const handle = handles[handleName];
      
      // 四角形の検出範囲を使用（より直感的）
      const halfSize = detectionSize / 2;
      const isInRange = coords.x >= handle.x - halfSize && 
                       coords.x <= handle.x + halfSize &&
                       coords.y >= handle.y - halfSize && 
                       coords.y <= handle.y + halfSize;
      
      console.log(`ハンドル${handleName}検出:`, {
        handle: handle,
        range: {
          left: handle.x - halfSize,
          right: handle.x + halfSize,
          top: handle.y - halfSize,
          bottom: handle.y + halfSize
        },
        isInRange: isInRange
      });
      
      if (isInRange) {
        console.log('✅ ハンドル検出成功:', handleName);
        return handleName;
      }
    }
    
    console.log('❌ ハンドル検出失敗');
    return null;
  }

  resizeTextBox(textBox, handle, coords) {
    console.log('🔄 リサイズ実行:', { 
      handle, 
      coords, 
      textBox: { x: textBox.x, y: textBox.y, width: textBox.width, height: textBox.height } 
    });

    const minWidth = Math.max(30, this.fontSize * 3);
    const minHeight = Math.max(20, this.fontSize * 2);

    let newWidth = textBox.width;
    let newHeight = textBox.height;

    const oldValues = {
      x: textBox.x,
      y: textBox.y,
      width: textBox.width,
      height: textBox.height
    };

    switch (handle) {
      case 'w': // 左中央
        newWidth = textBox.width + (textBox.x - coords.x);
        if (newWidth >= minWidth) {
          textBox.width = newWidth;
          textBox.x = coords.x;
        }
        break;
      case 'e': // 右中央
        newWidth = coords.x - textBox.x;
        if (newWidth >= minWidth) {
          textBox.width = newWidth;
        }
        break;
    }

    console.log('✅ リサイズ完了:', {
      handle,
      coords,
      textBox: { x: textBox.x, y: textBox.y, width: textBox.width, height: textBox.height }
    });

    this.redrawCanvas();
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

  getResizeHandles(textBox) {
    // テキストの実際の描画サイズを計算
    const actualSize = this.calculateActualTextBoxSize(textBox);
    
    const x = textBox.x;
    const y = textBox.y;
    const w = actualSize.width;
    const h = actualSize.height;
    
    return {
      'nw': { x: x, y: y },           // 左上
      'ne': { x: x + w, y: y },       // 右上
      'sw': { x: x, y: y + h },       // 左下
      'se': { x: x + w, y: y + h },   // 右下
      'n': { x: x + w/2, y: y },      // 上中央
      's': { x: x + w/2, y: y + h },  // 下中央
      'w': { x: x, y: y + h/2 },      // 左中央
      'e': { x: x + w, y: y + h/2 }   // 右中央
    };
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

  setSelectedTextBox(textBox) {
    // 前の選択を解除
    if (this.selectedTextBox) {
      this.selectedTextBox.isSelected = false;
      this.emit('textBoxDeselected');
    }
    
    // 新しい選択を設定
    this.selectedTextBox = textBox;
    if (textBox) {
      textBox.isSelected = true;
      this.emit('textBoxSelected', textBox);
    }
  }

  clearTextBoxSelection() {
    // すべてのテキストボックスの選択状態をクリア
    this.allPaths.forEach(path => {
      if (path.tool === 'textbox') {
        path.isSelected = false;
      }
    });
    
    if (this.selectedTextBox) {
      this.selectedTextBox = null;
      this.emit('textBoxDeselected');
    }
  }

  setTool(tool) {
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

  setSnapToGrid(enabled) {
    this.snapToGrid = enabled;
  }

  createTextInput(coords) {
    console.log('createTextInput開始:', coords, 'ツール:', this.currentTool);
    // 既存のテキスト入力があれば削除
    this.removeTextInput();
    
    const rect = this.canvas.getBoundingClientRect();
    const container = this.canvas.parentElement;
    console.log('container:', container, 'rect:', rect);
    
    // スタイル設定
    const isVertical = this.currentTool === 'text-vertical';
    
    // テキスト入力要素を作成
    if (isVertical) {
      // 縦書きの場合はdivを使用（iPad対応）
      this.textInput = document.createElement('div');
      this.textInput.contentEditable = true;
      this.textInput.setAttribute('role', 'textbox');
      this.textInput.setAttribute('aria-multiline', 'true');
    } else {
      // 横書きの場合はtextareaを使用
      this.textInput = document.createElement('textarea');
    }
    this.textInput.className = 'text-input-overlay';
    this.textInput.style.position = 'absolute';
    this.textInput.style.cursor = 'text';
    
    // 縦書きの場合は座標を調整
    if (isVertical) {
      // 縦書きテキストは入力エリアを3行分の幅を考慮して左にずらして配置
      this.textInput.style.left = `${coords.x + rect.left - container.offsetLeft - this.fontSize * 3.0}px`;
      this.textInput.style.top = `${coords.y + rect.top - container.offsetTop}px`;
    } else {
      this.textInput.style.left = `${coords.x + rect.left - container.offsetLeft}px`;
      this.textInput.style.top = `${coords.y + rect.top - container.offsetTop}px`;
    }
    
    this.textInput.style.fontSize = `${this.fontSize}px`;
    this.textInput.style.fontFamily = 'Arial, sans-serif';
    this.textInput.style.color = this.strokeColor;
    this.textInput.style.background = 'rgba(255, 255, 255, 0.8)'; // より透明にして背景が見えるように
    this.textInput.style.border = '2px solid #007AFF';
    this.textInput.style.borderRadius = '4px';
    this.textInput.style.padding = '4px';
    this.textInput.style.resize = 'none';
    this.textInput.style.zIndex = '1000';
    
    // 縦書きと横書きでサイズを調整
    if (isVertical) {
      // 縦書きの場合：3行分の幅を確保
      this.textInput.style.minWidth = `${this.fontSize * 3.5}px`;
      this.textInput.style.minHeight = `${this.fontSize * 10}px`;
      this.textInput.style.width = `${this.fontSize * 3.5}px`;
      this.textInput.style.height = `${this.fontSize * 10}px`;
    } else {
      this.textInput.style.minWidth = '50px';
      this.textInput.style.minHeight = '20px';
    }
    
    this.textInput.style.display = 'block';
    this.textInput.style.visibility = 'visible';
    this.textInput.style.opacity = '1';
    
    if (isVertical) {
      // CSSクラスを追加
      this.textInput.classList.add('vertical');
      this.textInput.classList.remove('horizontal');
      
      // iPad/Safari対応のため複数の縦書きプロパティを設定
      this.textInput.style.setProperty('writing-mode', 'vertical-rl', 'important');
      this.textInput.style.setProperty('-webkit-writing-mode', 'vertical-rl', 'important');
      this.textInput.style.setProperty('-ms-writing-mode', 'tb-rl', 'important');
      this.textInput.style.setProperty('text-orientation', 'upright', 'important');
      this.textInput.style.setProperty('-webkit-text-orientation', 'upright', 'important');
      this.textInput.style.setProperty('direction', 'ltr', 'important');
      
      this.textInput.style.minWidth = '20px';
      this.textInput.style.minHeight = '50px';
      
      // iPad専用の追加設定
      this.textInput.setAttribute('dir', 'ltr');
    } else {
      // CSSクラスを追加
      this.textInput.classList.add('horizontal');
      this.textInput.classList.remove('vertical');
      
      // 横書きの場合は縦書きスタイルをリセット
      this.textInput.style.setProperty('writing-mode', 'horizontal-tb', 'important');
      this.textInput.style.setProperty('-webkit-writing-mode', 'horizontal-tb', 'important');
      this.textInput.style.setProperty('-ms-writing-mode', 'lr-tb', 'important');
      this.textInput.style.setProperty('text-orientation', 'mixed', 'important');
      this.textInput.style.setProperty('-webkit-text-orientation', 'mixed', 'important');
      this.textInput.style.setProperty('direction', 'ltr', 'important');
      
      this.textInput.removeAttribute('dir');
    }
    
    this.textInput.placeholder = isVertical ? '縦書きテキスト' : '横書きテキスト';
    
    // イベントリスナー
    this.textInput.addEventListener('blur', () => this.finishTextInput());
    
    this.textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.removeTextInput();
      } else if (e.key === 'Enter') {
        if (isVertical && this.textInput.contentEditable) {
          // 縦書きcontenteditable divの場合
          if (e.ctrlKey) {
            // Ctrl+Enterで入力完了
            e.preventDefault();
            this.finishTextInput();
          } else {
            // 通常のEnterで改行を挿入
            e.preventDefault();
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            const br = document.createElement('br');
            range.deleteContents();
            range.insertNode(br);
            range.setStartAfter(br);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } else if (isVertical) {
          // 縦書きtextareaの場合は通常のEnterで改行を許可
          if (e.ctrlKey) {
            // Ctrl+Enterで入力完了
            e.preventDefault();
            this.finishTextInput();
          }
        } else {
          // 横書きの場合はCtrl+Enterで入力完了
          if (e.ctrlKey) {
            e.preventDefault();
            this.finishTextInput();
          }
        }
      }
    });
    
    container.appendChild(this.textInput);
    console.log('テキスト入力要素をDOMに追加しました:', this.textInput);
    console.log('要素のスタイル:', {
      position: this.textInput.style.position,
      left: this.textInput.style.left,
      top: this.textInput.style.top,
      zIndex: this.textInput.style.zIndex,
      display: this.textInput.style.display,
      visibility: this.textInput.style.visibility
    });
    
    // レンダリング後にフォーカスを設定
    setTimeout(() => {
      this.textInput.focus();
      // カーソルスタイルを確実に設定
      this.textInput.style.cursor = 'text';
      console.log('フォーカスを設定しました。縦書き:', isVertical);
    }, 10);
  }

  finishTextInput() {
    console.log('=== finishTextInput が呼ばれました ===');
    console.log('テキスト入力状態:', {
      textInput: this.textInput,
      parentNode: this.textInput ? this.textInput.parentNode : null,
      allPathsCount: this.allPaths.length
    });
    
    if (!this.textInput || !this.textInput.parentNode) {
      console.log('テキスト入力が存在しないため、処理をスキップします');
      return;
    }
    
    // テキストを取得（divとtextareaの両方に対応）
    let text;
    if (this.textInput.value !== undefined) {
      // textareaの場合
      text = this.textInput.value.trim();
    } else {
      // contenteditable divの場合
      // まずinnerHTMLを取得して<br>タグを改行文字に変換
      let htmlContent = this.textInput.innerHTML;
      // <br>タグを改行文字に変換
      htmlContent = htmlContent.replace(/<br\s*\/?>/gi, '\n');
      // HTMLタグを除去
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      text = (tempDiv.textContent || tempDiv.innerText || '').trim();
    }
    
    // 現在編集中のテキストボックスを探す
    const editingTextBox = this.allPaths.find(path => 
      path.tool === 'textbox' && path.isSelected
    );
    
    if (editingTextBox) {
      // 既存のテキストボックスを更新
      editingTextBox.text = text;
      console.log('=== テキストボックス更新 ===');
      console.log('テキスト:', text);
      console.log('テキストボックス:', editingTextBox);
      
      // 空のテキストの場合は削除
      if (!text) {
        const index = this.allPaths.indexOf(editingTextBox);
        if (index > -1) {
          this.allPaths.splice(index, 1);
          console.log('空のテキストボックスを削除');
        }
        this.selectedTextBox = null;
      } else {
        // テキストボックスのサイズを内容に合わせて調整
        this.adjustTextBoxSize(editingTextBox);
        // 編集完了後は選択解除
        editingTextBox.isSelected = false;
        this.selectedTextBox = null;
      }
      
      this.redrawCanvas();
    }
    
    this.removeTextInput();
  }

  adjustTextBoxSize(textBoxData) {
    // テキストの実際のサイズを測定
    this.ctx.font = `${textBoxData.fontSize}px ${textBoxData.fontFamily}`;
    
    if (textBoxData.isVertical) {
      // 縦書きの場合 - 改行を正しく処理
      const inputLines = textBoxData.text.split('\n');
      let maxLineLength = 0;
      let totalColumns = inputLines.length;
      
      for (let inputLine of inputLines) {
        maxLineLength = Math.max(maxLineLength, inputLine.length);
      }
      
      textBoxData.width = Math.max(totalColumns * textBoxData.fontSize * 1.2, 30);
      textBoxData.height = Math.max(maxLineLength * textBoxData.fontSize * 1.2, 50);
    } else {
      // 横書きの場合 - 改行を正しく処理
      const inputLines = textBoxData.text.split('\n');
      let maxWidth = 0;
      let totalLines = 0;
      
      for (let inputLine of inputLines) {
        if (inputLine === '') {
          totalLines++; // 空行もカウント
          continue;
        }
        
        // 各行の幅を測定し、自動折り返しを考慮
        const lineWidth = this.ctx.measureText(inputLine).width;
        maxWidth = Math.max(maxWidth, lineWidth);
        
        // 自動折り返しによる行数を計算
        const availableWidth = textBoxData.width - 20; // パディング考慮
        if (lineWidth > availableWidth && availableWidth > 0) {
          totalLines += Math.ceil(lineWidth / availableWidth);
        } else {
          totalLines++;
        }
      }
      
      textBoxData.width = Math.max(maxWidth + 20, 50);
      textBoxData.height = Math.max(totalLines * textBoxData.fontSize * 1.4, 30);
    }
  }

  removeTextInput() {
    if (this.textInput) {
      try {
        // 要素が親ノードに存在するかチェック
        if (this.textInput.parentNode) {
          this.textInput.parentNode.removeChild(this.textInput);
        }
      } catch (error) {
        console.log('Text input already removed');
      }
      this.textInput = null;
    }
  }

  // 編集中のテキストボックスを完全に削除（テキスト入力フィールド + 空のテキストボックスデータのみ）
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

  updateCursor() {
    // 以前のツールクラスを削除
    this.canvas.classList.remove('tool-pen', 'tool-line', 'tool-rectangle', 'tool-circle', 'tool-text-horizontal', 'tool-text-vertical', 'tool-select', 'tool-door', 'tool-stairs');
    
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
    
    // 開口部と開口部履歴をクリア
    this.openings = [];
    this.selectedOpening = null;
    this.isDraggingOpening = false;
    this.openingsHistory = [];
    this.openingsRedoStack = [];
    
    // 初期状態として空の開口部履歴を保存
    this.saveOpeningsState();
    
    this.redrawCanvas(); // グリッドを含めて再描画
  }

  eraseAtPoint(coords) {
    const eraserSize = this.eraserSize; // 独立した消しゴムサイズを使用
    const pathsToRemove = [];
    const pathsToModify = [];
    
    // 削除操作前に状態を保存
    let stateNeedsSave = false;
    
    // 開口部の削除をチェック
    const openingsToRemove = [];
    for (let i = 0; i < this.openings.length; i++) {
      const opening = this.openings[i];
      if (coords.x >= opening.x && coords.x <= opening.x + opening.width &&
          coords.y >= opening.y && coords.y <= opening.y + opening.height) {
        openingsToRemove.push(i);
        stateNeedsSave = true;
      }
    }
    
    // 開口部削除前に状態保存
    if (stateNeedsSave) {
      this.saveOpeningsState();
    }
    
    // 開口部を削除（逆順で削除してインデックスずれを防ぐ）
    for (let i = openingsToRemove.length - 1; i >= 0; i--) {
      this.openings.splice(openingsToRemove[i], 1);
    }
    
    // 選択中の開口部が削除された場合は選択解除
    if (this.selectedOpening && openingsToRemove.length > 0) {
      this.selectedOpening = null;
    }
    
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
      } else if (pathData.tool === 'textbox') {
        // テキストボックスの場合 - 全体を削除
        if (this.isPointInTextBox(coords, pathData)) {
          pathsToRemove.push(i);
        }
      } else if (pathData.tool === 'line') {
        // 矢印の場合は特別な処理を行う
        if (pathData.lineStyle === 'arrow') {
          // 矢印の先端部分に消しゴムが触れているかチェック
          const arrowHeadRegion = this.getArrowHeadRegion(pathData.startPoint, pathData.endPoint);
          const isErasingArrowHead = this.isPointInArrowHead(coords, arrowHeadRegion, eraserSize);
          
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
              if (!this.isSegmentInArrowHead(segment, arrowHeadRegion) &&
                  this.isPointNearLineSegment(coords, segment.start, segment.end, eraserSize)) {
                segmentsToRemove.push(j);
              }
            }
            
            if (segmentsToRemove.length > 0) {
              console.log('矢印の線部分のみを部分削除します');
              // セグメントを削除して新しい線分を作成
              const newLines = this.removeLineSegmentsHalfGrid(pathData, segmentsToRemove);
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
            if (this.isPointNearLineSegment(coords, segment.start, segment.end, eraserSize)) {
              segmentsToRemove.push(j);
            }
          }
          
          if (segmentsToRemove.length > 0) {
            console.log('点線の部分削除を実行します');
            // セグメントを削除して新しい点線を作成
            const newLines = this.removeLineSegmentsHalfGrid(pathData, segmentsToRemove);
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
          if (this.isPointNearLineSegment(coords, segment.start, segment.end, eraserSize)) {
            segmentsToRemove.push(j);
          }
        }
        
        if (segmentsToRemove.length > 0) {
          // セグメントを削除して新しい線分を作成
          const newLines = this.removeLineSegmentsHalfGrid(pathData, segmentsToRemove);
          pathsToModify.push({ index: i, newPaths: newLines });
        }
      } else if (pathData.tool === 'rectangle') {
        // 四角形の場合 - 半マス単位で辺ごとに部分削除
        const rectangleSegments = this.getRectangleSegmentsHalfGrid(pathData);
        const segmentsToRemove = [];
        
        for (let j = 0; j < rectangleSegments.length; j++) {
          const segment = rectangleSegments[j];
          if (this.isPointNearLineSegment(coords, segment.start, segment.end, eraserSize)) {
            segmentsToRemove.push(j);
          }
        }
        
        if (segmentsToRemove.length > 0) {
          // 残った辺で新しい線分を作成
          const newLines = this.removeRectangleSegmentsHalfGrid(pathData, segmentsToRemove);
          pathsToModify.push({ index: i, newPaths: newLines });
        }
      } else if (pathData.tool === 'stairs') {
        // 階段の場合 - 階段記号全体を削除
        if (this.isPointNearShape(coords, pathData, eraserSize)) {
          console.log('階段を削除します:', { coords, startPoint: pathData.startPoint, endPoint: pathData.endPoint, stairWidth: pathData.stairWidth });
          pathsToRemove.push(i);
        } else {
          console.log('階段判定: ヒットせず', { coords, distance: this.distanceToLine(coords, pathData.startPoint, pathData.endPoint), eraserSize });
        }
      } else if (pathData.tool === 'door') {
        // 扉の場合 - 扉全体を削除
        if (this.isPointNearShape(coords, pathData, eraserSize)) {
          console.log('扉を削除します');
          pathsToRemove.push(i);
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
    
    // パスを削除
    for (const index of uniqueIndices) {
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
      this.redrawCanvas();
    }
  }

  updateEraserPreview(event) {
    // デバウンシング処理で不要な再描画を防止
    if (this.eraserPreviewTimeout) {
      clearTimeout(this.eraserPreviewTimeout);
    }
    
    const coords = this.getCoordinates(event);
    this.eraserPreviewCoords = coords;
    this.showEraserPreview = true;
    
    this.eraserPreviewTimeout = setTimeout(() => {
      this.redrawCanvas();
    }, 16); // 約60FPSに制限
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
          if (this.isPointNearLineSegment(coords, segment.start, segment.end, eraserSize)) {
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
        return this.distanceToLine(coords, startPoint, endPoint) <= tolerance;
      case 'rectangle':
        return this.isPointNearRectangle(coords, startPoint, endPoint, tolerance);
      case 'circle':
        return this.isPointNearCircle(coords, startPoint, endPoint, tolerance);
      case 'stairs':
        // 階段は中心線（矢印線）と段鼻線（横線）の両方で判定
        return this.isPointNearStairs(coords, startPoint, endPoint, pathData.stairWidth || this.gridSize, tolerance);
      case 'door':
        // 扉は中心線との距離で判定
        return this.distanceToLine(coords, startPoint, endPoint) <= tolerance;
      default:
        return false;
    }
  }

  // 階段との距離判定（矢印線と段鼻線の両方を考慮）
  isPointNearStairs(coords, startPoint, endPoint, stairWidth, tolerance) {
    // 1. 中心線（矢印線）との距離をチェック
    if (this.distanceToLine(coords, startPoint, endPoint) <= tolerance) {
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
      
      if (this.distanceToLine(coords, stepStart, stepEnd) <= tolerance) {
        return true;
      }
    }
    
    return false;
  }

  distanceToLine(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return Math.sqrt(A * A + B * B);
    
    let param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // シンプルで確実な線分近接判定（斜め線の消去量を増加）
  isPointNearLineSegmentImproved(coords, segmentStart, segmentEnd, tolerance) {
    const distance = this.distanceToLine(coords, segmentStart, segmentEnd);
    
    // 線の角度を計算
    const dx = segmentEnd.x - segmentStart.x;
    const dy = segmentEnd.y - segmentStart.y;
    const angle = Math.abs(Math.atan2(dy, dx));
    
    // 角度による判定範囲の調整
    let adjustedTolerance = tolerance;
    
    // 斜め線（0度、90度以外）の場合は消去範囲を拡大
    const angleInDegrees = (angle * 180) / Math.PI;
    const isHorizontalOrVertical = (angleInDegrees < 10) || (angleInDegrees > 80 && angleInDegrees < 100) || (angleInDegrees > 170);
    
    if (!isHorizontalOrVertical) {
      // 斜め線の場合は1.4倍（40%増し）に拡大
      adjustedTolerance *= 1.4;
    }
    
    return distance <= adjustedTolerance;
  }

  isPointNearRectangle(coords, start, end, tolerance) {
    const left = Math.min(start.x, end.x);
    const right = Math.max(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const bottom = Math.max(start.y, end.y);
    
    // 四角形の各辺との距離を計算
    const distances = [
      this.distanceToLine(coords, {x: left, y: top}, {x: right, y: top}), // 上辺
      this.distanceToLine(coords, {x: right, y: top}, {x: right, y: bottom}), // 右辺
      this.distanceToLine(coords, {x: right, y: bottom}, {x: left, y: bottom}), // 下辺
      this.distanceToLine(coords, {x: left, y: bottom}, {x: left, y: top}) // 左辺
    ];
    
    return Math.min(...distances) <= tolerance;
  }

  isPointNearCircle(coords, start, end, tolerance) {
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    const radius = Math.abs(end.x - start.x) / 2;
    
    const distanceToCenter = Math.sqrt(
      Math.pow(coords.x - centerX, 2) + Math.pow(coords.y - centerY, 2)
    );
    
    // 円周との距離
    const distanceToCircle = Math.abs(distanceToCenter - radius);
    return distanceToCircle <= tolerance;
  }

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

  // 線分セグメントとの距離をチェック（改良版）
  isPointNearLineSegment(coords, segmentStart, segmentEnd, tolerance) {
    // 改良版の判定を使用（斜めの線により対応）
    return this.isPointNearLineSegmentImproved(coords, segmentStart, segmentEnd, tolerance);
  }

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
          const newLine = this.createLineFromSegments(currentGroup, pathData);
          if (newLine) {
            newLines.push(newLine);
          }
          currentGroup = [];
        }
      }
    }
    
    // 最後のグループを処理
    if (currentGroup.length > 0) {
      const newLine = this.createLineFromSegments(currentGroup, pathData);
      if (newLine) {
        newLines.push(newLine);
      }
    }
    
    return newLines;
  }

  // セグメントグループから新しい線分を作成
  createLineFromSegments(segments, originalPathData) {
    if (segments.length === 0) return null;
    
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];
    
    return {
      tool: 'line',
      startPoint: firstSegment.start,
      endPoint: lastSegment.end,
      strokeWidth: originalPathData.strokeWidth,
      strokeColor: originalPathData.strokeColor
    };
  }

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
    
    ctx.strokeStyle = '#cccccc'; // 0.5マスの線をより濃いグレーに
    ctx.lineWidth = 0.5 / this.scale;
    ctx.beginPath();
    
    // 垂直線（0.5マス）
    for (let x = halfStartX; x <= halfEndX; x += halfGridSize) {
      ctx.moveTo(x, viewTop);
      ctx.lineTo(x, viewBottom);
    }
    
    // 水平線（0.5マス）
    for (let y = halfStartY; y <= halfEndY; y += halfGridSize) {
      ctx.moveTo(viewLeft, y);
      ctx.lineTo(viewRight, y);
    }
    
    ctx.stroke();
    
    // 1マスのグリッド線（40px間隔）- 濃いグレー
    const startX = Math.floor(viewLeft / this.gridSize) * this.gridSize;
    const startY = Math.floor(viewTop / this.gridSize) * this.gridSize;
    const endX = Math.ceil(viewRight / this.gridSize) * this.gridSize;
    const endY = Math.ceil(viewBottom / this.gridSize) * this.gridSize;
    
    ctx.strokeStyle = '#d0d0d0'; // 濃いグレー
    ctx.lineWidth = 1 / this.scale;
    ctx.beginPath();
    
    // 垂直線（1マス）
    for (let x = startX; x <= endX; x += this.gridSize) {
      ctx.moveTo(x, viewTop);
      ctx.lineTo(x, viewBottom);
    }
    
    // 水平線（1マス）
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

  undo() {
    console.log('Undo実行前の状態:', {
      allPathsLength: this.allPaths.length,
      redoStackLength: this.redoStack.length,
      openingsHistoryLength: this.openingsHistory.length,
      openingsRedoStackLength: this.openingsRedoStack.length,
      actualOpeningsCount: this.openings.length,
      lastOperationType: this.lastOperationType
    });
    
    // 最後の操作タイプに基づいてundoを実行
    // ただし、実際のデータと整合性をチェック
    let undone = false;
    
    if (this.lastOperationType === 'opening' && this.openingsHistory.length > 0 && this.openings.length > 0) {
      console.log('開口部をundo（実際に開口部が存在する場合）');
      // 開口部のundo（実際に開口部が存在する場合のみ）
      const currentOpenings = this.openings.map(opening => ({
        x: opening.x,
        y: opening.y,
        width: opening.width,
        height: opening.height,
        isSelected: opening.isSelected
      }));
      this.openingsRedoStack.push(currentOpenings);
      
      const previousOpenings = this.openingsHistory.pop();
      this.restoreOpeningsState(previousOpenings);
      
      // 次のundo操作のためにlastOperationTypeを更新
      this.lastOperationType = this.openingsHistory.length > 0 ? 'opening' : 
                              this.allPaths.length > 0 ? 'path' : null;
      undone = true;
      
    } else if (this.allPaths.length > 0) {
      console.log('パスをundo（メイン処理またはフォールバック）');
      // パスのundo（lastOperationType='path'またはフォールバック）
      const lastPath = this.allPaths.pop();
      this.redoStack.push(lastPath);
      
      // 次のundo操作のためにlastOperationTypeを更新
      this.lastOperationType = this.allPaths.length > 0 ? 'path' : 
                              this.openings.length > 0 ? 'opening' : null;
      undone = true;
      
    } else if (this.openingsHistory.length > 0) {
      console.log('最終フォールバック: 開口部をundo');
      // 最終フォールバック：開口部履歴のundo
      const currentOpenings = this.openings.map(opening => ({
        x: opening.x,
        y: opening.y,
        width: opening.width,
        height: opening.height,
        isSelected: opening.isSelected
      }));
      this.openingsRedoStack.push(currentOpenings);
      
      const previousOpenings = this.openingsHistory.pop();
      this.restoreOpeningsState(previousOpenings);
      this.lastOperationType = this.openings.length > 0 ? 'opening' : null;
      undone = true;
    } else {
      console.log('undo可能な操作がありません');
    }
    
    if (undone) {
      this.redrawCanvas();
    } else {
      console.log('何もundoしませんでした');
    }
  }

  redo() {
    // redo履歴に基づいて適切なredoを実行
    let redone = false;
    
    if (this.redoStack.length > 0 && this.openingsRedoStack.length > 0) {
      // 両方にredo履歴がある場合、最後にundoされた方を判定
      // 通常は片方だけにredo履歴があるはずだが、念のためパスを優先
      const pathToRestore = this.redoStack.pop();
      this.allPaths.push(pathToRestore);
      this.lastOperationType = 'path';
      redone = true;
      
    } else if (this.redoStack.length > 0) {
      // パスのredo
      const pathToRestore = this.redoStack.pop();
      this.allPaths.push(pathToRestore);
      this.lastOperationType = 'path';
      redone = true;
      
    } else if (this.openingsRedoStack.length > 0) {
      // 開口部のredo
      const currentOpenings = this.openings.map(opening => ({
        x: opening.x,
        y: opening.y,
        width: opening.width,
        height: opening.height,
        isSelected: opening.isSelected
      }));
      this.openingsHistory.push(currentOpenings);
      
      const redoOpenings = this.openingsRedoStack.pop();
      this.restoreOpeningsState(redoOpenings);
      this.lastOperationType = 'opening';
      redone = true;
    }
    
    if (redone) {
      this.redrawCanvas();
    }
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
    const halfGrid = this.gridSize / 2; // 80ピクセル = 0.5マス
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
    let effectiveSegmentLength = halfGrid;
    
    // 45度付近（35-55度）の場合は√2倍にして、グリッド上の0.5マス距離に合わせる
    if (angleInDegrees >= 35 && angleInDegrees <= 55) {
      effectiveSegmentLength = halfGrid * Math.sqrt(2);
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
    const halfGrid = this.gridSize / 2;
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
    
    // 各辺を半マス単位で分割
    edges.forEach(edge => {
      const dx = edge.end.x - edge.start.x;
      const dy = edge.end.y - edge.start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      if (length === 0) return;
      
      const unitX = dx / length;
      const unitY = dy / length;
      
      for (let i = 0; i < length; i += halfGrid) {
        const segStart = {
          x: edge.start.x + unitX * i,
          y: edge.start.y + unitY * i
        };
        const segEnd = {
          x: edge.start.x + unitX * Math.min(i + halfGrid, length),
          y: edge.start.y + unitY * Math.min(i + halfGrid, length)
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

  getDoorTypes() {
    return [
      { value: 'single', label: '片開き戸' },
      { value: 'double', label: '両開き戸' },
      { value: 'opening', label: '開口部' }
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

  // 開口部の状態を保存
  saveOpeningsState() {
    const fullStack = new Error().stack;
    console.log('saveOpeningsState呼び出し:', {
      currentOpeningsCount: this.openings.length,
      historyLength: this.openingsHistory.length,
      fullStackTrace: fullStack
    });
    
    // 現在の開口部配列の深いコピーを作成
    const openingsSnapshot = this.openings.map(opening => ({
      x: opening.x,
      y: opening.y,
      width: opening.width,
      height: opening.height,
      isSelected: opening.isSelected
    }));
    
    this.openingsHistory.push(openingsSnapshot);
    this.openingsRedoStack = []; // 新しい操作でredo履歴をクリア
    // path系のredo履歴もクリア（開口部操作は他の描画とは独立して管理）
    this.redoStack = [];
  }

  // 開口部の状態を復元
  restoreOpeningsState(openingsSnapshot) {
    this.openings = openingsSnapshot.map(opening => ({
      x: opening.x,
      y: opening.y,
      width: opening.width,
      height: opening.height,
      isSelected: opening.isSelected
    }));
    
    // 選択状態も復元
    this.selectedOpening = this.openings.find(opening => opening.isSelected) || null;
  }

  // 矢印の先端部分の範囲を計算
  getArrowHeadRegion(startPoint, endPoint, arrowSize = 10) {
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return null;
    
    // 矢印の先端部分の長さ（線の長さの10%または最小10px）
    const headLength = Math.max(arrowSize, length * 0.1);
    
    // 矢印の先端から後方への距離
    const ratio = headLength / length;
    const headBaseX = endPoint.x - dx * ratio;
    const headBaseY = endPoint.y - dy * ratio;
    
    return {
      tip: { x: endPoint.x, y: endPoint.y },
      base: { x: headBaseX, y: headBaseY },
      length: headLength
    };
  }

  // 点が矢印の先端部分に含まれるかチェック
  isPointInArrowHead(point, arrowHeadRegion, tolerance = 0) {
    if (!arrowHeadRegion) return false;
    
    // 矢印の先端部分の三角形範囲内かチェック
    const distance = this.distanceToLineSegment(point, arrowHeadRegion.base, arrowHeadRegion.tip);
    return distance <= (arrowHeadRegion.length / 2 + tolerance);
  }

  // 線分が矢印の先端部分と重複するかチェック
  isSegmentInArrowHead(segment, arrowHeadRegion) {
    if (!arrowHeadRegion) return false;
    
    // セグメントの両端が矢印の先端範囲内にあるかチェック
    const startInHead = this.isPointInArrowHead(segment.start, arrowHeadRegion, 5);
    const endInHead = this.isPointInArrowHead(segment.end, arrowHeadRegion, 5);
    
    return startInHead || endInHead;
  }

  // 点と線分の距離を計算
  distanceToLineSegment(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // 描画範囲を取得する関数
  getDrawingBounds() {
    if (this.allPaths.length === 0 && this.openings.length === 0) {
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
    
    // 開口部の範囲も計算
    this.openings.forEach(opening => {
      minX = Math.min(minX, opening.x);
      minY = Math.min(minY, opening.y);
      maxX = Math.max(maxX, opening.x + opening.width);
      maxY = Math.max(maxY, opening.y + opening.height);
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

  // 画像エクスポート機能（PDFと完全に同じレイアウト）
  async exportToImage(format = 'png', quality = 0.95) {
    try {
      console.log('🖼️ 画像エクスポート開始（PDF完全準拠）:', format);
      
      // PDFと全く同じ設定値を使用
      const pdfWidth = 210; // A4幅(mm)
      const pdfHeight = 297; // A4高さ(mm)
      const margin = 15; // 余白(mm) - PDFと同じ
      const headerHeight = 20; // ヘッダー高さ(mm) - PDFと同じ
      const footerHeight = 0; // フッター削除 - PDFと同じ
      
      // PDFと同じ利用可能エリア計算
      const availablePDFWidth = pdfWidth - (margin * 2); // 180mm
      const availablePDFHeight = pdfHeight - (margin * 2) - headerHeight; // 252mm
      const optimalRatio = availablePDFWidth / availablePDFHeight; // 約0.714
      
      // PDFと同じキャプチャ範囲計算
      const captureHeightMas = 22; // 縦マス数 - PDFと同じ
      const captureWidthMas = Math.round(captureHeightMas * optimalRatio); // 約16マス - PDFと同じ
      
      const captureWidth = captureWidthMas * this.gridSize;   
      const captureHeight = captureHeightMas * this.gridSize; 
      
      // PDFと同じキャプチャ開始位置
      const startX = -captureWidth / 2;  // PDFと同じ
      const startY = -captureHeight / 2; // PDFと同じ
      
      console.log('キャプチャ範囲（PDF準拠）:', {
        マス数: { width: captureWidthMas, height: captureHeightMas },
        ピクセル: { width: captureWidth, height: captureHeight },
        アスペクト比: (captureWidth / captureHeight).toFixed(3),
        PDF最適比: optimalRatio.toFixed(3)
      });
      
      // 高解像度でA4サイズのCanvasを作成
      const dpi = 300; // 300DPI
      const mmToPx = dpi / 25.4; // 1mm = 約11.81px
      
      const imageWidth = Math.round(pdfWidth * mmToPx);
      const imageHeight = Math.round(pdfHeight * mmToPx);
      const marginPx = Math.round(margin * mmToPx);
      const headerHeightPx = Math.round(headerHeight * mmToPx);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { 
        alpha: false, // PDFと同じ設定
        willReadFrequently: true 
      });
      
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      
      // PDFと同じ背景設定
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, imageWidth, imageHeight);
      
      // PDFと同じヘッダーを描画
      await this.drawImageHeader(ctx, imageWidth, marginPx, headerHeightPx, mmToPx);
      
      // 図面部分の一時キャンバスを作成（PDFと同じロジック）
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d', { 
        alpha: false,
        willReadFrequently: true
      });
      
      // PDFと同じキャンバスサイズ制限
      const maxSize = 4096;
      const safeWidth = Math.min(captureWidth, maxSize);
      const safeHeight = Math.min(captureHeight, maxSize);
      
      tempCanvas.width = safeWidth;
      tempCanvas.height = safeHeight;
      
      // PDFと同じキャンバス初期化
      tempCtx.fillStyle = 'white';
      tempCtx.fillRect(0, 0, safeWidth, safeHeight);
      tempCtx.setTransform(1, 0, 0, 1, 0, 0);
      tempCtx.imageSmoothingEnabled = true;
      tempCtx.imageSmoothingQuality = 'high';
      
      // PDFと同じグリッド描画
      this.drawGridOnContext(tempCtx, safeWidth, safeHeight);
      
      // PDFと同じパス描画
      this.redrawPathsOnContext(tempCtx, startX, startY, safeWidth, safeHeight);
      
      // 一時キャンバスから画像データを取得
      const tempDataURL = tempCanvas.toDataURL('image/png', 0.95);
      
      // PDFと同じスケーリング計算
      const availableWidth = imageWidth - (marginPx * 2);
      const availableHeight = imageHeight - (marginPx * 2) - headerHeightPx - 0; // footerHeight = 0
      
      const scaleX = availableWidth / captureWidth;
      const scaleY = availableHeight / captureHeight;
      const scale = Math.min(scaleX, scaleY); // PDFと同じロジック
      
      const finalWidth = captureWidth * scale;
      const finalHeight = captureHeight * scale;
      
      // PDFと同じ中央配置計算
      const x = marginPx + (availableWidth - finalWidth) / 2;
      const y = marginPx + headerHeightPx + (availableHeight - finalHeight) / 2;
      
      console.log('配置情報（PDF準拠）:', {
        キャプチャサイズ: { width: captureWidth, height: captureHeight },
        利用可能エリア: { width: availableWidth, height: availableHeight },
        スケール: { scaleX, scaleY, 使用: scale },
        最終サイズ: { width: finalWidth, height: finalHeight },
        配置位置: { x, y }
      });
      
      // 一時キャンバスの内容をメインキャンバスに描画（PDFと同じ位置とサイズ）
      const tempImg = new Image();
      await new Promise((resolve, reject) => {
        tempImg.onload = () => {
          ctx.drawImage(tempImg, x, y, finalWidth, finalHeight);
          resolve();
        };
        tempImg.onerror = reject;
        tempImg.src = tempDataURL;
      });
      
      // PDFと同じロゴを描画
      await this.drawImageLogo(ctx, marginPx, headerHeightPx, mmToPx, imageWidth, imageHeight);
      
      // PDFと同じオレンジ色の枠線を描画（ヘッダーごと囲む）
      ctx.strokeStyle = '#e26b0a'; // PDFと同じ色 (RGB: 226, 107, 10)
      ctx.lineWidth = 1 * mmToPx; // PDFと同じ線の太さ (1mm)
      
      // 枠線の範囲（ヘッダーの上から図面の下まで）
      const frameX = marginPx;
      const frameY = marginPx;
      const frameWidth = imageWidth - (marginPx * 2);
      const frameHeight = headerHeightPx + finalHeight;
      
      ctx.strokeRect(frameX, frameY, frameWidth, frameHeight);
      
      console.log('オレンジ色枠線を画像に追加:', {
        color: '#e26b0a',
        lineWidth: 1 * mmToPx,
        frame: { x: frameX, y: frameY, width: frameWidth, height: frameHeight }
      });
      
      // 最終的な画像として出力
      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
      
      // Web Share API対応チェック
      if (navigator.share && navigator.canShare) {
        return await this.shareImageViaAPI(canvas, mimeType, quality);
      } else {
        return this.downloadImage(canvas, mimeType, quality, format);
      }
      
    } catch (error) {
      console.error('画像エクスポートエラー:', error);
      return false;
    }
  }

  // 画像用ヘッダー描画（PDFと完全に同じスタイル）
  async drawImageHeader(ctx, imageWidth, marginPx, headerHeightPx, mmToPx) {
    // ヘッダー背景（青色 - #0066cc）- PDFと同じ色
    ctx.fillStyle = '#0066cc';
    ctx.fillRect(marginPx, marginPx, imageWidth - (marginPx * 2), headerHeightPx);
    
    // 「間取り図」テキストを作成（PDFと同じ方法）
    const titleCanvas = document.createElement('canvas');
    const titleCtx = titleCanvas.getContext('2d');
    
    // PDFと同じテキスト設定
    const fontSize = 18;
    const titleText = '間取り図';
    const pixelRatio = 3; // PDFと同じ高解像度
    
    titleCtx.font = `bold ${fontSize}px "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif`;
    
    // PDFと同じサイズ測定
    const measuredWidth = titleCtx.measureText(titleText).width;
    const textHeight = fontSize;
    
    // PDFと同じキャンバスサイズ設定
    titleCanvas.width = (measuredWidth + 20) * pixelRatio;
    titleCanvas.height = (textHeight + 12) * pixelRatio;
    
    // PDFと同じスケール設定
    titleCtx.scale(pixelRatio, pixelRatio);
    
    // PDFと同じフォント再設定
    titleCtx.font = `bold ${fontSize}px "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif`;
    titleCtx.fillStyle = '#fccc9e'; // PDFと同じ薄いオレンジ色
    titleCtx.textAlign = 'left';
    titleCtx.textBaseline = 'top';
    
    // PDFと同じアンチエイリアス設定
    titleCtx.imageSmoothingEnabled = true;
    titleCtx.imageSmoothingQuality = 'high';
    
    // PDFと同じ背景クリア
    titleCtx.clearRect(0, 0, titleCanvas.width / pixelRatio, titleCanvas.height / pixelRatio);
    
    // PDFと同じテキスト描画
    titleCtx.fillText(titleText, 10, 6);
    
    // 描画完了を待つ（PDFと同じ）
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // PDFと同じ画像変換
    const textImageData = titleCanvas.toDataURL('image/png', 1.0);
    
    // PDFと同じサイズ計算（mm → px変換）
    const textDisplayWidthMm = (measuredWidth + 20) * 0.35;
    const textDisplayHeightMm = (textHeight + 12) * 0.35;
    const textDisplayWidthPx = textDisplayWidthMm * mmToPx;
    const textDisplayHeightPx = textDisplayHeightMm * mmToPx;
    
    // PDFと同じ位置計算
    const textX = marginPx + (2 * mmToPx); // margin + 2mm
    const textY = marginPx + (1 * mmToPx); // margin + 1mm
    
    // 画像を読み込んで描画
    const textImg = new Image();
    await new Promise((resolve) => {
      textImg.onload = () => {
        ctx.drawImage(textImg, textX, textY, textDisplayWidthPx, textDisplayHeightPx);
        resolve();
      };
      textImg.src = textImageData;
    });
    
    // PDFと同じ太い線を描画（#99ccff色、12mm太さ）
    const lineThicknessMm = 12;
    const lineThicknessPx = lineThicknessMm * mmToPx;
    const lineY = marginPx + headerHeightPx;
    
    ctx.strokeStyle = '#99ccff'; // PDFと同じ色 (RGB: 153, 204, 255)
    ctx.lineWidth = lineThicknessPx;
    ctx.beginPath();
    ctx.moveTo(marginPx, lineY);
    ctx.lineTo(imageWidth - marginPx, lineY);
    ctx.stroke();
    
    console.log('PDFヘッダー完全再現完了:', {
      titleSize: { width: textDisplayWidthPx, height: textDisplayHeightPx },
      titlePosition: { x: textX, y: textY },
      lineThickness: lineThicknessPx,
      linePosition: lineY
    });
  }

  // 画像にロゴを描画（PDFと同じ）
  async drawImageLogo(ctx, marginPx, headerHeightPx, mmToPx, imageWidth, imageHeight) {
    try {
      // ロゴ画像を読み込み
      const logoImg = new Image();
      await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
        logoImg.src = '/logo.png';
      });
      
      // PDFと同じロゴサイズ計算（15mm高さ）
      const logoHeightMm = 15;
      const logoHeight = logoHeightMm * mmToPx;
      const aspectRatio = logoImg.width / logoImg.height;
      const logoWidth = logoHeight * aspectRatio;
      
      // 最適化されたロゴ位置計算（一番右下に綺麗に配置）
      const a4WidthMm = 210;
      const a4HeightMm = 297;
      const marginMm = 10;
      
      // ロゴを一番右下に配置（マージンから5mm内側）
      const logoMarginMm = 5; // ロゴ周りの余白
      const logoXMm = a4WidthMm - marginMm - logoHeightMm * aspectRatio - logoMarginMm;
      const logoYMm = a4HeightMm - marginMm - logoHeightMm - logoMarginMm;
      
      // mm → px 変換
      const logoX = logoXMm * mmToPx;
      const logoY = logoYMm * mmToPx;
      
      // キャンバスにロゴを描画
      ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
      
      console.log('ロゴ画像を画像に追加しました（右下端配置）:', {
        logoSize: { width: logoWidth, height: logoHeight },
        logoPosition: { x: logoX, y: logoY },
        配置詳細: {
          a4WidthMm,
          a4HeightMm,
          marginMm,
          logoMarginMm,
          logoWidthMm: logoHeightMm * aspectRatio,
          logoHeightMm,
          mmToPx,
          計算式: {
            logoXMm: `${a4WidthMm} - ${marginMm} - ${logoHeightMm * aspectRatio} - ${logoMarginMm} = ${logoXMm}`,
            logoYMm: `${a4HeightMm} - ${marginMm} - ${logoHeightMm} - ${logoMarginMm} = ${logoYMm}`,
            logoX: `${logoXMm} * ${mmToPx} = ${logoX}`,
            logoY: `${logoYMm} * ${mmToPx} = ${logoY}`
          }
        }
      });
      
    } catch (error) {
      console.warn('ロゴ画像の読み込みに失敗:', error.message);
      // エラーが発生しても画像エクスポートは続行
    }
  }

  // Web Share API経由での画像共有（iPadネイティブ共有シート）
  async shareImageViaAPI(canvas, mimeType, quality) {
    try {
      console.log('🔄 Web Share API試行開始');
      
      return new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            console.error('画像データの生成に失敗');
            resolve(this.downloadImage(canvas, mimeType, quality, mimeType.split('/')[1]));
            return;
          }
          
          console.log('📱 ブラウザ情報:', {
            userAgent: navigator.userAgent,
            hasShare: !!navigator.share,
            hasCanShare: !!navigator.canShare
          });
          
          // iPadでの共有を最優先で試行
          if (navigator.share && (/iPad/i.test(navigator.userAgent) || /iPhone/i.test(navigator.userAgent))) {
            try {
              const file = new File([blob], `floor-plan-${Date.now()}.${mimeType.split('/')[1]}`, {
                type: mimeType,
                lastModified: Date.now()
              });
              
              const shareData = {
                files: [file],
                title: '間取り図',
                text: '作成した間取り図です'
              };
              
              console.log('📤 ネイティブ共有を試行:', shareData);
              
              // canShareチェックを緩和
              if (!navigator.canShare || navigator.canShare(shareData)) {
                await navigator.share(shareData);
                console.log('✅ ネイティブ共有成功！');
                resolve(true);
                return;
              } else {
                console.warn('⚠️ canShare()がfalseを返しました');
              }
              
            } catch (shareError) {
              console.warn('❌ ネイティブ共有エラー:', {
                name: shareError.name,
                message: shareError.message
              });
              
              if (shareError.name === 'AbortError') {
                console.log('ℹ️ ユーザーが共有をキャンセル');
                resolve(false);
                return;
              }
            }
          }
          
          // フォールバック: カスタム画像表示
          console.log('🔄 フォールバック実行');
          resolve(this.downloadImage(canvas, mimeType, quality, mimeType.split('/')[1]));
          
        }, mimeType, quality);
      });
    } catch (error) {
      console.error('❌ Web Share API全体エラー:', error);
      return this.downloadImage(canvas, mimeType, quality, mimeType.split('/')[1]);
    }
  }

  // フォールバック: 通常のダウンロード
  downloadImage(canvas, mimeType, quality, format) {
    try {
      const dataURL = canvas.toDataURL(mimeType, quality);
      
      // iPadでの専用処理
      if (/iPad|iPhone|iPod/i.test(navigator.userAgent)) {
        // iPadの場合：長押しで保存できる画像表示
        this.showImageForSaving(dataURL);
        return true;
      } else if ('ontouchstart' in window) {
        // その他のモバイル：ダウンロード属性付きリンク
        this.triggerMobileDownload(dataURL, format);
        return true;
      } else {
        // デスクトップ環境：従来のダウンロード方式  
        const link = document.createElement('a');
        link.download = `floor-plan-${new Date().toISOString().slice(0,10)}.${format}`;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('✅ 画像ダウンロード完了（デスクトップ）');
        return true;
      }
      
    } catch (error) {
      console.error('画像ダウンロードエラー:', error);
      return false;
    }
  }

  // iPad用：長押しで保存できる画像を表示
  showImageForSaving(dataURL) {
    // オーバーレイを作成
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.9);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 20px;
      box-sizing: border-box;
    `;
    
    // 説明テキスト
    const instruction = document.createElement('div');
    instruction.style.cssText = `
      color: white;
      font-size: 18px;
      text-align: center;
      margin-bottom: 20px;
      line-height: 1.5;
    `;
    instruction.textContent = '画像を長押しして「画像を保存」を選択してください';
    
    // 画像要素
    const img = document.createElement('img');
    img.src = dataURL;
    img.style.cssText = `
      max-width: 90%;
      max-height: 70%;
      border: 2px solid white;
      border-radius: 8px;
    `;
    
    // 閉じるボタン
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      background: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      font-size: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    closeBtn.onclick = () => {
      document.body.removeChild(overlay);
    };
    
    // 背景クリックで閉じる
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    };
    
    overlay.appendChild(instruction);
    overlay.appendChild(img);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
    
    console.log('✅ iPad用画像表示完了（長押しで保存）');
  }

  // モバイル用ダウンロード
  triggerMobileDownload(dataURL, format) {
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `floor-plan-${new Date().toISOString().slice(0,10)}.${format}`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    
    // タッチイベントを模擬
    const event = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true
    });
    
    link.dispatchEvent(event);
    document.body.removeChild(link);
    
    console.log('✅ モバイル用ダウンロード実行');
  }

  // PDF出力（既存の関数名を明確化）機能
  async exportToPDF() {
    try {
      console.log('PDF出力開始 - デバイス情報:', {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      });

      // jsPDFライブラリをタブレット対応で読み込み
      let jsPDF;
      try {
        // 動的インポートを試行
        const jsPDFModule = await import('jspdf');
        jsPDF = jsPDFModule.jsPDF;
        console.log('jsPDF動的インポート成功');
      } catch (importError) {
        console.warn('jsPDF動的インポート失敗、グローバル参照を試行:', importError);
        // フォールバック: グローバルオブジェクトから取得
        if (window.jspdf && window.jspdf.jsPDF) {
          jsPDF = window.jspdf.jsPDF;
          console.log('jsPDFグローバル参照成功');
        } else if (window.jsPDF) {
          jsPDF = window.jsPDF;
          console.log('jsPDF直接参照成功');
        } else {
          throw new Error('jsPDFライブラリが見つかりません');
        }
      }

      // PDF設定（A4サイズ、縦向き）
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      console.log('PDF作成成功');
      
      // A4縦向きサイズ（210mm × 297mm）
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 15; // 余白
      const headerHeight = 20; // ヘッダー高さ
      const footerHeight = 0; // フッター削除
      
      // 背景を白に設定
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
      
      // ヘッダーを追加
      await this.addPDFHeader(pdf, pdfWidth, margin, headerHeight);
      
      // 指定範囲を最適化されたマス数でキャプチャ（グリッド線も含む）
      // A4の利用可能エリア比率に合わせて最適化
      const availablePDFWidth = pdfWidth - (margin * 2); // 180mm
      const availablePDFHeight = pdfHeight - (margin * 2) - headerHeight; // 252mm
      const optimalRatio = availablePDFWidth / availablePDFHeight; // 約0.714
      
      // 最適なマス数を計算（基準を22マスに設定）
      const captureHeightMas = 22; // 縦マス数
      const captureWidthMas = Math.round(captureHeightMas * optimalRatio); // 約16マス
      
      const captureWidth = captureWidthMas * this.gridSize;   
      const captureHeight = captureHeightMas * this.gridSize; 
      
      console.log('PDF キャプチャ範囲（最適化）:', {
        マス数: { width: captureWidthMas, height: captureHeightMas },
        ピクセル: { width: captureWidth, height: captureHeight },
        アスペクト比: (captureWidth / captureHeight).toFixed(3),
        PDF最適比: optimalRatio.toFixed(3)
      });
      
      // キャプチャ範囲の開始位置（描画データが含まれるように調整）
      // 座標(160,0) → (320,0)の線を含めるため、負の座標から開始
      const startX = -captureWidth / 2;  // 中央を基準にして左半分も含める
      const startY = -captureHeight / 2; // 中央を基準にして上半分も含める
      
      // 指定範囲をキャプチャするための一時キャンバスを作成（改善版）
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d', { 
        alpha: false, // アルファチャンネルを無効にして安定性向上
        willReadFrequently: true // 頻繁な読み取りを最適化
      });
      
      // キャンバスサイズを安全な範囲に制限
      const maxSize = 4096; // 最大サイズを4096pxに制限
      const safeWidth = Math.min(captureWidth, maxSize);
      const safeHeight = Math.min(captureHeight, maxSize);
      
      tempCanvas.width = safeWidth;
      tempCanvas.height = safeHeight;
      
      console.log('一時キャンバス作成:', {
        requestedSize: { width: captureWidth, height: captureHeight },
        actualSize: { width: safeWidth, height: safeHeight },
        context: tempCtx ? 'OK' : 'ERROR',
        contextAttributes: tempCtx.getContextAttributes()
      });
      
      // キャンバスの初期化を確実に行う
      try {
        // 背景を白で塗りつぶし
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, safeWidth, safeHeight);
        
        // 元の座標系（1:1スケール、平行移動なし）に設定
        tempCtx.setTransform(1, 0, 0, 1, 0, 0);
        
        // 描画設定を安定化
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = 'high';
        
      } catch (canvasError) {
        console.error('キャンバス初期化エラー:', canvasError);
        throw new Error('キャンバスの初期化に失敗しました');
      }
      
      // グリッド線を描画（安全なサイズで）
      try {
        this.drawGridOnContext(tempCtx, safeWidth, safeHeight);
        console.log('グリッド描画完了');
      } catch (gridError) {
        console.warn('グリッド描画エラー:', gridError);
        // グリッド描画失敗は続行可能
      }
      
      // すべての描画パスを元の座標系で再描画
      // キャンバス座標系（中央オフセット込み）からPDF座標系（左上基準）に変換
      try {
        this.redrawPathsOnContext(tempCtx, startX, startY, safeWidth, safeHeight);
        console.log('パス描画完了');
      } catch (pathError) {
        console.warn('パス描画エラー:', pathError);
        // パス描画失敗も続行可能（背景とグリッドは残る）
      }
      
      console.log('PDF用描画データ:', {
        pathCount: this.allPaths.length,
        captureArea: { startX, startY, width: captureWidth, height: captureHeight },
        canvasInfo: {
          canvasWidth: this.canvas.width,
          canvasHeight: this.canvas.height,
          translateX: this.translateX,
          translateY: this.translateY,
          scale: this.scale
        },
        samplePaths: this.allPaths.slice(0, 3).map(p => ({
          type: p.type,
          tool: p.tool,
          start: p.startPoint,
          end: p.endPoint
        }))
      });
      
      // 一時キャンバスからDataURLを取得（エラーハンドリング強化）
      let dataURL;
      try {
        // キャンバスの状態を詳細検証
        if (!tempCanvas) {
          throw new Error('一時キャンバスがnullです');
        }
        if (tempCanvas.width === 0 || tempCanvas.height === 0) {
          throw new Error(`一時キャンバスサイズが無効です: ${tempCanvas.width}x${tempCanvas.height}`);
        }
        if (!tempCtx) {
          throw new Error('一時キャンバスコンテキストが無効です');
        }
        
        // 描画完了を確実に待つ
        await new Promise((resolve, reject) => {
          try {
            // ImageDataの取得テスト（小さな範囲で）
            const testImageData = tempCtx.getImageData(0, 0, Math.min(10, tempCanvas.width), Math.min(10, tempCanvas.height));
            if (!testImageData || !testImageData.data) {
              throw new Error('ImageDataの取得に失敗しました');
            }
            console.log('ImageData取得テスト成功:', testImageData.data.length);
            setTimeout(resolve, 200); // 描画完了を待つ
          } catch (testError) {
            reject(new Error('ImageData取得テストに失敗: ' + testError.message));
          }
        });
        
        // 複数の方法でPNG生成を試行
        const quality = 0.95; // 品質を少し下げて安定性向上
        
        // 方法1: デフォルトのPNG生成
        try {
          dataURL = tempCanvas.toDataURL('image/png', quality);
          if (!dataURL || dataURL.length < 100) {
            throw new Error('PNG生成結果が不正です');
          }
          console.log('PNG生成成功 (方法1)');
        } catch (png1Error) {
          console.warn('PNG生成失敗 (方法1):', png1Error);
          
          // 方法2: WebP形式で試行
          try {
            dataURL = tempCanvas.toDataURL('image/webp', quality);
            if (!dataURL || dataURL.length < 100) {
              throw new Error('WebP生成結果が不正です');
            }
            console.log('WebP生成成功 (方法2)');
          } catch (webpError) {
            console.warn('WebP生成失敗 (方法2):', webpError);
            
            // 方法3: JPEG形式で試行
            try {
              dataURL = tempCanvas.toDataURL('image/jpeg', quality);
              if (!dataURL || dataURL.length < 100) {
                throw new Error('JPEG生成結果が不正です');
              }
              console.log('JPEG生成成功 (方法3)');
            } catch (jpegError) {
              throw new Error(`全ての画像形式で生成失敗: PNG(${png1Error.message}), WebP(${webpError.message}), JPEG(${jpegError.message})`);
            }
          }
        }
        
        // DataURLの最終検証
        if (!dataURL.startsWith('data:image/')) {
          throw new Error('生成されたDataURLが無効です');
        }
        
        console.log('画像生成最終成功:', {
          format: dataURL.substring(5, dataURL.indexOf(';')),
          size: dataURL.length,
          canvasSize: { width: tempCanvas.width, height: tempCanvas.height }
        });
        
      } catch (imageError) {
        console.error('画像生成完全失敗:', imageError);
        throw new Error('画像生成に失敗しました: ' + imageError.message);
      }
      
      // キャプチャした範囲のサイズを使用
      const canvasWidth = captureWidth;
      const canvasHeight = captureHeight;
      
      // コンテンツエリアのサイズ計算
      const availableWidth = pdfWidth - (margin * 2);
      const availableHeight = pdfHeight - (margin * 2) - headerHeight - footerHeight;
      
      // アスペクト比を維持しつつ、利用可能スペースを最大活用
      const scaleX = availableWidth / canvasWidth;
      const scaleY = availableHeight / canvasHeight;
      const scale = Math.min(scaleX, scaleY); // 小さい方のスケールを使用してアスペクト比維持
      
      console.log('PDF スケーリング情報:', {
        キャプチャサイズ: { width: canvasWidth, height: canvasHeight },
        利用可能サイズ: { width: availableWidth, height: availableHeight },
        スケール: { x: scaleX, y: scaleY, 選択: scale },
        最終サイズ: { width: canvasWidth * scale, height: canvasHeight * scale }
      });
      
      const finalWidth = canvasWidth * scale;
      const finalHeight = canvasHeight * scale;
      
      // 中央配置するための座標計算（余白を均等に配分）
      const x = margin + (availableWidth - finalWidth) / 2;
      const y = margin + headerHeight + (availableHeight - finalHeight) / 2;
      
      console.log('PDF配置情報:', {
        キャプチャサイズ: { width: canvasWidth, height: canvasHeight },
        利用可能エリア: { width: availableWidth, height: availableHeight },
        スケール: { scaleX, scaleY, 使用: scale },
        最終サイズ: { width: finalWidth, height: finalHeight },
        配置位置: { x, y },
        余白: { 
          左右: (availableWidth - finalWidth) / 2, 
          上下: (availableHeight - finalHeight) / 2 
        }
      });
      
      // キャンバスの画像をPDFに追加（アスペクト比維持で左上配置）
      // 画像形式を自動判定
      let imageFormat = 'PNG'; // デフォルト
      if (dataURL.startsWith('data:image/jpeg')) {
        imageFormat = 'JPEG';
      } else if (dataURL.startsWith('data:image/webp')) {
        imageFormat = 'WEBP';
      }
      
      console.log('PDF画像追加:', { format: imageFormat, size: { width: finalWidth, height: finalHeight } });
      pdf.addImage(dataURL, imageFormat, x, y, finalWidth, finalHeight);
      
      // ヘッダーごと囲む枠を描画
      pdf.setDrawColor(226, 107, 10); // 枠の色を #e26b0a に変更 (RGB: 226, 107, 10)
      pdf.setLineWidth(1); // 線の太さを細く (1mm)
      // ヘッダーの上から画像の下まで囲む
      const frameX = margin;
      const frameY = margin;
      const frameWidth = pdfWidth - (margin * 2);
      const frameHeight = headerHeight + finalHeight;
      pdf.rect(frameX, frameY, frameWidth, frameHeight);
      
      // フッターを削除
      // this.addPDFFooter(pdf, pdfWidth, pdfHeight, margin, footerHeight);
      
      // logo.pngを右下に配置
      await this.addPDFLogo(pdf, pdfWidth, pdfHeight, margin, headerHeight, finalWidth, finalHeight);
      
      // PDFを保存（タブレット対応）
      const now = new Date();
      const filename = `間取り図_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.pdf`;
      
      try {
        // タブレット/モバイル対応のPDF保存
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
          console.log('モバイル/タブレットデバイス検出');
          // モバイル端末の場合は、Blobとして保存を試行
          const pdfBlob = pdf.output('blob');
          
          // File API対応チェック
          if (window.saveAs) {
            // FileSaver.jsがある場合
            window.saveAs(pdfBlob, filename);
          } else if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([pdfBlob], filename, { type: 'application/pdf' })] })) {
            // Web Share API対応の場合
            const file = new File([pdfBlob], filename, { type: 'application/pdf' });
            await navigator.share({
              title: '間取り図PDF',
              files: [file]
            });
          } else {
            // フォールバック: ダウンロードリンク作成
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        } else {
          // デスクトップの場合は従来通り
          pdf.save(filename);
        }
        
        console.log('PDF出力完了:', filename);
        
        // 成功メッセージ（タブレット用）
        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
          alert('PDFが作成されました。ダウンロードフォルダまたは共有メニューを確認してください。');
        }
        
      } catch (saveError) {
        console.error('PDF保存エラー:', saveError);
        // エラー時のフォールバック
        try {
          pdf.save(filename);
        } catch (fallbackError) {
          throw new Error(`PDF保存に失敗しました: ${saveError.message}`);
        }
      }
      
      return true;
    } catch (error) {
      console.error('PDF出力エラー:', error);
      alert('PDF出力中にエラーが発生しました: ' + error.message);
      return false;
    }
  }

  // PDFヘッダーを追加（青い背景に白文字で「間取り図」）
  async addPDFHeader(pdf, pdfWidth, margin, headerHeight) {
    // ヘッダー背景（青色 - #0066cc）
    pdf.setFillColor(0, 102, 204);
    pdf.rect(margin, margin, pdfWidth - (margin * 2), headerHeight, 'F');
    
    // 「間取り図」テキストを左上に配置（表示改善）
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // テキストサイズを大きくして読みやすく
    const fontSize = 18; // 16 → 18に変更
    const titleText = '間取り図';
    
    // 高解像度キャンバスで美しく描画
    const pixelRatio = 3; // 高解像度対応
    ctx.font = `bold ${fontSize}px "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif`;
    
    // 実際のテキスト幅を測定
    const measuredWidth = ctx.measureText(titleText).width;
    const textHeight = fontSize;
    
    // キャンバスサイズを高解像度で設定
    canvas.width = (measuredWidth + 20) * pixelRatio; // 左右に10pxずつ余白
    canvas.height = (textHeight + 12) * pixelRatio; // 上下に6pxずつ余白
    
    // 高解像度対応でスケール
    ctx.scale(pixelRatio, pixelRatio);
    
    // フォントを再設定
    ctx.font = `bold ${fontSize}px "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif`;
    ctx.fillStyle = '#fccc9e'; // 薄いオレンジ色に変更
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.textRenderingOptimization = 'optimizeQuality';
    
    // アンチエイリアスを有効にして滑らかに
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // 背景をクリア
    ctx.clearRect(0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio);
    
    // 「間取り図」を描画
    ctx.fillText(titleText, 10, 6);
    
    // キャンバスを画像として取得（エラーハンドリング追加）
    let textImageData;
    try {
      // キャンバスの状態を検証
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error('テキストキャンバスが無効です');
      }
      
      // 描画完了を待つ
      await new Promise(resolve => setTimeout(resolve, 50));
      
      textImageData = canvas.toDataURL('image/png', 1.0);
      
      // DataURLの有効性を検証
      if (!textImageData || !textImageData.startsWith('data:image/png;base64,')) {
        throw new Error('テキストPNG生成に失敗しました');
      }
      
    } catch (textPngError) {
      console.error('テキストPNG生成エラー:', textPngError);
      // フォールバック: JPEG形式
      try {
        textImageData = canvas.toDataURL('image/jpeg', 0.95);
      } catch (textJpegError) {
        console.error('テキストJPEG生成も失敗:', textJpegError);
        // テキスト画像の追加をスキップ
        console.warn('テキスト画像の追加をスキップします');
        return; // ヘッダー処理を終了
      }
    }
    
    // PDFにテキスト画像を左上により近く配置
    const textDisplayWidth = (measuredWidth + 20) * 0.35; // mm単位に変換
    const textDisplayHeight = (textHeight + 12) * 0.35; // mm単位に変換
    const imageFormat = textImageData.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    pdf.addImage(textImageData, imageFormat, margin + 2, margin + 1, textDisplayWidth, textDisplayHeight);
    
    // ヘッダー下に非常に太い線を追加（#99ccff色、12mm）
    pdf.setDrawColor(153, 204, 255); // #99ccff (RGB: 153, 204, 255)
    pdf.setLineWidth(12); // 非常に太い線（12mm）
    pdf.line(margin, margin + headerHeight, pdfWidth - margin, margin + headerHeight);
  }

  // PDFフッターを追加
  addPDFFooter(pdf, pdfWidth, pdfHeight, margin, footerHeight) {
    const footerY = pdfHeight - margin - footerHeight;
    
    // フッター背景（薄いグレー）
    pdf.setFillColor(248, 248, 248);
    pdf.rect(margin, footerY, pdfWidth - (margin * 2), footerHeight, 'F');
    
    // フッター枠線
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, footerY, pdfWidth - (margin * 2), footerHeight);
    
    // ページ番号（中央）
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.setFont(undefined, 'normal');
    const pageText = '- 1 -';
    const pageTextWidth = pdf.getTextWidth(pageText);
    pdf.text(pageText, (pdfWidth - pageTextWidth) / 2, footerY + 8);
    
    // アプリケーション名（左側）
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text('平面図描画アプリ', margin + 5, footerY + 8);
    
    // スケール情報（右側）
    pdf.setFontSize(8);
    const scaleText = 'スケール: 自動調整';
    const scaleTextWidth = pdf.getTextWidth(scaleText);
    pdf.text(scaleText, pdfWidth - margin - scaleTextWidth - 5, footerY + 8);
  }

  // PDFにロゴを追加（logo.pngを右下に配置）
  async addPDFLogo(pdf, pdfWidth, pdfHeight, margin, headerHeight, contentWidth, contentHeight) {
    try {
      // logo.png画像を読み込み
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      
      // 画像読み込みのPromise
      const loadImage = () => {
        return new Promise((resolve, reject) => {
          logoImg.onload = () => resolve(logoImg);
          logoImg.onerror = () => reject(new Error('ロゴ画像の読み込みに失敗しました'));
          
          // パブリックフォルダからlogo.pngを読み込み
          logoImg.src = '/logo.png';
          
          // タイムアウト設定（5秒）
          setTimeout(() => {
            reject(new Error('ロゴ画像の読み込みがタイムアウトしました'));
          }, 5000);
        });
      };
      
      try {
        // 画像読み込みを試行
        await loadImage();
        
        // ロゴサイズとポジション（画像版と完全に同じ計算方法）
        const logoHeightMm = 15; // ロゴの高さ (mm)
        const aspectRatio = logoImg.width / logoImg.height;
        const logoWidthMm = logoHeightMm * aspectRatio;
        
        // 画像版と完全に同じ計算方法（一番右下に綺麗に配置）
        const a4WidthMm = 210;
        const a4HeightMm = 297;
        const marginMm = 10;
        
        // ロゴを一番右下に配置（マージンから5mm内側）
        const logoMarginMm = 5; // ロゴ周りの余白
        const logoX = a4WidthMm - marginMm - logoWidthMm - logoMarginMm;
        const logoY = a4HeightMm - marginMm - logoHeightMm - logoMarginMm;
        
        // キャンバスに画像を描画してDataURLに変換
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = logoImg.width;
        tempCanvas.height = logoImg.height;
        tempCtx.drawImage(logoImg, 0, 0);
        const logoDataURL = tempCanvas.toDataURL('image/png');
        
        // PDFにロゴ画像を追加（アスペクト比を維持）
        pdf.addImage(logoDataURL, 'PNG', logoX, logoY, logoWidthMm, logoHeightMm);
        
        console.log('ロゴ画像をPDFに追加しました（右下端配置）:', {
          logoSize: { width: logoWidthMm, height: logoHeightMm },
          logoPosition: { x: logoX, y: logoY },
          配置詳細: {
            a4WidthMm,
            a4HeightMm,
            marginMm,
            logoMarginMm,
            計算式: {
              logoX: `${a4WidthMm} - ${marginMm} - ${logoWidthMm} - ${logoMarginMm} = ${logoX}`,
              logoY: `${a4HeightMm} - ${marginMm} - ${logoHeightMm} - ${logoMarginMm} = ${logoY}`
            }
          }
        });
        
      } catch (imageError) {
        console.warn('ロゴ画像の読み込みに失敗:', imageError.message);
        // フォールバックロゴは表示しない
      }
      
    } catch (error) {
      console.error('ロゴ追加でエラーが発生:', error);
      // エラーが発生してもPDF生成は続行
    }
  }

  // 指定されたコンテキストにグリッド線を描画（PDF用・正方形グリッド確保）
  drawGridOnContext(ctx, width, height) {
    if (!this.snapToGrid) return;
    
    ctx.save();
    
    // PDF用のグリッドサイズを正方形に保つ（確実に160px）
    const pdfGridSize = 160; // 固定値で正方形を保証
    
    console.log('PDF グリッド描画:', {
      canvasSize: { width, height },
      gridSize: pdfGridSize,
      aspectRatio: width / height
    });
    
    // 0.25マスのドット（40px間隔）
    ctx.fillStyle = '#cccccc';
    for (let x = pdfGridSize / 4; x < width; x += pdfGridSize / 4) {
      for (let y = pdfGridSize / 4; y < height; y += pdfGridSize / 4) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // 0.5マスの線（80px間隔）- 正方形グリッドで描画
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([]);
    
    // 垂直線（0.5マス）- 正方形グリッド
    for (let x = pdfGridSize / 2; x < width; x += pdfGridSize / 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // 水平線（0.5マス）- 正方形グリッド
    for (let y = pdfGridSize / 2; y < height; y += pdfGridSize / 2) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // 1マスの線（160px間隔）- 正方形グリッド
    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 1;
    
    // 垂直線（1マス）- 正方形グリッド
    for (let x = pdfGridSize; x < width; x += pdfGridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // 水平線（1マス）- 正方形グリッド
    for (let y = pdfGridSize; y < height; y += pdfGridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // 中心線（正方形グリッドに合わせて配置）
    // 縦中心線：9マス目の中央から0.5マス左に移動（8.5マス目）
    const centerX = Math.floor(width / 2 / pdfGridSize) * pdfGridSize;
    // 横中心線：10.5マス目の中央から0.5マス上に移動（10マス目）
    const centerY = Math.floor(height / 2 / pdfGridSize) * pdfGridSize;
    
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 3;
    
    // 垂直中心線（8.5マス目）
    if (centerX > 0 && centerX < width) {
      ctx.beginPath();
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, height);
      ctx.stroke();
    }
    
    // 水平中心線（10マス目）
    if (centerY > 0 && centerY < height) {
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
    }
    
    ctx.restore();
  }

  // 指定されたコンテキストにすべてのパスを再描画（PDF用）
  redrawPathsOnContext(ctx, offsetX, offsetY, width, height) {
    ctx.save();
    
    // クリッピング領域を設定
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    
    console.log(`PDF描画: ${this.allPaths.length}個のパスを処理中`);
    console.log(`キャプチャ範囲: x=${offsetX}, y=${offsetY}, w=${width}, h=${height}`);
    
    // すべてのパスを描画（範囲チェックは簡略化、クリッピングで処理）
    for (let i = 0; i < this.allPaths.length; i++) {
      const pathData = this.allPaths[i];
      console.log(`=== パス ${i} 詳細情報 ===`);
      console.log('完全なpathData:', JSON.stringify(pathData, null, 2));
      console.log('==================');
      
      this.drawPathOnContext(ctx, pathData, offsetX, offsetY);
    }
    
    // 開口部も描画
    console.log('=== 開口部描画開始 ===');
    console.log('開口部の数:', this.openings.length);
    this.openings.forEach((opening, index) => {
      console.log(`開口部 ${index}:`, opening);
      this.drawOpeningOnPDF(ctx, opening, offsetX, offsetY);
    });
    console.log('=== 開口部描画完了 ===');
    
    ctx.restore();
  }

  // パスが指定範囲内にあるかチェック
  isPathInRange(pathData, offsetX, offsetY, width, height) {
    if (!pathData) return false;
    
    const rangeRight = offsetX + width;
    const rangeBottom = offsetY + height;
    
    if (pathData.type === 'freehand' && pathData.points) {
      // フリーハンドの場合、いずれかの点が範囲内にあればOK
      return pathData.points.some(point => 
        point.x >= offsetX && point.x <= rangeRight &&
        point.y >= offsetY && point.y <= rangeBottom
      );
    } else if (pathData.startPoint && pathData.endPoint) {
      // 線、四角、円の場合、いずれかの端点が範囲内にあればOK
      return (
        (pathData.startPoint.x >= offsetX && pathData.startPoint.x <= rangeRight &&
         pathData.startPoint.y >= offsetY && pathData.startPoint.y <= rangeBottom) ||
        (pathData.endPoint.x >= offsetX && pathData.endPoint.x <= rangeRight &&
         pathData.endPoint.y >= offsetY && pathData.endPoint.y <= rangeBottom)
      );
    }
    
    return false;
  }

  // 指定されたコンテキストに単一のパスを描画（PDF用）
  drawPathOnContext(ctx, pathData, offsetX, offsetY) {
    ctx.save();
    
    ctx.strokeStyle = pathData.strokeColor || pathData.color || '#000000';
    ctx.lineWidth = pathData.strokeWidth || pathData.lineWidth || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // シンプルに座標をそのまま使用（オフセットのみ適用）
    
    // ツール別の描画処理
    if (pathData.tool === 'pen' && pathData.path) {
      // ペンツール（フリーハンド）
      console.log('ペンツール描画:', pathData.path.length, '点');
      ctx.beginPath();
      if (pathData.path.length > 0) {
        ctx.moveTo(pathData.path[0].x - offsetX, pathData.path[0].y - offsetY);
        for (let i = 1; i < pathData.path.length; i++) {
          ctx.lineTo(pathData.path[i].x - offsetX, pathData.path[i].y - offsetY);
        }
      }
      ctx.stroke();
    } else if (pathData.tool === 'line' && pathData.startPoint && pathData.endPoint) {
      // 直線ツール - 線種対応（実線/点線/矢印）- キャンバス版と完全一致
      const x1 = pathData.startPoint.x - offsetX;
      const y1 = pathData.startPoint.y - offsetY; // 正確な位置に修正
      const x2 = pathData.endPoint.x - offsetX;
      const y2 = pathData.endPoint.y - offsetY;   // 正確な位置に修正
      
      // 線種の判定（キャンバス版と同じロジック）
      const lineStyle = pathData.lineStyle || (pathData.isDashed ? 'dashed' : (pathData.hasArrow ? 'arrow' : 'solid'));
      
      console.log(`直線描画: 線種=${lineStyle}, 元座標(${pathData.startPoint.x}, ${pathData.startPoint.y}) → PDF座標(${x1}, ${y1})`);
      
      // 線種に応じた描画（キャンバス版と完全一致）
      if (lineStyle === 'dashed' || pathData.isDashed) {
        // 点線 - キャンバス版と同じパターン
        ctx.save();
        // キャンバス版と同じ点線パターン: 20px線, 15px空白
        const dashLength = 20;
        const gapLength = 15;
        ctx.setLineDash([dashLength, gapLength]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]); // リセット
        ctx.restore();
        console.log('点線描画完了（キャンバス版準拠）');
        
      } else if (lineStyle === 'arrow' || pathData.hasArrow) {
        // 矢印 - キャンバス版と完全一致
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        
        // 矢印ヘッドを描画（キャンバス版と同じメソッドを使用）
        this.drawArrowHeadOnContext(ctx, x1, y1, x2, y2);
        console.log('矢印描画完了（キャンバス版準拠）');
        
      } else {
        // 実線
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        console.log('実線描画完了');
      }
    } else if (pathData.tool === 'rectangle' && pathData.startPoint && pathData.endPoint) {
      // 四角形ツール
      console.log('四角形描画');
      ctx.beginPath();
      ctx.rect(pathData.startPoint.x - offsetX, pathData.startPoint.y - offsetY, 
               pathData.endPoint.x - pathData.startPoint.x, 
               pathData.endPoint.y - pathData.startPoint.y);
      ctx.stroke();
    } else if (pathData.tool === 'circle' && pathData.startPoint && pathData.endPoint) {
      // 円ツール
      console.log('円描画');
      const centerX = (pathData.startPoint.x + pathData.endPoint.x) / 2 - offsetX;
      const centerY = (pathData.startPoint.y + pathData.endPoint.y) / 2 - offsetY; // 正確な位置に修正
      const radius = Math.sqrt(
        Math.pow(pathData.endPoint.x - pathData.startPoint.x, 2) + 
        Math.pow(pathData.endPoint.y - pathData.startPoint.y, 2)
      ) / 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (pathData.tool === 'door' && pathData.startPoint && pathData.endPoint) {
      // 扉ツール - 専用描画メソッドを使用
      console.log('🚪 扉描画開始:', {
        doorType: pathData.doorType,
        start: pathData.startPoint,
        end: pathData.endPoint,
        調整後start: { x: pathData.startPoint.x - offsetX, y: pathData.startPoint.y - offsetY },
        調整後end: { x: pathData.endPoint.x - offsetX, y: pathData.endPoint.y - offsetY },
        pathDataKeys: Object.keys(pathData),
        fullPathData: pathData
      });
      
      // doorTypeが未定義の場合はデフォルト値を設定
      if (!pathData.doorType) {
        console.warn('⚠️ doorTypeが未定義です。デフォルト値"opening"を使用します');
        pathData.doorType = 'opening';
      }
      
      ctx.save();
      
      // 座標をPDF用に調整
      const adjustedStart = {
        x: pathData.startPoint.x - offsetX,
        y: pathData.startPoint.y - offsetY
      };
      const adjustedEnd = {
        x: pathData.endPoint.x - offsetX,
        y: pathData.endPoint.y - offsetY
      };
      
      // PDF用扉描画
      this.drawDoorOnContext(ctx, adjustedStart, adjustedEnd, pathData);
      ctx.restore();
      console.log('扉描画完了');
      
    } else if (pathData.tool === 'stairs' && pathData.startPoint && pathData.endPoint) {
      // 階段ツール - 専用描画メソッドを使用
      console.log('階段描画');
      ctx.save();
      
      // 座標をPDF用に調整
      const adjustedStart = {
        x: pathData.startPoint.x - offsetX,
        y: pathData.startPoint.y - offsetY
      };
      const adjustedEnd = {
        x: pathData.endPoint.x - offsetX,
        y: pathData.endPoint.y - offsetY
      };
      
      // PDF用階段描画
      this.drawStairsOnContext(ctx, adjustedStart, adjustedEnd, pathData);
      ctx.restore();
    } else if (pathData.tool === 'textbox' && pathData.x && pathData.y) {
      // テキストボックス描画
      console.log('テキストボックス描画:', pathData);
      ctx.save();
      
      // 座標をPDF用に調整
      const adjustedX = pathData.x - offsetX;
      const adjustedY = pathData.y - offsetY;
      
      // PDF用テキストボックス描画
      this.drawTextBoxOnContext(ctx, adjustedX, adjustedY, pathData);
      ctx.restore();
    }
    // 旧形式との互換性のため、type プロパティもチェック
    else if (pathData.type === 'line' && pathData.startPoint && pathData.endPoint) {
      ctx.beginPath();
      ctx.moveTo(pathData.startPoint.x - offsetX, pathData.startPoint.y - offsetY);
      ctx.lineTo(pathData.endPoint.x - offsetX, pathData.endPoint.y - offsetY);
      ctx.stroke();
    } else if (pathData.type === 'rectangle' && pathData.startPoint && pathData.endPoint) {
      ctx.beginPath();
      ctx.rect(pathData.startPoint.x - offsetX, pathData.startPoint.y - offsetY, 
               pathData.endPoint.x - pathData.startPoint.x, 
               pathData.endPoint.y - pathData.startPoint.y);
      ctx.stroke();
    } else if (pathData.type === 'circle' && pathData.startPoint && pathData.endPoint) {
      const centerX = (pathData.startPoint.x + pathData.endPoint.x) / 2 - offsetX;
      const centerY = (pathData.startPoint.y + pathData.endPoint.y) / 2 - offsetY;
      const radius = Math.sqrt(
        Math.pow(pathData.endPoint.x - pathData.startPoint.x, 2) + 
        Math.pow(pathData.endPoint.y - pathData.startPoint.y, 2)
      ) / 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (pathData.type === 'freehand' && pathData.points) {
      ctx.beginPath();
      if (pathData.points.length > 0) {
        ctx.moveTo(pathData.points[0].x - offsetX, pathData.points[0].y - offsetY);
        for (let i = 1; i < pathData.points.length; i++) {
          ctx.lineTo(pathData.points[i].x - offsetX, pathData.points[i].y - offsetY);
        }
      }
      ctx.stroke();
    }
    
    ctx.restore();
  }

  // PDF用扉描画メソッド
  drawDoorOnContext(ctx, start, end, pathData) {
    console.log('🚪 扉描画メソッド呼び出し:', { 
      start, 
      end, 
      doorType: pathData.doorType,
      pathDataKeys: Object.keys(pathData),
      strokeWidth: pathData.strokeWidth,
      strokeColor: pathData.strokeColor
    });
    
    ctx.lineWidth = pathData.strokeWidth || 2;
    ctx.strokeStyle = pathData.strokeColor || '#000000';
    
    const doorType = pathData.doorType || 'opening';
    console.log('🚪 扉タイプ確定:', doorType);
    
    // 元の実装と同じ四方向固定の扉描画
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    console.log('🚪 方向ベクトル:', { dx, dy });
    
    // 固定扉幅（0.5マス = 80px）※gridSize=160pxの0.5倍
    const fixedDoorWidth = 80;
    
    // 四方向のうち最も近い方向を決定
    let doorStart, doorEnd, direction;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // 水平方向（左右）
      if (dx > 0) {
        direction = 'horizontal-right';
        doorStart = { x: start.x, y: start.y };
        doorEnd = { x: start.x + fixedDoorWidth, y: start.y };
      } else {
        direction = 'horizontal-left';
        doorStart = { x: start.x, y: start.y };
        doorEnd = { x: start.x - fixedDoorWidth, y: start.y };
      }
    } else {
      // 垂直方向（上下）- PDF座標系に合わせて修正
      if (dy > 0) {
        // PDFでは下向きが正なので、下向きの扉
        direction = 'vertical-down';
        doorStart = { x: start.x, y: start.y };
        doorEnd = { x: start.x, y: start.y + fixedDoorWidth };
      } else {
        // PDFでは上向きが負なので、上向きの扉
        direction = 'vertical-up';
        doorStart = { x: start.x, y: start.y };
        doorEnd = { x: start.x, y: start.y - fixedDoorWidth };
      }
    }
    
    console.log('決定された方向:', direction);
    console.log('扉の座標:', { doorStart, doorEnd });
    
    // 垂直方向のベクトル
    const perpDx = direction.startsWith('horizontal') ? 0 : 1;
    const perpDy = direction.startsWith('vertical') ? 0 : 1;
    
    // 扉の種類に応じて描画
    console.log('描画処理開始:', doorType);
    switch (doorType) {
      case 'single':
        this.drawSingleDoorOnContext(ctx, doorStart, doorEnd, perpDx, perpDy, fixedDoorWidth, 'right');
        break;
      case 'double':
        this.drawDoubleDoorOnContext(ctx, doorStart, doorEnd, perpDx, perpDy, fixedDoorWidth);
        break;
      case 'opening':
        this.drawOpeningOnContext(ctx, doorStart, doorEnd, perpDx, perpDy, fixedDoorWidth);
        break;
      case 'single-left':
        this.drawSingleDoorOnContext(ctx, doorStart, doorEnd, perpDx, perpDy, fixedDoorWidth, 'left');
        break;
      case 'single-right':
        this.drawSingleDoorOnContext(ctx, doorStart, doorEnd, perpDx, perpDy, fixedDoorWidth, 'right');
        break;
      default:
        console.log('未知の扉タイプ:', doorType);
        // デフォルトで開口部を描画
        this.drawOpeningOnContext(ctx, doorStart, doorEnd, perpDx, perpDy, fixedDoorWidth);
        break;
    }
    console.log('扉描画メソッド完了');
  }

  // PDF用開口部描画
  drawOpeningOnContext(ctx, start, end, perpDx, perpDy, width) {
    console.log('🔓 開口部描画開始:', { start, end, perpDx, perpDy, width });
    
    // 座標を整数化
    const intStart = { x: Math.floor(start.x), y: Math.floor(start.y) };
    const intEnd = { x: Math.floor(end.x), y: Math.floor(end.y) };
    
    // 扉開口部の枠線（背景白塗り + 細い破線）
    ctx.save();
    
    // 1. まず太い白線で壁を上書き（背景）
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(intStart.x, intStart.y);
    ctx.lineTo(intEnd.x, intEnd.y);
    ctx.stroke();
    
    // 2. 細い破線の境界線
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000000';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(intStart.x, intStart.y);
    ctx.lineTo(intEnd.x, intEnd.y);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.restore();
    console.log('🔓 開口部描画完了');
  }

  // PDF用片開き扉描画
  drawSingleDoorOnContext(ctx, start, end, perpDx, perpDy, width, direction) {
    console.log('🚪➡️ 片開き扉描画開始:', { start, end, perpDx, perpDy, width, direction });
    
    // 座標を整数化（キャンバス版と同じ）
    const intStart = { x: Math.floor(start.x), y: Math.floor(start.y) };
    const intEnd = { x: Math.floor(end.x), y: Math.floor(end.y) };
    
    // 扉開口部の枠線（背景白塗り）- キャンバス版と同じ
    ctx.save();
    
    // まず太い白線で壁を上書き（背景）- キャンバス版と同じ
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(intStart.x, intStart.y);
    ctx.lineTo(intEnd.x, intEnd.y);
    ctx.stroke();
    
    // 2回描画（キャンバス版と同じ）
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(intStart.x, intStart.y);
    ctx.lineTo(intEnd.x, intEnd.y);
    ctx.stroke();
    
    ctx.restore();
    
    // ヒンジ位置（右開きが標準）- キャンバス版と同じロジック
    const hingePoint = direction === 'left' ? intEnd : intStart;
    const freePoint = direction === 'left' ? intStart : intEnd;
    
    // 扉の開き弧（90度の四分円）- 扉の幅と同じ半径
    const radius = width; // 扉の幅全体をカバー
    const baseAngle = Math.atan2(intEnd.y - intStart.y, intEnd.x - intStart.x);
    
    // 開き方向の決定 - キャンバス版と完全に同じ
    let openAngle;
    if (direction === 'left') {
      openAngle = baseAngle + Math.PI/2;
    } else {
      openAngle = baseAngle - Math.PI/2;
    }
    
    // 開き弧を描画（細い線）- 端から端まで - キャンバス版と同じ
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.arc(hingePoint.x, hingePoint.y, radius, 
             Math.min(baseAngle, openAngle), 
             Math.max(baseAngle, openAngle));
    ctx.stroke();
    ctx.restore();
    
    // 開いた扉の位置（細い線）- キャンバス版と同じ
    const doorEndX = Math.floor(hingePoint.x + Math.cos(openAngle) * radius);
    const doorEndY = Math.floor(hingePoint.y + Math.sin(openAngle) * radius);
    
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(hingePoint.x, hingePoint.y);
    ctx.lineTo(doorEndX, doorEndY);
    ctx.stroke();
    ctx.restore();
    
    console.log('🚪➡️ 片開き扉描画完了');
  }

  // PDF用両開き扉描画
  drawDoubleDoorOnContext(ctx, start, end, perpDx, perpDy, width) {
    console.log('🚪↔️ 両開き扉描画開始:', { start, end, perpDx, perpDy, width });
    
    // 座標を整数化（キャンバス版と同じ）
    const intStart = { x: Math.floor(start.x), y: Math.floor(start.y) };
    const intEnd = { x: Math.floor(end.x), y: Math.floor(end.y) };
    
    // 扉開口部の枠線（壁と同じ太さの6px、中を白で塗りつぶし）- キャンバス版と同じ
    ctx.save();
    
    // まず太い白線で壁を上書き（背景）- キャンバス版と同じ
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(intStart.x, intStart.y);
    ctx.lineTo(intEnd.x, intEnd.y);
    ctx.stroke();
    
    ctx.restore();
    
    const midX = Math.floor((intStart.x + intEnd.x) / 2);
    const midY = Math.floor((intStart.y + intEnd.y) / 2);
    const halfWidth = width / 2;
    
    // 中央分割マーク（垂直の短い線）- 円弧と同じ細さ - キャンバス版と同じ
    ctx.save();
    ctx.lineWidth = 1; // 円弧と同じ細さ
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    const markSize = 4;
    ctx.moveTo(midX + perpDx * markSize, midY + perpDy * markSize);
    ctx.lineTo(midX - perpDx * markSize, midY - perpDy * markSize);
    ctx.stroke();
    ctx.restore();
    
    const baseAngle = Math.atan2(intEnd.y - intStart.y, intEnd.x - intStart.x);
    const radius = halfWidth; // 半分の幅と同じ半径
    
    // 左側扉の開き弧（90度）- 中央から外側に開く - キャンバス版と同じ
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    const leftOpenAngle = baseAngle - Math.PI/2; // 時計回りに90度
    // 角度の大小を正しく指定 - キャンバス版と同じ
    ctx.arc(intStart.x, intStart.y, radius, 
             Math.min(baseAngle, leftOpenAngle), 
             Math.max(baseAngle, leftOpenAngle));
    ctx.stroke();
    ctx.restore();
    
    // 左側扉の位置（細い線）- 独立したsave/restore - キャンバス版と同じ
    ctx.save();
    ctx.lineWidth = 1; // 細い線
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    const leftDoorX = Math.floor(intStart.x + Math.cos(leftOpenAngle) * radius);
    const leftDoorY = Math.floor(intStart.y + Math.sin(leftOpenAngle) * radius);
    ctx.moveTo(intStart.x, intStart.y);
    ctx.lineTo(leftDoorX, leftDoorY);
    ctx.stroke();
    ctx.restore();
    
    // 右側扉の開き弧（90度）- 中央から外側に開く（左側の鏡像）- キャンバス版と同じ
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    const rightBaseAngle = baseAngle + Math.PI; // 180度回転した基準角度
    const rightOpenAngle = rightBaseAngle + Math.PI/2; // 反時計回りに90度
    // 角度の大小を正しく指定 - キャンバス版と同じ
    ctx.arc(intEnd.x, intEnd.y, radius, 
             Math.min(rightBaseAngle, rightOpenAngle), 
             Math.max(rightBaseAngle, rightOpenAngle));
    ctx.stroke();
    ctx.restore();
    
    // 右側扉の位置（細い線）- 独立したsave/restore - キャンバス版と同じ
    ctx.save();
    ctx.lineWidth = 1; // 細い線
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    const rightDoorX = Math.floor(intEnd.x + Math.cos(rightOpenAngle) * radius);
    const rightDoorY = Math.floor(intEnd.y + Math.sin(rightOpenAngle) * radius);
    ctx.moveTo(intEnd.x, intEnd.y);
    ctx.lineTo(rightDoorX, rightDoorY);
    ctx.stroke();
    ctx.restore();
    
    console.log('🚪↔️ 両開き扉描画完了');
  }

  // PDF用階段描画メソッド
  drawStairsOnContext(ctx, start, end, pathData) {
    ctx.lineWidth = pathData.strokeWidth || 2;
    ctx.strokeStyle = pathData.strokeColor || '#000000';
    
    const stairSteps = pathData.stairSteps || 10;
    const stairWidth = pathData.stairWidth || this.gridSize;
    
    // 階段の方向ベクトル
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return;
    
    // 単位ベクトル
    const unitX = dx / length;
    const unitY = dy / length;
    
    // 垂直ベクトル（段鼻線用）
    const perpX = -unitY;
    const perpY = unitX;
    
    const halfWidth = stairWidth / 2;
    
    // メイン矢印線
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    // 矢印ヘッド
    const arrowLength = 15;
    const arrowAngle = Math.PI / 6;
    
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - arrowLength * Math.cos(Math.atan2(dy, dx) - arrowAngle),
      end.y - arrowLength * Math.sin(Math.atan2(dy, dx) - arrowAngle)
    );
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - arrowLength * Math.cos(Math.atan2(dy, dx) + arrowAngle),
      end.y - arrowLength * Math.sin(Math.atan2(dy, dx) + arrowAngle)
    );
    ctx.stroke();
    
    // 段鼻線（横線）
    const stepInterval = length / (stairSteps + 1);
    
    for (let i = 1; i <= stairSteps; i++) {
      const t = i * stepInterval;
      const stepX = start.x + unitX * t;
      const stepY = start.y + unitY * t;
      
      ctx.beginPath();
      ctx.moveTo(stepX + perpX * halfWidth, stepY + perpY * halfWidth);
      ctx.lineTo(stepX - perpX * halfWidth, stepY - perpY * halfWidth);
      ctx.stroke();
    }
  }

  // PDF用テキストボックス描画メソッド
  drawTextBoxOnContext(ctx, x, y, pathData) {
    console.log('PDF用テキストボックス描画:', { x, y, pathData });
    
    let width = pathData.width || 100;
    let height = pathData.height || 40;
    const text = pathData.text || '';
    const fontSize = pathData.fontSize || 14;
    const fontFamily = pathData.fontFamily || 'Arial, sans-serif';
    const isVertical = pathData.isVertical || false;
    
    // キャンバス版と同じパディング・行間計算
    const padding = Math.max(4, fontSize * 0.2);
    const lineHeight = fontSize * 1.3;
    
    // フォント設定
    ctx.font = `${fontSize}px ${fontFamily}`;
    
    // テキストサイズに合わせてボックスサイズを調整（キャンバス版と同じロジック）
    if (text && text.trim()) {
      if (isVertical) {
        // 縦書き：改行を処理して列ごとに文字を配置
        const inputLines = text.split('\n');
        let maxLineLength = 0;
        let totalColumns = inputLines.length;
        
        for (let inputLine of inputLines) {
          maxLineLength = Math.max(maxLineLength, inputLine.length);
        }
        
        const textHeight = maxLineLength * fontSize + padding * 2;
        const textWidth = totalColumns * fontSize * 1.2 + padding * 2;
        if (height < textHeight) height = textHeight;
        if (width < textWidth) width = textWidth;
      } else {
        // 横書き：改行と自動折り返しを処理（キャンバス版と同じ）
        const inputLines = text.split('\n');
        let allLines = [];
        let maxLineWidth = 0;
        
        for (let inputLine of inputLines) {
          if (inputLine === '') {
            allLines.push('');
            continue;
          }
          
          // 各行について自動折り返しを適用
          const chars = inputLine.split('');
          let line = '';
          for (let char of chars) {
            const testLine = line + char;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > width - padding * 2 && line !== '') {
              allLines.push(line);
              maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
              line = char;
            } else {
              line = testLine;
            }
          }
          if (line) {
            allLines.push(line);
            maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
          }
        }
        
        const textHeight = allLines.length * lineHeight + padding * 2;
        if (height < textHeight) height = textHeight;
        if (width < maxLineWidth + padding * 2) width = maxLineWidth + padding * 2;
      }
    }
    
    // 枠線を描画
    ctx.strokeStyle = pathData.strokeColor || '#CCCCCC';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    
    console.log('PDF用テキストボックス最終サイズ:', { x, y, width, height, 元サイズ: { width: pathData.width, height: pathData.height } });
    
    // テキストを描画
    if (text) {
      ctx.fillStyle = pathData.textColor || pathData.strokeColor || '#000000';
      ctx.font = `${fontSize}px ${fontFamily}`;
      
      if (isVertical) {
        // 縦書きテキスト（キャンバス版と合わせる）
        this.drawVerticalTextPDF(ctx, text, x, y, width, height, fontSize, padding);
      } else {
        // 横書きテキスト（キャンバス版と完全一致させる）
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        // 改行と自動折り返しを処理（キャンバス版と同じロジック）
        const inputLines = text.split('\n');
        let allLines = [];
        
        for (let inputLine of inputLines) {
          if (inputLine === '') {
            // 空行の場合はそのまま追加
            allLines.push('');
            continue;
          }
          
          // 各行について自動折り返しを適用
          const chars = inputLine.split('');
          let line = '';
          for (let char of chars) {
            const testLine = line + char;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > width - padding * 2 && line !== '') {
              allLines.push(line);
              line = char;
            } else {
              line = testLine;
            }
          }
          if (line) {
            allLines.push(line);
          }
        }
        
        console.log('PDF横書きテキスト処理:', {
          元テキスト: text,
          入力行数: inputLines.length,
          処理後行数: allLines.length,
          行内容: allLines
        });
        
        // 各行を描画（上下中央配置）
        const totalTextHeight = allLines.length * lineHeight;
        const startY = y + (height - totalTextHeight) / 2 + fontSize/2;
        
        allLines.forEach((lineText, index) => {
          const textX = x + padding;
          const textY = startY + (index * lineHeight);
          
          console.log(`PDF横書き行${index}: "${lineText}" at (${textX}, ${textY})`);
          
          // テキストボックス内に収まる場合のみ描画
          if (textY - fontSize/2 >= y && textY + fontSize/2 <= y + height) {
            ctx.fillText(lineText, textX, textY);
          } else {
            console.log(`行${index}はボックス外のため描画スキップ`);
          }
        });
      }
    }
  }

  // PDF用縦書きテキスト描画（完全中央配置）
  drawVerticalTextPDF(ctx, text, x, y, width, height, fontSize, padding = 5) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    console.log('PDF縦書きテキスト描画開始（完全中央配置）:', {
      text,
      position: { x, y, width, height },
      fontSize,
      padding
    });
    
    // 縦書き：改行を処理して列ごとに文字を配置
    const inputLines = text.split('\n');
    const totalColumns = inputLines.length;
    const columnSpacing = fontSize * 1.2;
    const totalTextWidth = totalColumns * columnSpacing;
    
    // 最長の列の文字数を取得
    const maxLineLength = Math.max(...inputLines.map(line => line.length));
    const totalTextHeight = maxLineLength * fontSize;
    
    // 完全中央配置のための座標を計算
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const startX = centerX - (totalTextWidth - columnSpacing) / 2;
    const startY = centerY - totalTextHeight / 2;
    
    console.log('PDF縦書き完全中央配置計算:', {
      totalColumns,
      maxLineLength,
      totalTextWidth,
      totalTextHeight,
      centerX,
      centerY,
      startX,
      startY
    });
    
    inputLines.forEach((line, columnIndex) => {
      const chars = line.split('');
      const columnX = startX + (columnIndex * columnSpacing);
      
      console.log(`PDF縦書き列${columnIndex}: "${line}" at columnX=${columnX}`);
      
      chars.forEach((char, charIndex) => {
        const yy = startY + (charIndex * fontSize) + fontSize / 2;
        
        // 境界チェック（少し緩めに）
        if (yy - fontSize/2 >= y && yy + fontSize/2 <= y + height && 
            columnX - fontSize/2 >= x && columnX + fontSize/2 <= x + width) {
          ctx.fillText(char, columnX, yy);
          console.log(`PDF縦書き文字: "${char}" at (${columnX}, ${yy})`);
        } else {
          console.log(`PDF縦書き文字 "${char}" はボックス外のため描画スキップ`);
        }
      });
    });
    
    console.log('PDF縦書きテキスト描画完了');
  }

  // PDF用開口部描画メソッド
  drawOpeningOnPDF(ctx, opening, offsetX, offsetY) {
    console.log('PDF用開口部描画:', { opening, offsetX, offsetY });
    
    // 座標をPDF用に調整
    const adjustedX = opening.x - offsetX;
    const adjustedY = opening.y - offsetY;
    
    ctx.save();
    
    // グレー塗りつぶし
    ctx.fillStyle = 'rgba(240, 240, 240, 0.9)';
    ctx.fillRect(adjustedX, adjustedY, opening.width, opening.height);
    
    // 境界線
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(adjustedX, adjustedY, opening.width, opening.height);
    
    ctx.restore();
    
    console.log('PDF用開口部描画完了');
  }

  // PDF用矢印頭部描画メソッド（キャンバス版と完全一致）
  drawArrowHeadOnContext(ctx, fromX, fromY, toX, toY, arrowSize = 10) {
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
}
