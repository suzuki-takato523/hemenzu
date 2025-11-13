import './style.css'
import { DrawingCanvas } from './drawingCanvas.js'
import { ToolManager } from './toolManager.js'
import { ShapeRecognizer } from './shapeRecognizer.js'
import StartScreen from './startScreen.js'

class FloorPlanApp {
  constructor() {
    this.canvas = null;
    this.toolManager = null;
    this.shapeRecognizer = null;
    this.startScreen = null;
    this.isInitialized = false;
    this.listenersSetup = false; // リスナー重複防止フラグ
    this.eventListenersSetup = false; // ツールボタンイベントリスナー重複防止フラグ
    this.isDarkMode = this.loadDarkModePreference(); // ダークモード状態
    this.initDarkMode();
    this.init();
  }

  init() {
    // スタートスクリーンイベントリスナーの設定（1回のみ）
    if (!this.listenersSetup) {
      this.setupStartScreenListeners();
      this.listenersSetup = true;
    }
    
    // 初期化は新規プロジェクト開始時に実行
    document.addEventListener('DOMContentLoaded', () => {
      // アプリを非表示にしてスタートスクリーンを表示
      const appElement = document.getElementById('app');
      if (appElement) {
        appElement.style.display = 'none';
      }
    });
  }

  setupStartScreenListeners() {
    // 新規プロジェクト開始
    window.addEventListener('startNewProject', () => {
      if (this.isInitialized) {
        // 既に初期化済みの場合は完全リセット
        this.resetCanvasState();
        // ツールもペンにリセット
        if (this.toolManager) {
          this.toolManager.setTool('pen');
          this.canvas.setTool('pen');
          this.updateToolUI('pen');
        }
      } else {
        this.initializeDrawingApp();
      }
    });

    // プロジェクト復元
    window.addEventListener('restoreProject', (e) => {
      if (!this.isInitialized) {
        this.initializeDrawingApp();
      }
      // Canvas初期化完了を待ってからデータ復元
      setTimeout(() => {
        this.restoreProjectData(e.detail);
      }, 0);
    });

    // 背景画像読み込み
    window.addEventListener('loadBackgroundImage', (e) => {
      if (!this.isInitialized) {
        this.initializeDrawingApp();
      }
      // Canvas初期化完了を待ってから背景画像読み込み
      setTimeout(() => {
        this.loadBackgroundImage(e.detail.imageUrl);
      }, 0);
    });
  }

  initializeDrawingApp() {
    if (this.isInitialized) {
      return; // 既に初期化済みの場合は何もしない
    }

    // 既存のキャンバス要素を完全に削除して再作成（イベントハンドラー完全クリア）
    const canvasContainer = document.querySelector('#drawing-canvas').parentElement;
    const oldCanvas = document.querySelector('#drawing-canvas');
    if (oldCanvas) {
      console.error('既存のcanvas要素を削除します');
      oldCanvas.remove();
    }
    
    // 新しいキャンバス要素を作成
    const newCanvas = document.createElement('canvas');
    newCanvas.id = 'drawing-canvas';
    newCanvas.style.cssText = oldCanvas ? oldCanvas.style.cssText : 'cursor: crosshair; touch-action: none;';
    canvasContainer.appendChild(newCanvas);
    console.error('新しいcanvas要素を作成しました');
    
    // キャンバスの初期化
    this.canvas = new DrawingCanvas('#drawing-canvas');
    
    // ダークモードに応じた初期色を設定
    this.canvas.updateStrokeColorForTheme();
    
    // グローバル参照を強制更新（デバッグ用）
    window.drawingCanvas = this.canvas;
    console.error('グローバル参照更新:', { newInstance: this.canvas });
    
    // ツールマネージャーの初期化
    this.toolManager = new ToolManager();
    
    // 図形認識の初期化
    this.shapeRecognizer = new ShapeRecognizer();
    
    // 初期ツールをペンツールに設定
    this.toolManager.setTool('pen');
    this.canvas.setTool('pen');
    
    // 初期UI設定
    this.updateToolUI('pen');
    
    // イベントリスナーの設定（1回のみ）
    this.setupEventListeners();
    
    // キャンバスサイズの設定
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    // 初期化完了フラグを設定
    this.isInitialized = true;
  }

  setupEventListeners() {
    // 既にイベントリスナーが設定済みの場合はスキップ
    if (this.eventListenersSetup) {
      return;
    }
    
    // DOMが完全に読み込まれるまで待つ
    document.addEventListener('DOMContentLoaded', () => {
      this.initializeToolButtons();
    });
    
    // すでにDOMが読み込まれている場合は即座に実行
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      this.initializeToolButtons();
    }
    
