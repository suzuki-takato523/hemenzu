import './style.css'
import { DrawingCanvas } from './drawingCanvas.js'
import { ToolManager } from './toolManager.js'
import { ShapeRecognizer } from './shapeRecognizer.js'

class FloorPlanApp {
  constructor() {
    this.canvas = null;
    this.toolManager = null;
    this.shapeRecognizer = null;
    this.init();
  }

  init() {
    // キャンバスの初期化
    this.canvas = new DrawingCanvas('#drawing-canvas');
    
    // ツールマネージャーの初期化
    this.toolManager = new ToolManager();
    
    // 図形認識の初期化
    this.shapeRecognizer = new ShapeRecognizer();
    
    // 初期ツールをペンツールに設定
    this.toolManager.setTool('pen');
    this.canvas.setTool('pen');
    
    // 初期UI設定（DOMContentLoaded後に実行）
    document.addEventListener('DOMContentLoaded', () => {
      this.updateToolUI('pen');
    });
    
    // イベントリスナーの設定
    this.setupEventListeners();
    
    // キャンバスサイズの設定
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  setupEventListeners() {
    // DOMが完全に読み込まれるまで待つ
    document.addEventListener('DOMContentLoaded', () => {
      this.initializeToolButtons();
    });
    
    // すでにDOMが読み込まれている場合は即座に実行
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      this.initializeToolButtons();
    }
  }