    this.eventListenersSetup = true;
  }

  initializeToolButtons() {
    
    // ホームボタンのイベント
    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) {
      homeBtn.addEventListener('click', () => {
        this.showConfirmDialog(
          'ホームに戻る確認',
          '保存せずにホームに戻ると、現在の作業内容は失われます。本当にホームに戻りますか？',
          () => {
            this.resetToHome(); // リロードではなく手動初期化
          },
          () => {
            console.log('ホームへの移動をキャンセルしました');
          }
        );
      });
    }
    
    // ツールボタンのイベント
    const penTool = document.getElementById('pen-tool');
    if (penTool) {
      penTool.addEventListener('click', () => {
        // テキスト編集中の場合は編集中のテキストボックスを削除
        this.handleToolSwitch();
        
        this.toolManager.setTool('pen');
        this.canvas.setTool('pen');
        this.updateToolButtons('pen-tool');
        this.updateToolUI('pen');
      });
    } else {
      console.error('pen-tool button not found');
    }

    const eraserTool = document.getElementById('eraser-tool');
    if (eraserTool) {
      eraserTool.addEventListener('click', () => {
        // テキスト編集中の場合は編集中のテキストボックスを削除
        this.handleToolSwitch();
        
        this.toolManager.setTool('eraser');
        this.canvas.setTool('eraser');
        this.updateToolButtons('eraser-tool');
        this.updateToolUI('eraser');
      });
    } else {
      console.error('eraser-tool button not found');
    }

    const lineTool = document.getElementById('line-tool');
    if (lineTool) {
      lineTool.addEventListener('click', () => {
        // テキスト編集中の場合は編集中のテキストボックスを削除
        this.handleToolSwitch();
        
        this.toolManager.setTool('line');
        this.canvas.setTool('line');
        this.updateToolButtons('line-tool');
        this.updateToolUI('line');
      });
    } else {
      console.error('line-tool button not found');
    }

    const polylineGridTool = document.getElementById('polyline-grid-tool');
    if (polylineGridTool) {
      polylineGridTool.addEventListener('click', () => {
        // テキスト編集中の場合は編集中のテキストボックスを削除
        this.handleToolSwitch();
        
        this.toolManager.setTool('polyline-grid');
        this.canvas.setTool('polyline-grid');
        this.updateToolButtons('polyline-grid-tool');
        this.updateToolUI('polyline-grid');
      });
    } else {
      console.error('polyline-grid-tool button not found');
    }

    const rectTool = document.getElementById('rect-tool');
    if (rectTool) {
      rectTool.addEventListener('click', () => {
        // テキスト編集中の場合は編集中のテキストボックスを削除
        this.handleToolSwitch();
        
        this.toolManager.setTool('rectangle');
        this.canvas.setTool('rectangle');
        this.updateToolButtons('rect-tool');
        this.updateToolUI('rectangle');
      });
    } else {
      console.error('rect-tool button not found');
    }

    const doorTool = document.getElementById('door-tool');
    if (doorTool) {
      doorTool.addEventListener('click', () => {
        // テキスト編集中の場合は編集中のテキストボックスを削除
        this.handleToolSwitch();
        
        this.toolManager.setTool('door');
        this.canvas.setTool('door');
        this.canvas.setDoorType('smallbox'); // デフォルトで開口部を選択
        
        // HTMLの選択肢も同期
        const doorTypeSelect = document.getElementById('door-type');
        if (doorTypeSelect) {
          doorTypeSelect.value = 'smallbox';
        }
        
        this.updateToolButtons('door-tool');
        this.updateToolUI('door');
      });
    } else {
      console.error('door-tool button not found');
    }

    const stairsTool = document.getElementById('stairs-tool');
    if (stairsTool) {
      stairsTool.addEventListener('click', () => {
        // テキスト編集中の場合は編集中のテキストボックスを削除
        this.handleToolSwitch();
        
        this.toolManager.setTool('stairs');
        this.canvas.setTool('stairs');
        this.updateToolButtons('stairs-tool');
        this.updateToolUI('stairs');
        
        // 階段ツール選択時にデフォルトのサイズ（中）を設定
        this.canvas.setStairSize('medium');
      });
    } else {
      console.error('stairs-tool button not found');
    }

    const fillTool = document.getElementById('fill-tool');
    if (fillTool) {
      fillTool.addEventListener('click', () => {
        this.handleToolSwitch();
        this.toolManager.setTool('fill');
        this.canvas.setTool('fill');
        this.updateToolButtons('fill-tool');
        this.updateToolUI('fill');
      });
    } else {
      console.error('fill-tool button not found');
    }

    // circle-tool（円ツール）は廃止

    const textHTool = document.getElementById('text-h-tool');
    if (textHTool) {
      // mousedownイベントでフォーカスが外れることを防ぐ
      textHTool.addEventListener('mousedown', (e) => {
        // 実際にテキスト入力中の場合はデフォルト動作を防ぐ
        const isActuallyEditing = this.canvas.textInput && this.canvas.textInput.parentNode;
        
        if (isActuallyEditing) {
          e.preventDefault(); // フォーカスが外れることを防ぐ
        }
      });
      
      textHTool.addEventListener('click', () => {
        
        this.toolManager.setTool('text-horizontal');
        this.canvas.setTool('text-horizontal');
        this.updateToolButtons('text-h-tool');
        this.updateToolUI('text-horizontal');
        
        // 実際にテキスト入力中の場合のみ新しいボックスを作成しない
        // （選択されているだけで編集中でない場合は新規作成を許可）
        const isActuallyEditing = this.canvas.textInput && this.canvas.textInput.parentNode;
        
        if (isActuallyEditing) {
          // 現在編集中のテキストボックスの向きを確認
          const currentEditingTextBox = this.canvas.allPaths.find(path => 
            path.tool === 'textbox' && path.isSelected
          );
          
          // 縦書きから横書きに切り替える場合は編集を破棄
          if (currentEditingTextBox && currentEditingTextBox.isVertical) {
            this.canvas.removeCurrentTextBox(); // テキストボックスごと削除
            // 編集破棄後に新しい横書きテキストボックスを作成
          } else if (currentEditingTextBox && !currentEditingTextBox.isVertical) {
            // 横書きから横書きへの場合は継続
            return;
          } else {
            return;
          }
        }
        
        // 新しいテキストボックスを作成する場合は既存の選択を解除
        this.canvas.clearTextBoxSelection();
        
        // フォントサイズに合わせたテキストボックスを中央に生成（幅を広げる）
        const canvas = document.getElementById('drawing-canvas');
        const rect = canvas.getBoundingClientRect();
        // フォントサイズに合わせたテキストボックスを中央に生成（幅を広げる）
        const canvasEl = document.getElementById('drawing-canvas');
        const canvasRect = canvasEl.getBoundingClientRect();
        // キャンバス座標系での中央を計算
        const centerX = (canvasRect.width / 2 - this.canvas.translateX) / this.canvas.scale;
        const centerY = (canvasRect.height / 2 - this.canvas.translateY) / this.canvas.scale;
        const fontSize = this.canvas.fontSize;
        const width = fontSize * 12; // 12文字分の幅
        const height = fontSize * 2;
        this.canvas.createTextBoxAuto(centerX, centerY, width, height, false);
      });
    } else {
      console.error('text-h-tool button not found');
    }

    const textVTool = document.getElementById('text-v-tool');
    if (textVTool) {
      // mousedownイベントでフォーカスが外れることを防ぐ
      textVTool.addEventListener('mousedown', (e) => {
        // 実際にテキスト入力中の場合はデフォルト動作を防ぐ
        const isActuallyEditing = this.canvas.textInput && this.canvas.textInput.parentNode;
        
        if (isActuallyEditing) {
          e.preventDefault(); // フォーカスが外れることを防ぐ
        }
      });
      
      textVTool.addEventListener('click', () => {
        this.toolManager.setTool('text-vertical');
        this.canvas.setTool('text-vertical');
        this.updateToolButtons('text-v-tool');
        this.updateToolUI('text-vertical');
        
        // 実際にテキスト入力中の場合のみ新しいボックスを作成しない
        // （選択されているだけで編集中でない場合は新規作成を許可）
        const isActuallyEditing = this.canvas.textInput && this.canvas.textInput.parentNode;
        
        if (isActuallyEditing) {
          // 現在編集中のテキストボックスの向きを確認
          const currentEditingTextBox = this.canvas.allPaths.find(path => 
            path.tool === 'textbox' && path.isSelected
          );
          
          // 横書きから縦書きに切り替える場合は編集を破棄
          if (currentEditingTextBox && !currentEditingTextBox.isVertical) {
            this.canvas.removeCurrentTextBox(); // テキストボックスごと削除
            // 編集破棄後に新しい縦書きテキストボックスを作成
          } else if (currentEditingTextBox && currentEditingTextBox.isVertical) {
            // 縦書きから縦書きへの場合は継続
            return;
          } else {
            return;
          }
        }
        
        // 新しいテキストボックスを作成する場合は既存の選択を解除
        this.canvas.clearTextBoxSelection();
        
        // フォントサイズに合わせたテキストボックスを中央に生成（縦書き）
        const canvasElement = document.getElementById('drawing-canvas');
        const elementRect = canvasElement.getBoundingClientRect();
        // キャンバス座標系での中央を計算
        const centerX = (elementRect.width / 2 - this.canvas.translateX) / this.canvas.scale;
        const centerY = (elementRect.height / 2 - this.canvas.translateY) / this.canvas.scale;
        const fontSize = this.canvas.fontSize;
        const width = fontSize * 2;
        const height = fontSize * 6;
        this.canvas.createTextBoxAuto(centerX, centerY, width, height, true);
      });
    } else {
      console.error('text-v-tool button not found');
    }

    // アクションボタンのイベント
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (this.canvas && typeof this.canvas.clear === 'function') {
          // カスタム確認ダイアログを表示
          this.showConfirmDialog(
            '全消去の確認',
            '描画内容をすべて消去します。この操作は元に戻せません。\n本当に実行しますか？',
            () => {
              this.canvas.clear();
            },
            () => {
              // キャンセル時は何もしない
            }
          );
        }
      });
    } else {
      console.error('clear-btn button not found');
    }

    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        if (this.canvas && typeof this.canvas.undo === 'function') {
          this.canvas.undo();
        }
      });
    } else {
      console.error('undo-btn button not found');
    }

    const redoBtn = document.getElementById('redo-btn');
    if (redoBtn) {
      redoBtn.addEventListener('click', () => {
        if (this.canvas && typeof this.canvas.redo === 'function') {
          this.canvas.redo();
        }
      });
    } else {
      console.error('redo-btn button not found');
    }

    // キーボードショートカット（Ctrl+Z: Undo, Ctrl+Y: Redo）
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        if (this.canvas && typeof this.canvas.undo === 'function') {
          this.canvas.undo();
        }
      } else if (event.ctrlKey && event.key === 'y') {
        event.preventDefault();
        if (this.canvas && typeof this.canvas.redo === 'function') {
          this.canvas.redo();
        }
      }
    });

    // 定型文プルダウン機能
    this.setupPresetTextFeature();

    // 手動最適化ボタンは削除 - 自動最適化で十分

    // 統合エクスポートボタンとメニューの実装
    const exportBtn = document.getElementById('export-btn');
    const exportMenu = document.getElementById('export-menu');
    const exportProjectOption = document.getElementById('export-project-option');
    const exportPdfOption = document.getElementById('export-pdf-option');
    const exportImageOption = document.getElementById('export-image-option');
    const darkModeBtn = document.getElementById('dark-mode-btn');

    console.log('エクスポート要素の確認:', {
      exportBtn: !!exportBtn,
      exportMenu: !!exportMenu,
      exportProjectOption: !!exportProjectOption,
      exportPdfOption: !!exportPdfOption,
      exportImageOption: !!exportImageOption,
      darkModeBtn: !!darkModeBtn
    });

    // ダークモード切り替えボタン
    if (darkModeBtn) {
      console.log('ダークモード機能を初期化します');
      this.updateDarkModeButton(); // 初期状態を設定
      
      darkModeBtn.addEventListener('click', () => {
        console.log('ダークモード切り替えがクリックされました');
        this.toggleDarkMode();
      });
    }

    if (exportBtn && exportMenu && exportProjectOption && exportPdfOption && exportImageOption) {
      console.log('エクスポート機能を初期化します');
      // エクスポートボタンクリックでメニュー表示/非表示切り替え
      exportBtn.addEventListener('click', (e) => {
        console.log('エクスポートボタンがクリックされました');
        e.stopPropagation();
        const isVisible = exportMenu.style.display !== 'none';
        exportMenu.style.display = isVisible ? 'none' : 'block';
        
        // ボタンの見た目も変更
        exportBtn.classList.toggle('active', !isVisible);
      });

      // プロジェクト保存オプション
      exportProjectOption.addEventListener('click', async () => {
        console.log('プロジェクトデータ保存がクリックされました');
        exportMenu.style.display = 'none';
        exportBtn.classList.remove('active');
        
        // テキスト編集中の場合は先に終了
        this.handleToolSwitch();
        
        // プロジェクトデータを保存
        const success = await this.exportProject();
        // フィードバックメッセージは表示しない
      });

      // PDF出力オプション
      exportPdfOption.addEventListener('click', async () => {
        console.log('PDF出力がクリックされました');
        exportMenu.style.display = 'none';
        exportBtn.classList.remove('active');
        
        // テキスト編集中の場合は先に終了
        this.handleToolSwitch();
        
        // PDF出力を実行
        const success = await this.canvas.exportToPDF();
        // フィードバックメッセージは表示しない
      });

      // 画像出力オプション
      exportImageOption.addEventListener('click', async () => {
        console.log('画像出力がクリックされました');
        exportMenu.style.display = 'none';
        exportBtn.classList.remove('active');
        
        // テキスト編集中の場合は先に終了
        this.handleToolSwitch();
        
        // 画像エクスポートを実行
        const success = await this.canvas.exportToImage('png', 0.95);
        // フィードバックメッセージは表示しない
      });

      // メニュー外クリックで閉じる
      document.addEventListener('click', () => {
        exportMenu.style.display = 'none';
        exportBtn.classList.remove('active');
      });

      // メニュー内クリックでは閉じない
      exportMenu.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    } else {
      console.error('エクスポート関連の要素が見つかりません:', {
        exportBtn: !!exportBtn,
        exportMenu: !!exportMenu,
        exportProjectOption: !!exportProjectOption,
        exportPdfOption: !!exportPdfOption,
        exportImageOption: !!exportImageOption
      });
    }

    // オフライン対応機能の初期化
    this.initOfflineSupport();

    // グリッド表示切り替え（現在は無効）
    /*
    const gridToggle = document.getElementById('grid-toggle');
    if (gridToggle) {
      gridToggle.addEventListener('click', () => {
        this.toggleGrid();
      });
    } else {
      console.error('grid-toggle button not found');
    }
    */

    // スタイル変更のイベント
    // ペン太さ調整（ペンツール専用）
    const penWidth = document.getElementById('pen-width');
    const penPreview = document.getElementById('pen-preview');
    const penWidthControl = document.getElementById('pen-width-control');
    
    if (penWidth && penPreview) {
      // 初期プレビュー設定
      this.updatePenPreview(penWidth.value);
      
      penWidth.addEventListener('input', (e) => {
        const width = parseInt(e.target.value);
        this.canvas.setPenWidth(width);
        this.updatePenPreview(width);
      });
    }

    // 消しゴムサイズ調整（消しゴムツール専用）
    const eraserSize = document.getElementById('eraser-size');
    const eraserPreview = document.getElementById('eraser-preview');
    const eraserSizeControl = document.getElementById('eraser-size-control');
    
    if (eraserSize && eraserPreview) {
      // 初期プレビュー設定
      this.updateEraserPreview(eraserSize.value);
      
      eraserSize.addEventListener('input', (e) => {
        const size = parseInt(e.target.value);
        this.canvas.setEraserSize(size);
        this.updateEraserPreview(size);
      });
    }

    // 建具の種類選択（建具ツール専用）
    const doorType = document.getElementById('door-type');
    if (doorType) {
      doorType.addEventListener('change', (e) => {
        this.canvas.setDoorType(e.target.value);
      });
    }

    // 階段サイズ切り替え（階段ツール専用）
    const stairSizeButtons = ['small', 'medium', 'large'];
    stairSizeButtons.forEach(size => {
      const button = document.getElementById(`stair-size-${size}`);
      if (button) {
        button.addEventListener('click', () => {
          // 他のボタンのactiveクラスを削除
          stairSizeButtons.forEach(s => {
            const btn = document.getElementById(`stair-size-${s}`);
            if (btn) btn.classList.remove('active');
          });
          
          // クリックされたボタンをアクティブに
          button.classList.add('active');
          
          // サイズを設定
          this.canvas.setStairSize(size);
          this.updateStairsPreview(size);
        });
      }
    });

    // 階段タイプ切り替え（階段ツール専用）
    const stairTypeButtons = ['straight', 'l-shape'];
    stairTypeButtons.forEach(type => {
      const button = document.getElementById(`stair-type-${type}`);
      if (button) {
        button.addEventListener('click', () => {
          // 他のボタンのactiveクラスを削除
          stairTypeButtons.forEach(t => {
            const btn = document.getElementById(`stair-type-${t}`);
            if (btn) btn.classList.remove('active');
          });
          
          // クリックされたボタンをアクティブに
          button.classList.add('active');
          
          // タイプを設定
          this.canvas.setStairType(type);
        });
      }
    });

    const stairsPreview = document.getElementById('stairs-preview');
    if (stairsPreview) {
      // 初期プレビューを中サイズで設定
      this.canvas.setStairSize('medium'); // キャンバスにも設定
      this.updateStairsPreview('medium');
    }

    // 塗りつぶしサイズ切り替え
    const fillSizeButtons = ['quarter', 'half', 'one'];
    fillSizeButtons.forEach(size => {
      const button = document.getElementById(`fill-size-${size}`);
      if (button) {
        button.addEventListener('click', () => {
          // 他のボタンのactiveクラスを削除
          fillSizeButtons.forEach(s => {
            const btn = document.getElementById(`fill-size-${s}`);
            if (btn) btn.classList.remove('active');
          });
          
          // クリックされたボタンをアクティブに
          button.classList.add('active');
          
          // サイズを設定
          this.canvas.setFillSize(size);
        });
      }
    });

    // 線スタイル切り替え（直線ツール専用）- 3段階切り替え
    const lineStyleToggle = document.getElementById('line-style-toggle');
    if (lineStyleToggle) {
      lineStyleToggle.addEventListener('click', () => {
        // 現在の状態を取得
        let currentStyle = 'solid';
        if (lineStyleToggle.classList.contains('dashed')) {
          currentStyle = 'dashed';
        } else if (lineStyleToggle.classList.contains('arrow')) {
          currentStyle = 'arrow';
        }
        
        // 次の状態を決定（solid → dashed → arrow → solid）
        let nextStyle;
        switch (currentStyle) {
          case 'solid':
            nextStyle = 'dashed';
            break;
          case 'dashed':
            nextStyle = 'arrow';
            break;
          case 'arrow':
            nextStyle = 'solid';
            break;
          default:
            nextStyle = 'solid';
        }
        
        
        this.canvas.setLineStyle(nextStyle);
        
        // UIを更新
        lineStyleToggle.classList.remove('solid', 'dashed', 'arrow');
        switch (nextStyle) {
          case 'dashed':
            lineStyleToggle.classList.add('dashed');
            lineStyleToggle.textContent = '┅';
            lineStyleToggle.title = '点線モード（クリックで矢印に変更）';
            break;
          case 'arrow':
            lineStyleToggle.classList.add('arrow');
            lineStyleToggle.textContent = '→';
            lineStyleToggle.title = '矢印モード（クリックで実線に変更）';
            break;
          default: // solid
            lineStyleToggle.classList.add('solid');
            lineStyleToggle.textContent = '─';
            lineStyleToggle.title = '実線モード（クリックで点線に変更）';
        }
        
        console.log('変更後:', {
          afterClick: lineStyleToggle.classList.toString(),
          canvasLineStyle: this.canvas.lineStyle
        });
      });
    } else {
      console.error('line-style-toggle button not found');
    }

    // カラーセレクターのドロップダウン
    const colorSelectorBtn = document.getElementById('color-selector-btn');
    const colorDropdown = document.getElementById('color-dropdown');
    const currentColorDisplay = document.querySelector('.current-color');
    
    if (colorSelectorBtn && colorDropdown) {
      // ドロップダウンの開閉
      colorSelectorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        colorDropdown.classList.toggle('show');
        colorSelectorBtn.classList.toggle('open');
      });
      
      // 外側クリックで閉じる
      document.addEventListener('click', (e) => {
        if (!colorDropdown.contains(e.target) && e.target !== colorSelectorBtn) {
          colorDropdown.classList.remove('show');
          colorSelectorBtn.classList.remove('open');
        }
      });
    }
    
    // カラーパレットのボタン
    const colorButtons = document.querySelectorAll('.color-btn');
    colorButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const color = e.target.dataset.color;
        if (color) {
          // 色を設定
          this.canvas.setStrokeColor(color);
          
          // カスタムカラーピッカーの値も更新
          const strokeColorInput = document.getElementById('stroke-color');
          if (strokeColorInput) {
            strokeColorInput.value = color;
          }
          
          // 現在の色表示を更新
          if (currentColorDisplay) {
            currentColorDisplay.style.background = color;
          }
          
          // ペンプレビューの色も更新
          const penPreview = document.getElementById('pen-preview');
          if (penPreview) {
            penPreview.style.background = color;
          }
          
          // アクティブ状態を更新
          colorButtons.forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          
          // ドロップダウンを閉じる
          if (colorDropdown) {
            colorDropdown.classList.remove('show');
          }
          if (colorSelectorBtn) {
            colorSelectorBtn.classList.remove('open');
          }
        }
      });
    });
    
    // 初期状態で黒色をアクティブに
    const blackButton = document.querySelector('.color-btn[data-color="#000000"]');
    if (blackButton) {
      blackButton.classList.add('active');
    }

    const strokeColor = document.getElementById('stroke-color');
    if (strokeColor) {
      
      // 複数のイベントタイプでテスト
      strokeColor.addEventListener('input', (e) => {
        // inputイベントでも即座に色を更新
        this.canvas.setStrokeColor(e.target.value);
        
        // 現在の色表示を更新
        const currentColorDisplay = document.querySelector('.current-color');
        if (currentColorDisplay) {
          currentColorDisplay.style.background = e.target.value;
        }
        
        // ペンプレビューの色も更新
        const penPreview = document.getElementById('pen-preview');
        if (penPreview) {
          penPreview.style.background = e.target.value;
        }
        
        // カラーボタンのアクティブ状態を解除（カスタム色の場合）
        const colorButtons = document.querySelectorAll('.color-btn');
        colorButtons.forEach(b => b.classList.remove('active'));
      });
      
      // パターンボタンの処理
      const patternDiagonal = document.getElementById('pattern-diagonal');
      const patternSolid = document.getElementById('pattern-solid');
      
      if (patternDiagonal && patternSolid) {
        patternDiagonal.addEventListener('click', () => {
          this.canvas.setFillPattern('diagonal');
          patternDiagonal.classList.add('active');
          patternSolid.classList.remove('active');
        });
        
        patternSolid.addEventListener('click', () => {
          this.canvas.setFillPattern('solid');
          patternSolid.classList.add('active');
          patternDiagonal.classList.remove('active');
        });
      }
      
      strokeColor.addEventListener('change', (e) => {
        
        // 選択状態のテキストボックスを確認
        const selectedTextBoxes = this.canvas.allPaths.filter(path => 
          path.tool === 'textbox' && path.isSelected
        );
        
        // テキストが入力されているかチェック
        const hasTextContent = selectedTextBoxes.some(textBox => 
          textBox.text && textBox.text.trim() !== ''
        );
        
        // テキストが入力済みの場合は色を変更して編集を継続
        if (hasTextContent) {
          
          // 選択状態のテキストボックスの色を変更
          selectedTextBoxes.forEach(textBox => {
            if (textBox.text && textBox.text.trim() !== '') {
              textBox.strokeColor = e.target.value;
            }
          });
          
          // キャンバスの描画色も更新
          this.canvas.setStrokeColor(e.target.value);
          
          // ペンプレビューの色も更新
          if (penPreview) {
            penPreview.style.background = e.target.value;
          }
          
          // 画面を再描画
          this.canvas.redrawCanvas();
          return;
        }
        
        // 空のテキストボックスまたはテキスト入力中の場合は従来の処理
        const hasTextInput = this.canvas.textInput && this.canvas.textInput.parentNode;
        const hasTextInputInDOM = document.querySelector('.text-input-overlay');
        
        if (hasTextInput || hasTextInputInDOM) {
          this.canvas.finishTextInput();
          // テキスト入力エリアを確実に削除
          this.canvas.removeTextInput();
        }
        // 選択状態もクリア
        this.canvas.clearTextBoxSelection();
        // さらにツール切り替え処理も実行
        this.handleToolSwitch();
        this.canvas.setStrokeColor(e.target.value);
        // ペンプレビューの色も更新
        if (penPreview) {
          penPreview.style.background = e.target.value;
        }
        // 画面を再描画
        this.canvas.redrawCanvas();
      });
      
      strokeColor.addEventListener('click', (e) => {
        
        // 詳細なテキストボックス状態確認
        const selectedTextBoxes = this.canvas.allPaths.filter(path => 
          path.tool === 'textbox' && path.isSelected
        );
        
        // テキスト入力エリアがDOMに存在するかチェック
        const textInputOverlay = document.querySelector('.text-input-overlay');
        console.log('DOM内のテキスト入力エリア:', textInputOverlay);
        
        // テキストが入力されているかチェック
        const hasTextContent = selectedTextBoxes.some(textBox => 
          textBox.text && textBox.text.trim() !== ''
        );
        
        // より包括的な条件でテキストボックスを削除（ただし、テキストが入力済みの場合は削除しない）
        const hasTextInput = this.canvas.textInput && this.canvas.textInput.parentNode;
        const hasTextInputInDOM = document.querySelector('.text-input-overlay');
        const hasSelectedTextBox = selectedTextBoxes.length > 0;
        
        // テキストが入力済みの場合は削除せず、色変更を許可
        if (hasTextContent) {
          // 色変更処理は change イベントで実行されるので、ここでは何もしない
          return;
        }
        
        // 空のテキストボックスまたはテキスト入力中の場合は削除
        if (hasTextInput || hasTextInputInDOM || hasSelectedTextBox) {
          
          // すべてのテキスト関連要素を確実に削除
          if (hasTextInput) {
            this.canvas.finishTextInput();
            this.canvas.removeTextInput();
          }
          
          // DOM内の残存テキスト入力エリアも削除
          if (hasTextInputInDOM) {
            hasTextInputInDOM.remove();
          }
          
          // 選択状態の空のテキストボックスを削除
          if (hasSelectedTextBox) {
            selectedTextBoxes.forEach(textBox => {
              if (!textBox.text || textBox.text.trim() === '') {
                // 空のテキストボックスは削除
                this.canvas.removeCurrentTextBox();
              }
            });
          }
          
          // さらにツール切り替え処理も実行
          this.handleToolSwitch();
          // 画面を再描画
          this.canvas.redrawCanvas();
        }
      });
      
      // ダークモードに応じた初期色を設定
      strokeColor.value = this.canvas.strokeColor;
      
      console.log('stroke-color要素のイベントリスナー設定完了');
    } else {
      console.error('stroke-color input not found');
    }

    const fontSize = document.getElementById('font-size');
    console.log('font-size要素の検索結果:', fontSize);
    if (fontSize) {
      console.log('font-size要素が見つかりました。イベントリスナーを設定中...');
      
      // 複数のイベントタイプでテスト
      fontSize.addEventListener('input', (e) => {
        console.log('❗ フォントサイズ inputイベント発生', e.target.value);
      });
      
      fontSize.addEventListener('change', (e) => {
        console.log('❗ フォントサイズ changeイベント発生', e.target.value);
        console.log('現在のテキスト入力状態:', {
          textInput: this.canvas.textInput,
          parentNode: this.canvas.textInput ? this.canvas.textInput.parentNode : null,
          existsInDOM: this.canvas.textInput ? document.contains(this.canvas.textInput) : false
        });
        
        // 選択状態のテキストボックスを確認
        const selectedTextBoxes = this.canvas.allPaths.filter(path => 
          path.tool === 'textbox' && path.isSelected
        );
        
        // テキストが入力されているかチェック
        const hasTextContent = selectedTextBoxes.some(textBox => 
          textBox.text && textBox.text.trim() !== ''
        );
        
        // テキストが入力済みの場合は文字サイズを変更して編集を継続
        if (hasTextContent) {
          console.log('テキストが入力済みのため、文字サイズを変更して編集を継続します');
          
          // 選択状態のテキストボックスの文字サイズを変更
          selectedTextBoxes.forEach(textBox => {
            if (textBox.text && textBox.text.trim() !== '') {
              textBox.fontSize = parseInt(e.target.value);
              console.log('テキストボックスの文字サイズを変更:', e.target.value);
              
              // 横書きテキストボックスの場合、幅を自動調整して改行を防ぐ
              if (!textBox.isVertical) {
                // 一時的にフォントを設定してテキスト幅を測定
                const originalFont = this.canvas.ctx.font;
                this.canvas.ctx.font = `${textBox.fontSize}px ${textBox.fontFamily || 'Arial'}`;
                
                // 改行で分割されたテキストの最大幅を計算
                const lines = textBox.text.split('\n');
                let maxLineWidth = 0;
                
                for (let line of lines) {
                  if (line.trim() !== '') {
                    const lineWidth = this.canvas.ctx.measureText(line).width;
                    maxLineWidth = Math.max(maxLineWidth, lineWidth);
                  }
                }
                
                // パディングを追加
                const padding = Math.max(4, textBox.fontSize * 0.2);
                const requiredWidth = maxLineWidth + padding * 2;
                
                // 現在の幅より必要な幅が大きい場合は幅を拡張
                if (requiredWidth > textBox.width) {
                  textBox.width = requiredWidth;
                  console.log('テキストボックスの幅を自動調整:', {
                    oldWidth: textBox.width,
                    newWidth: requiredWidth,
                    maxLineWidth: maxLineWidth,
                    fontSize: textBox.fontSize
                  });
                }
                
                // フォントを元に戻す
                this.canvas.ctx.font = originalFont;
              }
            }
          });
          
          // キャンバスの文字サイズも更新
          this.canvas.setFontSize(parseInt(e.target.value));
          
          // 画面を再描画
          this.canvas.redrawCanvas();
          return;
        }
        
        // 空のテキストボックスまたはテキスト入力中の場合は従来の処理
        const hasTextInput = this.canvas.textInput && this.canvas.textInput.parentNode;
        const hasTextInputInDOM = document.querySelector('.text-input-overlay');
        
        if (hasTextInput || hasTextInputInDOM) {
          console.log('文字サイズ変更: 空のテキスト入力を終了します');
          this.canvas.finishTextInput();
          // テキスト入力エリアを確実に削除
          this.canvas.removeTextInput();
        }
        // 選択状態もクリア
        this.canvas.clearTextBoxSelection();
        // さらにツール切り替え処理も実行
        this.handleToolSwitch();
        this.canvas.setFontSize(parseInt(e.target.value));
        // 画面を再描画
        this.canvas.redrawCanvas();
      });
      
      fontSize.addEventListener('click', (e) => {
        console.log('❗ フォントサイズ clickイベント発生');
        console.log('クリック時のテキスト入力状態:', {
          textInput: this.canvas.textInput,
          parentNode: this.canvas.textInput ? this.canvas.textInput.parentNode : null,
          existsInDOM: this.canvas.textInput ? document.contains(this.canvas.textInput) : false
        });
        
        // 詳細なテキストボックス状態確認
        const selectedTextBoxes = this.canvas.allPaths.filter(path => 
          path.tool === 'textbox' && path.isSelected
        );
        console.log('選択状態のテキストボックス:', selectedTextBoxes);
        
        // テキスト入力エリアがDOMに存在するかチェック
        const textInputOverlay = document.querySelector('.text-input-overlay');
        console.log('DOM内のテキスト入力エリア:', textInputOverlay);
        
        // テキストが入力されているかチェック
        const hasTextContent = selectedTextBoxes.some(textBox => 
          textBox.text && textBox.text.trim() !== ''
        );
        
        // より包括的な条件でテキストボックスを削除（ただし、テキストが入力済みの場合は削除しない）
        const hasTextInput = this.canvas.textInput && this.canvas.textInput.parentNode;
        const hasTextInputInDOM = document.querySelector('.text-input-overlay');
        const hasSelectedTextBox = selectedTextBoxes.length > 0;
        
        // テキストが入力済みの場合は削除せず、文字サイズ変更を許可
        if (hasTextContent) {
          console.log('テキストが入力済みのため、文字サイズ変更を許可します');
          // 文字サイズ変更処理は change イベントで実行されるので、ここでは何もしない
          return;
        }
        
        // 空のテキストボックスまたはテキスト入力中の場合は削除
        if (hasTextInput || hasTextInputInDOM || hasSelectedTextBox) {
          console.log('フォントサイズクリック: 空のテキストボックス関連を終了します');
          
          // すべてのテキスト関連要素を確実に削除
          if (hasTextInput) {
            this.canvas.finishTextInput();
            this.canvas.removeTextInput();
          }
          
          // DOM内の残存テキスト入力エリアも削除
          if (hasTextInputInDOM) {
            hasTextInputInDOM.remove();
          }
          
          // 選択状態の空のテキストボックスを削除
          if (hasSelectedTextBox) {
            selectedTextBoxes.forEach(textBox => {
              if (!textBox.text || textBox.text.trim() === '') {
                // 空のテキストボックスは削除
                this.canvas.removeCurrentTextBox();
              }
            });
          }
          
          // さらにツール切り替え処理も実行
          this.handleToolSwitch();
          // 画面を再描画
          this.canvas.redrawCanvas();
        }
      });
      
      fontSize.addEventListener('focus', (e) => {
        console.log('❗ フォントサイズ focusイベント発生');
      });
      
      console.log('font-size要素のイベントリスナー設定完了');
      
      // テキストボックス選択時にプルダウンの値を更新
      this.canvas.on('textBoxSelected', (textBoxData) => {
        fontSize.value = textBoxData.fontSize;
        
        // テキストボックスの色をカラーピッカーに反映
        const strokeColorInput = document.getElementById('stroke-color');
        if (strokeColorInput && textBoxData.strokeColor !== strokeColorInput.value) {
          console.log('テキストボックス選択でカラーピッカーを同期:', {
            before: strokeColorInput.value,
            after: textBoxData.strokeColor
          });
          strokeColorInput.value = textBoxData.strokeColor;
          // キャンバスのstrokeColorも更新
          this.canvas.setStrokeColor(textBoxData.strokeColor);
        }
      });
      
      // テキストボックス選択解除時にデフォルト値に戻す
      this.canvas.on('textBoxDeselected', () => {
        fontSize.value = this.canvas.fontSize;
        
        // カラーピッカーの値も現在のstrokeColorに戻す
        const strokeColorInput = document.getElementById('stroke-color');
        if (strokeColorInput && this.canvas.strokeColor !== strokeColorInput.value) {
          console.log('テキストボックス選択解除でカラーピッカーを同期:', {
            before: strokeColorInput.value,
            after: this.canvas.strokeColor
          });
          strokeColorInput.value = this.canvas.strokeColor;
        }
      });
    } else {
      console.error('font-size input not found');
    }

    // キャンバスの描画イベント
    this.canvas.on('drawingComplete', (strokes) => {
      // フリーハンド描画では図形認識を行わず、そのまま描画を保持
      // 図形認識機能は無効化
    });
    
    console.log('=== initializeToolButtons 完了 ===');
  }

  // ツール切り替え時の共通処理（テキスト編集中の場合は編集中のテキストボックスを削除）
  handleToolSwitch() {
    const isActuallyEditing = this.canvas.textInput && this.canvas.textInput.parentNode;
    
    // 選択状態のテキストボックスがあるかチェック（ただし、テキストが入力済みでない場合のみ削除対象）
    const hasEditingEmptyTextBox = this.canvas.allPaths.some(path => 
      path.tool === 'textbox' && path.isSelected && (!path.text || path.text.trim() === '')
    );
    
    // テキストが入力済みの選択状態テキストボックスがあるかチェック
    const hasSelectedTextBoxWithText = this.canvas.allPaths.some(path => 
      path.tool === 'textbox' && path.isSelected && path.text && path.text.trim() !== ''
    );
    
    console.log('=== handleToolSwitch 呼び出し ===');
    console.log('テキスト入力状態:', {
      textInput: this.canvas.textInput,
      parentNode: this.canvas.textInput ? this.canvas.textInput.parentNode : null,
      isActuallyEditing: isActuallyEditing,
      hasEditingEmptyTextBox: hasEditingEmptyTextBox,
      hasSelectedTextBoxWithText: hasSelectedTextBoxWithText,
      allPathsCount: this.canvas.allPaths.length
    });
    
    // テキスト編集中 OR 空の選択状態テキストボックスがある場合のみ削除
    if (isActuallyEditing || hasEditingEmptyTextBox) {
      console.log('テキスト編集中または空の選択状態テキストボックスがあるため削除します');
      this.canvas.removeCurrentTextBox();
    } else if (hasSelectedTextBoxWithText) {
      // テキストが入力済みの場合は削除せず選択解除のみ
      console.log('テキストが入力済みのテキストボックスの選択を解除します');
      this.canvas.clearTextBoxSelection();
      this.canvas.redrawCanvas();
    } else {
      console.log('テキストボックスがないか、既に選択解除されているため、何もしません');
    }
    
    // ツール切り替え後にカラーピッカーの値を現在のstrokeColorに同期
    const strokeColorInput = document.getElementById('stroke-color');
    if (strokeColorInput && this.canvas.strokeColor !== strokeColorInput.value) {
      console.log('カラーピッカーの値を同期:', {
        before: strokeColorInput.value,
        after: this.canvas.strokeColor
      });
      strokeColorInput.value = this.canvas.strokeColor;
    }
    
    // 消しゴムプレビューの状態をクリア（iPadでの残存問題対策）
    if (this.canvas.showEraserPreview) {
      this.canvas.showEraserPreview = false;
      this.canvas.eraserPreviewCoords = null;
      this.canvas.redrawCanvas();
    }
  }

  updateToolButtons(activeToolId) {
    // すべてのツールボタンからactiveクラスを削除
    document.querySelectorAll('.tool-btn').forEach(btn => {
      if (btn.id.includes('-tool')) {
        btn.classList.remove('active');
      }
    });
    
    // アクティブなツールボタンにactiveクラスを追加
    document.getElementById(activeToolId).classList.add('active');
  }

  resizeCanvas() {
    this.canvas.resize();
  }

  updatePenPreview(width) {
    const penPreview = document.getElementById('pen-preview');
    if (penPreview) {
      const size = Math.min(Math.max(width * 2, 4), 16); // 4px～16pxの範囲
      penPreview.style.width = size + 'px';
      penPreview.style.height = size + 'px';
    }
  }

  updateEraserPreview(size) {
    const eraserPreview = document.getElementById('eraser-preview');
    if (eraserPreview) {
      const previewSize = Math.min(Math.max(size / 2 + 8, 8), 28); // 8px～28pxの範囲
      eraserPreview.style.width = previewSize + 'px';
      eraserPreview.style.height = previewSize + 'px';
    }
  }

  updateStairsPreview(size) {
    const stairsPreview = document.getElementById('stairs-preview');
    if (stairsPreview) {
      // サイズに応じたプレビュー表示（1マス基準）
      let previewConfig;
      switch (size) {
        case 'small':
          previewConfig = { width: '10px', height: '8px', label: '0.5マス' };
          break;
        case 'large':
          previewConfig = { width: '24px', height: '8px', label: '1.5マス' };
          break;
        default: // medium
          previewConfig = { width: '16px', height: '8px', label: '1マス' };
      }
      
      stairsPreview.style.width = previewConfig.width;
      stairsPreview.style.height = previewConfig.height;
      stairsPreview.style.background = '#000';
      stairsPreview.style.borderRadius = '1px';
      stairsPreview.title = `階段記号サイズ: ${previewConfig.label}`;
    }
  }

  updateToolUI(tool) {
    const penWidthControl = document.getElementById('pen-width-control');
    const eraserSizeControl = document.getElementById('eraser-size-control');
    const doorControl = document.getElementById('door-control');
    const stairsControl = document.getElementById('stairs-control');
    const lineControl = document.getElementById('line-control');
    const fillControl = document.getElementById('fill-control');
    
    if (penWidthControl) {
      // ペンツール選択時のみ表示
      penWidthControl.style.display = tool === 'pen' ? 'flex' : 'none';
    }
    
    if (eraserSizeControl) {
      // 消しゴムツール選択時のみ表示
      eraserSizeControl.style.display = tool === 'eraser' ? 'flex' : 'none';
    }
    
    if (doorControl) {
      // 建具ツール選択時のみ表示
      doorControl.style.display = tool === 'door' ? 'flex' : 'none';
    }
    
    if (stairsControl) {
      // 階段ツール選択時のみ表示
      stairsControl.style.display = tool === 'stairs' ? 'flex' : 'none';
    }
    
    if (lineControl) {
      // 直線ツール選択時のみ表示
      lineControl.style.display = tool === 'line' ? 'flex' : 'none';
    }
    
    if (fillControl) {
      // 塗りつぶしツール選択時のみ表示
      fillControl.style.display = tool === 'fill' ? 'flex' : 'none';
    }
  }

  // オフライン対応機能の初期化
  initOfflineSupport() {
    // オンライン/オフライン状態の監視
    window.addEventListener('online', () => {
      this.showNetworkStatus('オンラインに復帰しました', 'success');
      console.log('Network: Online');
    });

    window.addEventListener('offline', () => {
      this.showNetworkStatus('オフラインモードです。アプリは引き続き利用できます', 'info');
      console.log('Network: Offline');
    });

    // 初期状態の表示
    if (!navigator.onLine) {
      this.showNetworkStatus('オフラインモードです', 'info');
    }

    // PWA インストール促進
    this.initPWAInstallPrompt();
  }

  // ネットワーク状態の表示
  showNetworkStatus(message, type = 'info') {
    // 既存のネットワーク通知を削除
    const existingNotification = document.querySelector('.network-notification');
    if (existingNotification) {
      existingNotification.remove();
    }

    // 新しい通知を作成
    const notification = document.createElement('div');
    notification.className = `network-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 70px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transition: opacity 0.3s ease;
    `;

    document.body.appendChild(notification);

    // 3秒後に自動削除
    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    }, 3000);
  }

  // PWA インストール促進
  initPWAInstallPrompt() {
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
      // デフォルトのミニ情報バーが表示されるのを防ぐ
      e.preventDefault();
      // 後で使用するためにイベントを保存
      deferredPrompt = e;
      
      // iPadの場合はSafariのインストール方法を案内
      if (this.isIPad()) {
        this.showIPadInstallGuide();
      } else {
        // その他のデバイスではプロンプトを表示
        this.showInstallButton(deferredPrompt);
      }
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      this.showNetworkStatus('アプリがホーム画面に追加されました！', 'success');
      deferredPrompt = null;
    });
  }

  // iPad検出
  isIPad() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  // iPad用インストールガイド
  showIPadInstallGuide() {
    // 既にホーム画面に追加済みかチェック
    if (window.navigator.standalone) {
      return; // 既にPWAとして起動している
    }

    // 初回訪問時のみ表示（localStorage でチェック）
    if (localStorage.getItem('installGuideShown')) {
      return;
    }

    const guide = document.createElement('div');
    guide.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      z-index: 20000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      margin: 20px;
      text-align: center;
    `;

    content.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: #333;">ホーム画面に追加</h3>
      <p style="margin: 0 0 20px 0; color: #666; line-height: 1.5;">
        この平面図アプリをiPadのホーム画面に追加して、<br>
        ネイティブアプリのように使用できます。
      </p>
      <div style="margin: 20px 0; padding: 16px; background: #f8f9fa; border-radius: 8px;">
        <p style="margin: 0; font-size: 14px; color: #555;">
          1. Safari の <strong>共有ボタン</strong> 📤 をタップ<br>
          2. <strong>「ホーム画面に追加」</strong> を選択<br>
          3. <strong>「追加」</strong> をタップ
        </p>
      </div>
      <button id="closeInstallGuide" style="
        background: #007AFF;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 12px 24px;
        font-size: 16px;
        cursor: pointer;
      ">わかりました</button>
    `;

    guide.appendChild(content);
    document.body.appendChild(guide);

    // 閉じるボタンのイベント
    document.getElementById('closeInstallGuide').addEventListener('click', () => {
      document.body.removeChild(guide);
      localStorage.setItem('installGuideShown', 'true');
    });

    // 背景タップで閉じる
    guide.addEventListener('click', (e) => {
      if (e.target === guide) {
        document.body.removeChild(guide);
        localStorage.setItem('installGuideShown', 'true');
      }
    });
  }

  toggleGrid() {
    const canvas = document.getElementById('drawing-canvas');
    const gridBtn = document.getElementById('grid-toggle');
    
    if (canvas.classList.contains('no-grid')) {
      canvas.classList.remove('no-grid');
      gridBtn.classList.add('active');
      this.canvas.setSnapToGrid(true);
    } else {
      canvas.classList.add('no-grid');
      gridBtn.classList.remove('active');
      this.canvas.setSnapToGrid(false);
    }
  }

  // エクスポート完了時の視覚フィードバック
  showExportFeedback(button, message, type = 'success') {
    const originalHTML = button.innerHTML;
    const originalColor = button.style.backgroundColor;
    
    // フィードバック表示
    button.innerHTML = message;
    button.style.backgroundColor = type === 'error' ? '#ff6b6b' : '#4CAF50';
    button.style.transform = 'scale(0.95)';
    
    // 2秒後に元に戻す
    setTimeout(() => {
      button.innerHTML = originalHTML;
      button.style.backgroundColor = originalColor;
      button.style.transform = '';
    }, 2000);
  }

  // プロジェクトデータの復元
  restoreProjectData(projectData) {
    if (!this.canvas || !projectData) return;

    try {
      // パスデータと設定の復元（loadFromDataで一括処理）
      if (projectData.paths && Array.isArray(projectData.paths)) {
        this.canvas.loadFromData(projectData);
        console.log('プロジェクトデータを復元しました:', projectData.paths.length + '個のパス');
      }

      // Canvas の完全な初期化を待ってから強制的に再描画
      // requestAnimationFrame を2回使用して確実にレンダリング完了後に描画
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // スロットリングフラグをリセットして強制再描画
          this.canvas.redrawRequested = false;
          if (this.canvas.redrawTimeout) {
            clearTimeout(this.canvas.redrawTimeout);
            cancelAnimationFrame(this.canvas.redrawTimeout);
            this.canvas.redrawTimeout = null;
          }
          this.canvas.lastRedrawTime = 0;
          
          // 再描画を実行
          this.canvas.redrawCanvas();
          console.log('プロジェクト復元後の再描画完了');
        });
      });

    } catch (error) {
      console.error('プロジェクトデータの復元に失敗:', error);
    }
  }

  // 背景画像の読み込み
  loadBackgroundImage(imageUrl) {
    if (!this.canvas) return;

    try {
      // TODO: setBackgroundImageメソッドの実装が必要
      if (typeof this.canvas.setBackgroundImage === 'function') {
        this.canvas.setBackgroundImage(imageUrl);
        console.log('背景画像を読み込みました');
      } else {
        console.warn('setBackgroundImageメソッドが実装されていません');
        // 暫定対応: 画像を新規プロジェクトとして開く
        alert('背景画像機能は現在実装中です。');
      }
      
    } catch (error) {
      console.error('背景画像の読み込みに失敗:', error);
    }
  }

  // プロジェクトデータのエクスポート
  async exportProject() {
    if (!this.canvas) {
      console.error('キャンバスが初期化されていません');
      return false;
    }

    try {
      // プロジェクトデータを取得
      const projectData = this.canvas.getProjectData();
      
      // 現在の日時でファイル名を生成
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/[T:]/g, '-').replace(/-/g, '');
      const filename = `floorplan-project-${timestamp}.json`;
      
      // JSONファイルとしてダウンロード
      const blob = new Blob([JSON.stringify(projectData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // メモリを解放
      URL.revokeObjectURL(url);
      
      console.log(`プロジェクトを保存しました: ${filename}`);
      return true;
      
    } catch (error) {
      console.error('プロジェクトの保存に失敗:', error);
      return false;
    }
  }

  // 初期画面に戻る
  returnToStartScreen() {
    console.error('returnToStartScreen呼び出し開始');
    
    // 確認ダイアログを表示
    const hasUnsavedChanges = this.canvas && (
      (this.canvas.allPaths && this.canvas.allPaths.length > 0)
    );
    console.error('作業データチェック:', { 
      hasUnsavedChanges, 
      allPathsLength: this.canvas?.allPaths?.length || 0
    });
    
    if (hasUnsavedChanges) {
      console.error('作業データあり - 確認ダイアログ表示');
      this.showConfirmDialog(
        '作業データの確認',
        '作業中のデータがあります。初期画面に戻りますか？\n\n※ 保存せずに戻ると、現在の作業は失われます。',
        () => {
          console.error('確認ダイアログ - OK選択');
          // OK押下時の処理
          this.executeReturnToStartScreen();
        },
        () => {
          console.error('確認ダイアログ - キャンセル選択');
          // キャンセル押下時の処理（何もしない）
          console.log('初期画面への移動をキャンセルしました');
        }
      );
    } else {
      console.error('作業データなし - 直接実行');
      // データがない場合は直接実行
      this.executeReturnToStartScreen();
    }
  }

  // 実際の初期画面移行処理
  executeReturnToStartScreen() {
    console.error('executeReturnToStartScreen: 開始');
    
    // アプリケーションの状態を完全にリセット
    console.error('executeReturnToStartScreen: resetApplicationState呼び出し前');
    this.resetApplicationState();
    console.error('executeReturnToStartScreen: resetApplicationState呼び出し後');

    // アプリ画面を非表示
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.style.display = 'none';
    }

    // 初期画面を表示
    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
      startScreen.style.display = 'flex';
      startScreen.classList.remove('hidden');
    }

    // スタートスクリーンの最後のセッション状態を更新
    if (window.startScreen && typeof window.startScreen.loadLastSession === 'function') {
      window.startScreen.loadLastSession();
    }

    console.error('executeReturnToStartScreen: 完了');
  }

  // カスタム確認ダイアログ
  showConfirmDialog(title, message, onConfirm, onCancel) {
    // 既存のダイアログがあれば削除
    const existingDialog = document.querySelector('.custom-confirm-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    // ダイアログを作成
    const dialog = document.createElement('div');
    dialog.className = 'custom-confirm-dialog';
    dialog.innerHTML = `
      <div class="confirm-dialog-backdrop">
        <div class="confirm-dialog-content">
          <div class="confirm-dialog-header">
            <h3>${title}</h3>
          </div>
          <div class="confirm-dialog-body">
            <p>${message.replace(/\n/g, '<br>')}</p>
          </div>
          <div class="confirm-dialog-actions">
            <button class="confirm-btn-cancel">キャンセル</button>
            <button class="confirm-btn-ok">OK</button>
          </div>
        </div>
      </div>
    `;

    // スタイルを追加
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
    `;

    // ダイアログを追加
    document.body.appendChild(dialog);

    // イベントリスナーを追加
    const cancelBtn = dialog.querySelector('.confirm-btn-cancel');
    const okBtn = dialog.querySelector('.confirm-btn-ok');
    const backdrop = dialog.querySelector('.confirm-dialog-backdrop');

    const cleanup = () => {
      document.body.removeChild(dialog);
    };

    cancelBtn.addEventListener('click', () => {
      cleanup();
      if (onCancel) onCancel();
    });

    okBtn.addEventListener('click', () => {
      cleanup();
      if (onConfirm) onConfirm();
    });

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        cleanup();
        if (onCancel) onCancel();
      }
    });

    // ESCキーで閉じる
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        document.removeEventListener('keydown', handleKeyDown);
        if (onCancel) onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
  }

  // キャンバス状態のみをリセット（初期化済みの場合の新規作成用）
  resetCanvasState() {
    if (!this.canvas) return;
    
    console.error('resetCanvasState: 開始');
    
    // テキスト編集中の場合は先に終了
    this.handleToolSwitch();
    
    // キャンバスコンテキストを完全にクリア
    this.canvas.ctx.clearRect(0, 0, this.canvas.canvas.width, this.canvas.canvas.height);
    
    // デバッグ: クリア前の状態を確認
    console.error('クリア前の状態:', {
      allPathsLength: this.canvas.allPaths.length,
      historyLength: this.canvas.history ? this.canvas.history.length : 'undefined',
      currentTool: this.canvas.currentTool
    });
    
    // キャンバスの完全クリア
    this.canvas.allPaths = [];
    this.canvas.history = [];
    this.canvas.redoStack = [];
    this.canvas.segmentHistory = [];
    this.canvas.segmentRedoStack = [];
    this.canvas.eraserHistory = [];
    this.canvas.eraserRedoStack = [];
    this.canvas.lastOperationType = null;
    
    // 描画プレビュー関連もクリア
    this.canvas.showShapePreview = false;
    this.canvas.startPoint = null;
    this.canvas.previewEndPoint = null;
    
    // ビューポート・変換行列の初期化（デバイスに応じた初期スケール）
    this.canvas.scale = this.canvas.getInitialScale();
    this.canvas.translateX = this.canvas.canvas.width / 2;
    this.canvas.translateY = this.canvas.canvas.height / 2;
    this.canvas.ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // テキストボックス関連もクリア
    if (this.canvas.selectedTextBox) {
      this.canvas.selectedTextBox = null;
    }
    if (this.canvas.isDraggingTextBox) {
      this.canvas.isDraggingTextBox = false;
    }
    
    // 描画状態もクリア
    this.canvas.isDrawing = false;
    this.canvas.currentPath = [];
    
    // マルチタッチ関連の状態もリセット
    this.canvas.isMultiTouch = false;
    this.canvas.multiTouchCooldown = false;
    this.canvas.isPinching = false;
    this.canvas.lastMultiTouchTime = 0;
    this.canvas.isShowingTouchPreview = false;
    
    // ツールを明示的にペンツールにリセット
    console.error('ツールリセット前:', { currentTool: this.canvas.currentTool });
    this.canvas.setTool('pen');
    this.toolManager.setTool('pen');
    this.updateToolUI('pen');
    console.error('ツールリセット後:', { currentTool: this.canvas.currentTool });
    
    // デバッグ: クリア後の状態を確認
    console.error('クリア後の状態:', {
      allPathsLength: this.canvas.allPaths.length,
      historyLength: this.canvas.history ? this.canvas.history.length : 'undefined',
      currentTool: this.canvas.currentTool
    });
    
    // キャンバスを再描画してクリア
    this.canvas.redrawCanvas();
    
    // 選択状態をクリア
    this.canvas.clearSelection();
    
    // 背景画像もクリア
    if (this.canvas.backgroundImage) {
      this.canvas.backgroundImage = null;
    }
    
    // テキスト関連の状態もクリア
    if (this.canvas.textInput) {
      this.canvas.removeTextInput();
    }
    
    // アンドゥ/リドゥボタンの状態を更新
    if (typeof this.canvas.updateUndoRedoButtons === 'function') {
      console.error('resetCanvasState: updateUndoRedoButtons呼び出し前');
      this.canvas.updateUndoRedoButtons();
      console.error('resetCanvasState: updateUndoRedoButtons呼び出し後');
    }
    
    console.error('resetCanvasState: 完了');
  }

  // アプリケーション状態の完全リセット
  resetApplicationState() {
    try {
      console.error('resetApplicationState: 開始');
      
      // テキスト編集中の場合は先に終了
      if (this.canvas) {
        this.handleToolSwitch();
        
        console.error('resetApplicationState - クリア前のツール:', { currentTool: this.canvas.currentTool });
        
        // キャンバスコンテキストを完全にクリア
        this.canvas.ctx.clearRect(0, 0, this.canvas.canvas.width, this.canvas.canvas.height);
        
        // キャンバスの完全クリア
        this.canvas.allPaths = [];
        this.canvas.history = [];
        this.canvas.redoStack = [];
        this.canvas.segmentHistory = [];
        this.canvas.segmentRedoStack = [];
        
        // テキストボックス関連もクリア
        if (this.canvas.selectedTextBox) {
          this.canvas.selectedTextBox = null;
        }
        if (this.canvas.isDraggingTextBox) {
          this.canvas.isDraggingTextBox = false;
        }
        
        // 描画状態もクリア
        this.canvas.isDrawing = false;
        this.canvas.currentPath = [];
        
        // ツールを明示的にペンツールにリセット
        this.canvas.setTool('pen');
        this.toolManager.setTool('pen');
        this.updateToolUI('pen');
        console.error('resetApplicationState - ツールリセット後:', { currentTool: this.canvas.currentTool });
        
        // キャンバスを再描画してクリア
        this.canvas.redrawCanvas();
        
        // 選択状態をクリア
        this.canvas.clearSelection();
        
        // 背景画像もクリア
        if (this.canvas.backgroundImage) {
          this.canvas.backgroundImage = null;
        }
        
        // テキスト関連の状態もクリア
        if (this.canvas.textInput) {
          this.canvas.removeTextInput();
        }
      }

      // 自動保存データもクリア（完全にリセット）
      this.clearAutosaveData();

      // 初期化フラグをリセット
      this.isInitialized = false;
      
      // ツール状態をリセット
      if (this.toolManager) {
        this.toolManager.setTool('pen');
      }
      
      // UIの状態をリセット
      this.resetUIState();
      
      console.error('resetApplicationState: 完了');
      
    } catch (error) {
      console.error('アプリケーション状態のリセット中にエラー:', error);
    }
  }

  // UI状態のリセット
  resetUIState() {
    // 全てのツールボタンの選択状態をクリア
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // ペンツールを選択状態にする
    const penTool = document.getElementById('pen-tool');
    if (penTool) {
      penTool.classList.add('active');
    }
    
    // エクスポートメニューを非表示
    const exportMenu = document.getElementById('export-menu');
    if (exportMenu) {
      exportMenu.style.display = 'none';
    }
    
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.classList.remove('active');
    }
    
    // ツール設定パネルをリセット
    document.querySelectorAll('.pen-width-group, .eraser-size-group, .door-control-group, .stairs-control-group, .line-control-group').forEach(group => {
      group.style.display = 'none';
    });
    
    console.log('UI状態をリセットしました');
  }

  // 自動保存データのクリア
  clearAutosaveData() {
    try {
      // ローカルストレージのデータをクリア
      localStorage.removeItem('floorplan-autosave');
      localStorage.removeItem('floorplan-paths');
      localStorage.removeItem('floorplan-settings');
      localStorage.removeItem('floorplan-canvas-state');
      
      console.log('自動保存データをクリアしました');
      
    } catch (error) {
      console.error('自動保存データのクリア中にエラー:', error);
    }
  }

  // ホームに戻る機能
  showStartScreen() {
    console.log('スタートスクリーンに戻ります');
    
    // アプリを非表示にする
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.style.display = 'none';
    }
    
    // スタートスクリーンを表示
    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
      startScreen.style.display = 'flex';
    }
    
    // 現在の作業を保存するかの確認（任意）
    // if (this.canvas && this.canvas.allPaths.length > 0) {
    //   if (confirm('現在の作業を保存しますか？')) {
    //     // 自動保存処理
    //     this.saveToLocalStorage();
    //   }
    // }
  }

  // ダークモード機能
  initDarkMode() {
    // 初期状態を適用
    this.applyDarkMode();
  }

  loadDarkModePreference() {
    // ローカルストレージから設定を読み込み、デフォルトはライトモード
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  }

  saveDarkModePreference() {
    localStorage.setItem('darkMode', this.isDarkMode.toString());
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    this.applyDarkMode();
    this.saveDarkModePreference();
    
    // ダークモードボタンのアイコンを更新
    this.updateDarkModeButton();
    
    // キャンバスの線色も更新（初期化済みの場合のみ）
    if (this.canvas) {
      this.canvas.updateStrokeColorForTheme();
    }
  }

  applyDarkMode() {
    const body = document.body;
    if (this.isDarkMode) {
      body.setAttribute('data-theme', 'dark');
    } else {
      body.removeAttribute('data-theme');
    }
  }

  updateDarkModeButton() {
    const darkModeBtn = document.getElementById('dark-mode-btn');
    const darkModeIcon = document.getElementById('dark-mode-icon');
    
    console.log('updateDarkModeButton:', { 
      isDarkMode: this.isDarkMode, 
      darkModeBtn: !!darkModeBtn, 
      darkModeIcon: !!darkModeIcon 
    });
    
    if (darkModeBtn && darkModeIcon) {
      // ダークモード時は太陽、ライトモード時は月
      const newSrc = this.isDarkMode ? 
        `${import.meta.env.BASE_URL}sun.png` : 
        `${import.meta.env.BASE_URL}moom.png`;
      console.log('画像パス変更:', darkModeIcon.src, '→', newSrc);
      
      darkModeIcon.src = newSrc;
      darkModeIcon.alt = this.isDarkMode ? 'ライトモード' : 'ダークモード';
      darkModeBtn.title = this.isDarkMode ? 'ライトモード切り替え' : 'ダークモード切り替え';
      
      // 画像の読み込み確認
      darkModeIcon.onerror = function() {
        console.error('画像読み込みエラー:', newSrc);
      };
      darkModeIcon.onload = function() {
        console.log('画像読み込み成功:', newSrc);
      };
    } else {
      console.error('ダークモードボタン要素が見つかりません');
    }
  }

  // 定型文プルダウン機能の設定
  setupPresetTextFeature() {
    const presetSelect = document.getElementById('preset-text-select');
    const placeBtn = document.getElementById('preset-text-place');
    
    if (!presetSelect || !placeBtn) {
      console.error('定型文要素が見つかりません');
      return;
    }

    // 初期状態では配置ボタンを無効化
    placeBtn.disabled = true;

    // プルダウン選択時
    presetSelect.addEventListener('change', () => {
      const selectedText = presetSelect.value;
      placeBtn.disabled = !selectedText;
      
      if (selectedText) {
        console.log('定型文選択:', selectedText);
      }
    });

    // 配置ボタンクリック時
    placeBtn.addEventListener('click', () => {
      const selectedText = presetSelect.value;
      if (!selectedText) return;

      console.log('定型文配置:', selectedText);
      this.placePresetText(selectedText);
      
      // 選択をリセット
      presetSelect.value = '';
      placeBtn.disabled = true;
    });
  }

  // 定型文をキャンバスに配置
  placePresetText(text) {
    if (!this.canvas) return;

    // キャンバスの中央に配置
    const canvasRect = this.canvas.canvas.getBoundingClientRect();
    const centerX = (canvasRect.width / 2 - this.canvas.translateX) / this.canvas.scale;
    const centerY = (canvasRect.height / 2 - this.canvas.translateY) / this.canvas.scale;

    // テキストボックスとして追加
    const textBoxData = {
      tool: 'textbox',
      text: text,
      x: centerX,
      y: centerY,
      width: text.length * 48 + 40, // 48px文字サイズに応じて幅を調整
      height: 60, // 48px文字サイズに応じて高さを調整
      fontSize: 48, // 標準文字サイズを48pxに変更
      strokeColor: this.canvas.strokeColor,
      isVertical: false,
      isSelected: false,
      isPreset: true // プリセットテキストフラグを追加
    };

    this.canvas.allPaths.push(textBoxData);
    this.canvas.lastOperationType = 'path';
    this.canvas.redoStack = [];
    
    this.canvas.redrawCanvas();
    
    console.log('定型文テキストボックス作成完了:', text);
  }

  // ホームに戻る（リロードなし初期化）
  resetToHome() {
    console.log('ホームに戻る - リロードなし初期化開始');
    
    // キャンバスの完全初期化
    if (this.canvas) {
      // 新しい履歴クリアメソッドを使用
      if (typeof this.canvas.clearAllHistory === 'function') {
        this.canvas.clearAllHistory();
      } else {
        // フォールバック: 手動で履歴をクリア
        this.canvas.allPaths = [];
        this.canvas.redoStack = [];
        this.canvas.segmentHistory = [];
        this.canvas.eraserHistory = [];
        this.canvas.history = [];
        this.canvas.segmentRedoStack = [];
        this.canvas.eraserRedoStack = [];
        this.canvas.lastOperationType = null;
        this.canvas.operationHistory = [];
        
        // ビューポート・変換行列の初期化
        this.canvas.scale = 1;
        this.canvas.translateX = this.canvas.canvas.width / 2;
        this.canvas.translateY = this.canvas.canvas.height / 2;
        this.canvas.ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      
      // 選択状態をクリア
      this.canvas.selectedTextBox = null;
      this.canvas.isResizing = false;
      this.canvas.resizeHandle = null;
      
      // 描画状態の確実な初期化
      this.canvas.isDrawing = false;
      this.canvas.currentPath = [];
      this.canvas.polylinePoints = [];
      this.canvas.isPolylineActive = false;
      
      // ツールを初期状態に戻す
      this.canvas.currentTool = 'pen';
      this.canvas.strokeWidth = 2;
      this.canvas.strokeColor = '#000000';
      this.canvas.fontSize = 48;
      
      // キャンバスを再描画
      this.canvas.redrawCanvas();
    }
    
    // UIを初期状態に戻す
    this.resetUI();
    
    // スタート画面を表示
    this.showStartScreen();
    
    console.log('ホームに戻る - 初期化完了');
  }
  
  // UI要素を初期状態に戻す
  resetUI() {
    // ツールボタンの選択状態をリセット
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // ペンツールを選択状態にする
    const penBtn = document.getElementById('pen-tool');
    if (penBtn) {
      penBtn.classList.add('active');
    }
    
    // スライダー値を初期値に戻す
    const penWidthSlider = document.getElementById('pen-width');
    const eraserSizeSlider = document.getElementById('eraser-size');
    const strokeColorPicker = document.getElementById('stroke-color');
    const fontSizeSelect = document.getElementById('font-size');
    
    if (penWidthSlider) {
      penWidthSlider.value = 2;
    }
    
    if (eraserSizeSlider) {
      eraserSizeSlider.value = 30;
    }
    
    if (strokeColorPicker) {
      strokeColorPicker.value = '#000000';
    }
    
    if (fontSizeSelect) {
      fontSizeSelect.value = '48';
    }
    
    // プリセットテキストのドロップダウンをリセット
    const presetSelect = document.getElementById('preset-text-select');
    if (presetSelect) {
      presetSelect.value = '';
    }
    
    // アンドゥ・リドゥボタンを確実に無効化
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) {
      undoBtn.disabled = true;
      undoBtn.style.opacity = '0.5';
    }
    if (redoBtn) {
      redoBtn.disabled = true;
      redoBtn.style.opacity = '0.5';
    }
    
    console.log('UI初期化完了 - undo/redoボタン無効化');
  }
}

// アプリケーションの起動
document.addEventListener('DOMContentLoaded', () => {
  new FloorPlanApp();
});