  initializeToolButtons() {
    console.log('=== initializeToolButtons 開始 ===');
    console.log('DOM readyState:', document.readyState);
    
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
        console.log('階段ツール選択: デフォルトサイズ（中）を設定');
      });
    } else {
      console.error('stairs-tool button not found');
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
        console.log('横書きテキストツールがクリックされました');
        
        // デバッグ情報を追加
        console.log('現在のテキスト入力状態:', {
          textInput: this.canvas.textInput,
          parentNode: this.canvas.textInput ? this.canvas.textInput.parentNode : null,
          allPathsCount: this.canvas.allPaths.length
        });
        
        // 編集中のテキストボックスの詳細も表示
        const editingTextBoxes = this.canvas.allPaths.filter(path => 
          path.tool === 'textbox' && path.isSelected
        );
        console.log('編集中のテキストボックス:', editingTextBoxes);
        
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
            console.log('縦書きから横書きに切り替えるため、現在の編集を破棄します');
            this.canvas.removeCurrentTextBox(); // テキストボックスごと削除
            // 編集破棄後に新しい横書きテキストボックスを作成
          } else if (currentEditingTextBox && !currentEditingTextBox.isVertical) {
            // 横書きから横書きへの場合は継続
            console.log('横書きテキスト編集中のため、編集を継続します');
            return;
          } else {
            console.log('実際にテキスト編集中のため、新しいテキストボックスの作成をスキップします（編集は継続）');
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
        console.log('縦書きテキストツールがクリックされました');
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
            console.log('横書きから縦書きに切り替えるため、現在の編集を破棄します');
            this.canvas.removeCurrentTextBox(); // テキストボックスごと削除
            // 編集破棄後に新しい縦書きテキストボックスを作成
          } else if (currentEditingTextBox && currentEditingTextBox.isVertical) {
            // 縦書きから縦書きへの場合は継続
            console.log('縦書きテキスト編集中のため、編集を継続します');
            return;
          } else {
            console.log('実際にテキスト編集中のため、新しいテキストボックスの作成をスキップします（編集は継続）');
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
          this.canvas.clear();
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

    // 手動最適化ボタンは削除 - 自動最適化で十分

    // 統合エクスポートボタンとメニューの実装
    const exportBtn = document.getElementById('export-btn');
    const exportMenu = document.getElementById('export-menu');
    const exportPdfOption = document.getElementById('export-pdf-option');
    const exportImageOption = document.getElementById('export-image-option');

    if (exportBtn && exportMenu && exportPdfOption && exportImageOption) {
      // エクスポートボタンクリックでメニュー表示/非表示切り替え
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = exportMenu.style.display !== 'none';
        exportMenu.style.display = isVisible ? 'none' : 'block';
        
        // ボタンの見た目も変更
        exportBtn.classList.toggle('active', !isVisible);
      });

      // PDF出力オプション
      exportPdfOption.addEventListener('click', async () => {
        console.log('PDF出力オプションが選択されました');
        exportMenu.style.display = 'none';
        exportBtn.classList.remove('active');
        
        // テキスト編集中の場合は先に終了
        this.handleToolSwitch();
        
        // PDF出力を実行
        const success = await this.canvas.exportToPDF();
        if (success) {
          // 成功時の視覚フィードバック
          this.showExportFeedback(exportBtn, 'PDF出力完了！');
          exportBtn.style.transform = 'scale(0.95)';
          setTimeout(() => {
            exportBtn.style.transform = '';
          }, 150);
        }
      });

      // 画像出力オプション
      exportImageOption.addEventListener('click', async () => {
        console.log('画像エクスポートオプションが選択されました');
        exportMenu.style.display = 'none';
        exportBtn.classList.remove('active');
        
        // テキスト編集中の場合は先に終了
        this.handleToolSwitch();
        
        // 画像エクスポートを実行
        const success = await this.canvas.exportToImage('png', 0.95);
        if (success) {
          // 成功時の視覚フィードバック
          this.showExportFeedback(exportBtn, '画像エクスポート完了！');
        } else {
          this.showExportFeedback(exportBtn, 'エクスポートに失敗しました', 'error');
        }
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
      console.error('Export button or menu elements not found');
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

    // 扉の種類選択（扉ツール専用）
    const doorType = document.getElementById('door-type');
    if (doorType) {
      doorType.addEventListener('change', (e) => {
        this.canvas.setDoorType(e.target.value);
        console.log('扉の種類を変更:', e.target.value);
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
          console.log('階段サイズを変更:', size);
        });
      }
    });

    const stairsPreview = document.getElementById('stairs-preview');
    if (stairsPreview) {
      // 初期プレビューを中サイズで設定
      this.canvas.setStairSize('medium'); // キャンバスにも設定
      this.updateStairsPreview('medium');
      console.log('初期化: 階段を中サイズに設定');
    }

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
        
        console.log('線スタイル切り替え:', { 
          beforeClick: currentStyle,
          afterClick: nextStyle 
        });
        
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

    const strokeColor = document.getElementById('stroke-color');
    console.log('stroke-color要素の検索結果:', strokeColor);
    if (strokeColor) {
      console.log('stroke-color要素が見つかりました。イベントリスナーを設定中...');
      
      // 複数のイベントタイプでテスト
      strokeColor.addEventListener('input', (e) => {
        console.log('❗ カラーピッカー inputイベント発生', e.target.value);
        // inputイベントでも即座に色を更新
        this.canvas.setStrokeColor(e.target.value);
        // ペンプレビューの色も更新
        if (penPreview) {
          penPreview.style.background = e.target.value;
        }
      });
      
      strokeColor.addEventListener('change', (e) => {
        console.log('❗ カラーピッカー changeイベント発生', e.target.value);
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
        
        // テキストが入力済みの場合は色を変更して編集を継続
        if (hasTextContent) {
          console.log('テキストが入力済みのため、色を変更して編集を継続します');
          
          // 選択状態のテキストボックスの色を変更
          selectedTextBoxes.forEach(textBox => {
            if (textBox.text && textBox.text.trim() !== '') {
              textBox.strokeColor = e.target.value;
              console.log('テキストボックスの色を変更:', e.target.value);
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
          console.log('色変更: 空のテキスト入力を終了します');
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
        console.log('❗ カラーピッカー clickイベント発生');
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
        
        // テキストが入力済みの場合は削除せず、色変更を許可
        if (hasTextContent) {
          console.log('テキストが入力済みのため、色変更を許可します');
          // 色変更処理は change イベントで実行されるので、ここでは何もしない
          return;
        }
        
        // 空のテキストボックスまたはテキスト入力中の場合は削除
        if (hasTextInput || hasTextInputInDOM || hasSelectedTextBox) {
          console.log('カラーピッカークリック: 空のテキストボックス関連を終了します');
          
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
    
    if (penWidthControl) {
      // ペンツール選択時のみ表示
      penWidthControl.style.display = tool === 'pen' ? 'flex' : 'none';
    }
    
    if (eraserSizeControl) {
      // 消しゴムツール選択時のみ表示
      eraserSizeControl.style.display = tool === 'eraser' ? 'flex' : 'none';
    }
    
    if (doorControl) {
      // 扉ツール選択時のみ表示
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
    const originalText = button.textContent;
    const originalColor = button.style.backgroundColor;
    
    // フィードバック表示
    button.textContent = message;
    button.style.backgroundColor = type === 'error' ? '#ff6b6b' : '#4CAF50';
    button.style.transform = 'scale(0.95)';
    
    // 2秒後に元に戻す
    setTimeout(() => {
      button.textContent = originalText;
      button.style.backgroundColor = originalColor;
      button.style.transform = '';
    }, 2000);
  }
}

// アプリケーションの起動
document.addEventListener('DOMContentLoaded', () => {
  new FloorPlanApp();
});
