// Text box methods.
// Mixed-into DrawingCanvas via Object.assign.

export const textBoxMethods = {
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
  },

  drawVerticalText(text, x, y, fontSize) {
    const chars = text.split('');
    chars.forEach((char, index) => {
      this.ctx.fillText(char, x, y + (index * fontSize));
    });
  },

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
  },

  createTextBox(start, end) {
    // テキストボックスを作成
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    const isVertical = this.currentTool === 'text-vertical';
    
    // フォントサイズに基づいた適切なサイズを設定
    const fontSize = this.fontSize;
    let actualWidth, actualHeight;
    
    if (isVertical) {
      // 縦書き：3文字分の幅、10文字分の高さ
      actualWidth = Math.max(width, fontSize * 3);
      actualHeight = Math.max(height, fontSize * 10);
    } else {
      // 横書き：10文字分の幅、1行分の高さ
      actualWidth = Math.max(width, fontSize * 10);
      actualHeight = Math.max(height, fontSize * 1.5); // 1行分の高さ
    }
    
    this.createTextBoxAuto(centerX, centerY, actualWidth, actualHeight, isVertical);
  },

  createTextBoxAuto(centerX, centerY, width, height, isVertical) {
    
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
    
    // アンドゥ/リドゥボタンの状態を更新
    this.updateUndoRedoButtons();
    
    console.log('テキストボックス作成: lastOperationType = path');
    console.log('作成されたテキストボックス:', textBoxData);
    console.log('allPaths配列:', this.allPaths);
    this.redrawCanvas();
    this.editTextBox(textBoxData);
  },

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
        
        // アンドゥ/リドゥボタンの状態を更新
        this.updateUndoRedoButtons();
        
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
      // 縦書きの場合もtextareaを使用（改行処理が簡単）
      this.textInput = document.createElement('textarea');
      this.textInput.value = textBoxData.text || '';
      this.textInput.placeholder = '縦書きテキスト';
    } else {
      // 横書きの場合はtextareaを使用
      this.textInput = document.createElement('textarea');
      this.textInput.value = textBoxData.text;
      this.textInput.placeholder = '横書きテキスト';
    }
    this.textInput.className = 'text-input-overlay';
    
    // フォントサイズは指定値をそのまま使う（未設定の場合は現在の選択値を使用）
    const adjustedFontSize = textBoxData.fontSize || this.fontSize || 48;
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
      const minW = Math.max(80, screenWidth - padding * 2, adjustedFontSize * 10);
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
    
    // 縦書きの場合は writing-mode を設定
    if (textBoxData.isVertical) {
      this.textInput.style.writingMode = 'vertical-rl';
      this.textInput.style.textOrientation = 'upright';
    } else {
      this.textInput.style.writingMode = 'horizontal-tb';
      this.textInput.style.textOrientation = 'mixed';
    }
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
      } else if (e.key === 'Enter' && e.ctrlKey) {
        // Ctrl+Enterで入力完了（縦書き・横書き共通）
        e.preventDefault();
        this.finishTextBoxEdit();
      }
      // 通常のEnterキーは改行として処理（preventDefault不要）
    });
    
    // テキスト入力時の自動サイズ調整
    this.textInput.addEventListener('input', () => {
      this.adjustTextBoxSize(textBoxData);
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
  },

  adjustTextBoxSize(textBoxData) {
    if (!this.textInput) return;
    
    const text = this.textInput.value;
    const lines = text.split('\n');
    const adjustedFontSize = textBoxData.fontSize;
    const dpr = window.devicePixelRatio || 1;
    
    if (textBoxData.isVertical) {
      // 縦書きの場合：列数に応じて幅を調整
      const maxLineLength = Math.max(...lines.map(line => line.length), 1);
      const newWidth = Math.max(adjustedFontSize * 3.5, adjustedFontSize * (maxLineLength + 1));
      this.textInput.style.width = `${newWidth}px`;
      
      // テキストボックスデータも更新
      textBoxData.width = newWidth * dpr;
    } else {
      // 横書きの場合：行数に応じて高さを調整
      const lineCount = Math.max(lines.length, 1);
      const lineHeight = adjustedFontSize * 1.3; // line-height: 1.3 に合わせる
      const newHeight = Math.max(adjustedFontSize * 1.5, lineHeight * lineCount + 8); // padding分を考慮
      this.textInput.style.height = `${newHeight / dpr}px`;
      
      // テキストボックスデータも更新
      textBoxData.height = newHeight;
    }
    
    // キャンバスを再描画してボックスサイズを更新
    this.redrawCanvas();
  },

  finishTextBoxEdit() {
    if (!this.textInput || !this.selectedTextBox) return;
    
    // textareaから値を取得
    const text = this.textInput.value.trim();
    this.selectedTextBox.text = text;
    
    this.removeTextInput();
    this.selectedTextBox = null;
    this.currentTextBox = null;
    this.redrawCanvas();
  },

  cancelTextBoxEdit() {
    if (!this.selectedTextBox) return;
    
    // テキストが空の場合、テキストボックスを削除
    if (!this.selectedTextBox.text.trim()) {
      const index = this.allPaths.indexOf(this.selectedTextBox);
      if (index > -1) {
        this.allPaths.splice(index, 1);
        
        // アンドゥ/リドゥボタンの状態を更新
        this.updateUndoRedoButtons();
      }
    }
    
    this.removeTextInput();
    this.selectedTextBox = null;
    this.currentTextBox = null;
    this.redrawCanvas();
  },

  drawTextBox(textBoxData) {
    
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
        const startX = centerX + (totalTextWidth - columnSpacing) / 2; // 右端から開始
        const startY = centerY - totalTextHeight / 2;
        
        inputLines.forEach((line, columnIndex) => {
          const chars = line.split('');
          const columnX = startX - (columnIndex * columnSpacing); // 右から左に配置
          
          chars.forEach((char, charIndex) => {
            const yy = startY + (charIndex * fontSize) + fontSize / 2;
            this.ctx.fillText(char, columnX, yy);
          });
        });
      } else {
        // 横テキスト：プリセットテキストは中央揃え、通常テキストは左揃え
        const isPreset = textBoxData.isPreset || false;
        this.ctx.textAlign = isPreset ? 'center' : 'left';
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
        
        // 各行を描画（プリセットは中央揃え、通常は左揃え）
        const totalTextHeight = allLines.length * lineHeight;
        const startY = y + (height - totalTextHeight) / 2 + lineHeight / 2; // textBaseline='middle'に合わせて調整
        
        allLines.forEach((lineText, index) => {
          const xx = isPreset ? x + width / 2 : x + padding; // プリセットは中央、通常は左端
          const yy = startY + (index * lineHeight);
          this.ctx.fillText(lineText, xx, yy);
        });
      }
      this.ctx.textAlign = 'start';
      this.ctx.textBaseline = 'alphabetic';
    }
  },

  getTextBoxAt(coords) {
    // allPathsを逆順で検索（最後に描いたものが優先）
    for (let i = this.allPaths.length - 1; i >= 0; i--) {
      const pathData = this.allPaths[i];
      if (pathData.tool === 'textbox' && this.isPointInTextBox(coords, pathData)) {
        return pathData;
      }
    }
    return null;
  },

  isPointInTextBox(coords, textBox) {
    // テキストの実際の描画サイズを計算
    const actualSize = this.calculateActualTextBoxSize(textBox);
    
    return coords.x >= textBox.x && 
           coords.x <= textBox.x + actualSize.width &&
           coords.y >= textBox.y && 
           coords.y <= textBox.y + actualSize.height;
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
          
          // アンドゥ/リドゥボタンの状態を更新
          this.updateUndoRedoButtons();
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
  },

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
  },

  showTextBoxEditDialog(textBoxData) {
    console.log('テキストボックス編集ダイアログを表示:', textBoxData);
    
    // 既存のダイアログがあれば削除
    const existingDialog = document.querySelector('.textbox-edit-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }
    
    // ダイアログを作成
    const dialog = document.createElement('div');
    dialog.className = 'textbox-edit-dialog';
    dialog.innerHTML = `
      <div class="textbox-edit-backdrop">
        <div class="textbox-edit-content">
          <div class="textbox-edit-header">
            <h3>テキストボックス編集</h3>
          </div>
          <div class="textbox-edit-body">
            <div class="edit-field">
              <label>テキスト内容</label>
              <textarea id="edit-text-content" rows="4">${textBoxData.text || ''}</textarea>
            </div>
            <div class="edit-field">
              <label>色</label>
              <div class="color-preset-buttons">
                <button class="preset-color-btn" data-color="#000000" style="background-color: #000000;" title="黒"></button>
                <button class="preset-color-btn" data-color="#FF0000" style="background-color: #FF0000;" title="赤"></button>
                <button class="preset-color-btn" data-color="#0080FF" style="background-color: #0080FF;" title="青"></button>
                <button class="preset-color-btn" data-color="#00FF00" style="background-color: #00FF00;" title="緑"></button>
                <button class="preset-color-btn" data-color="#FFFF00" style="background-color: #FFFF00;" title="黄"></button>
                <button class="preset-color-btn" data-color="#FF00FF" style="background-color: #FF00FF;" title="マゼンタ"></button>
                <button class="preset-color-btn" data-color="#00FFFF" style="background-color: #00FFFF;" title="シアン"></button>
                <button class="preset-color-btn" data-color="#FFA500" style="background-color: #FFA500;" title="オレンジ"></button>
                <button class="preset-color-btn" data-color="#808080" style="background-color: #808080;" title="グレー"></button>
                <button class="preset-color-btn" data-color="#FFFFFF" style="background-color: #FFFFFF; border: 2px solid #999;" title="白"></button>
              </div>
              <div class="color-picker-wrapper">
                <input type="color" id="edit-text-color" value="${textBoxData.strokeColor || '#000000'}">
                <span class="color-preview" style="background-color: ${textBoxData.strokeColor || '#000000'}"></span>
                <span class="color-label">カスタム色</span>
              </div>
            </div>
            <div class="edit-field">
              <label>フォントサイズ</label>
              <select id="edit-font-size">
                <option value="16" ${textBoxData.fontSize === 16 ? 'selected' : ''}>16px</option>
                <option value="20" ${textBoxData.fontSize === 20 ? 'selected' : ''}>20px</option>
                <option value="24" ${textBoxData.fontSize === 24 ? 'selected' : ''}>24px</option>
                <option value="28" ${textBoxData.fontSize === 28 ? 'selected' : ''}>28px</option>
                <option value="32" ${textBoxData.fontSize === 32 ? 'selected' : ''}>32px</option>
                <option value="36" ${textBoxData.fontSize === 36 ? 'selected' : ''}>36px</option>
                <option value="40" ${textBoxData.fontSize === 40 ? 'selected' : ''}>40px</option>
                <option value="48" ${textBoxData.fontSize === 48 ? 'selected' : ''}>48px</option>
                <option value="56" ${textBoxData.fontSize === 56 ? 'selected' : ''}>56px</option>
                <option value="64" ${textBoxData.fontSize === 64 ? 'selected' : ''}>64px</option>
                <option value="72" ${textBoxData.fontSize === 72 ? 'selected' : ''}>72px</option>
                <option value="80" ${textBoxData.fontSize === 80 ? 'selected' : ''}>80px</option>
                <option value="96" ${textBoxData.fontSize === 96 ? 'selected' : ''}>96px</option>
              </select>
            </div>
            <div class="edit-field">
              <label>向き</label>
              <div class="orientation-buttons">
                <button id="edit-orientation-horizontal" class="orientation-btn ${!textBoxData.isVertical ? 'active' : ''}">横書き</button>
                <button id="edit-orientation-vertical" class="orientation-btn ${textBoxData.isVertical ? 'active' : ''}">縦書き</button>
              </div>
            </div>
          </div>
          <div class="textbox-edit-actions">
            <button class="edit-btn-cancel">キャンセル</button>
            <button class="edit-btn-ok">OK</button>
          </div>
        </div>
      </div>
    `;
    
    // スタイルを追加
    if (!document.querySelector('#textbox-edit-dialog-style')) {
      const style = document.createElement('style');
      style.id = 'textbox-edit-dialog-style';
      style.textContent = `
        .textbox-edit-dialog {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 10000;
        }
        .textbox-edit-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .textbox-edit-content {
          background: white;
          border-radius: 12px;
          padding: 24px;
          min-width: 400px;
          max-width: 90%;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        }
        body.dark-mode .textbox-edit-content {
          background: #2d2d2d;
          color: #e0e0e0;
        }
        .textbox-edit-header h3 {
          margin: 0 0 20px 0;
          font-size: 20px;
          font-weight: 600;
        }
        .textbox-edit-body {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .edit-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .edit-field label {
          font-weight: 500;
          font-size: 14px;
        }
        .edit-field textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
        }
        body.dark-mode .edit-field textarea {
          background: #3d3d3d;
          color: #e0e0e0;
          border-color: #555;
        }
        .color-preset-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 12px;
          padding: 8px;
          background: #f5f5f5;
          border-radius: 8px;
        }
        body.dark-mode .color-preset-buttons {
          background: #3d3d3d;
        }
        .preset-color-btn {
          width: 40px;
          height: 40px;
          border: 2px solid #ddd;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }
        body.dark-mode .preset-color-btn {
          border-color: #555;
        }
        .preset-color-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .preset-color-btn.selected {
          border-color: #007AFF;
          box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.3);
        }
        .color-picker-wrapper {
          display: flex;
          gap: 8px;
          align-items: center;
          padding-top: 8px;
          border-top: 1px solid #e0e0e0;
        }
        body.dark-mode .color-picker-wrapper {
          border-top-color: #555;
        }
        .color-picker-wrapper input[type="color"] {
          width: 50px;
          height: 36px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
        .color-preview {
          width: 36px;
          height: 36px;
          border-radius: 6px;
          border: 1px solid #ccc;
        }
        .color-label {
          font-size: 12px;
          color: #666;
        }
        body.dark-mode .color-label {
          color: #aaa;
        }
        .edit-field select {
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 6px;
          font-size: 14px;
          background: white;
          cursor: pointer;
        }
        body.dark-mode .edit-field select {
          background: #3d3d3d;
          color: #e0e0e0;
          border-color: #555;
        }
        .orientation-buttons {
          display: flex;
          gap: 8px;
        }
        .orientation-btn {
          flex: 1;
          padding: 8px 16px;
          border: 1px solid #ccc;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }
        .orientation-btn.active {
          background: #007AFF;
          color: white;
          border-color: #007AFF;
        }
        body.dark-mode .orientation-btn {
          background: #3d3d3d;
          color: #e0e0e0;
          border-color: #555;
        }
        body.dark-mode .orientation-btn.active {
          background: #0066CC;
          border-color: #0066CC;
        }
        .textbox-edit-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 20px;
        }
        .textbox-edit-actions button {
          padding: 10px 24px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .edit-btn-cancel {
          background: #f0f0f0;
          color: #333;
        }
        .edit-btn-cancel:hover {
          background: #e0e0e0;
        }
        body.dark-mode .edit-btn-cancel {
          background: #3d3d3d;
          color: #e0e0e0;
        }
        body.dark-mode .edit-btn-cancel:hover {
          background: #4d4d4d;
        }
        .edit-btn-ok {
          background: #007AFF;
          color: white;
        }
        .edit-btn-ok:hover {
          background: #0066CC;
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(dialog);
    
    // イベントリスナーを追加
    const textInput = dialog.querySelector('#edit-text-content');
    const colorInput = dialog.querySelector('#edit-text-color');
    const colorPreview = dialog.querySelector('.color-preview');
    const fontSizeSelect = dialog.querySelector('#edit-font-size');
    const horizontalBtn = dialog.querySelector('#edit-orientation-horizontal');
    const verticalBtn = dialog.querySelector('#edit-orientation-vertical');
    const cancelBtn = dialog.querySelector('.edit-btn-cancel');
    const okBtn = dialog.querySelector('.edit-btn-ok');
    const backdrop = dialog.querySelector('.textbox-edit-backdrop');
    const presetColorButtons = dialog.querySelectorAll('.preset-color-btn');
    
    let isVertical = textBoxData.isVertical;
    let selectedColor = textBoxData.strokeColor || '#000000';
    
    // 初期選択状態を設定
    presetColorButtons.forEach(btn => {
      if (btn.dataset.color.toUpperCase() === selectedColor.toUpperCase()) {
        btn.classList.add('selected');
      }
    });
    
    // プリセットカラーボタンのイベント
    presetColorButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        selectedColor = btn.dataset.color;
        colorInput.value = selectedColor;
        colorPreview.style.backgroundColor = selectedColor;
        
        // 選択状態を更新
        presetColorButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
    
    // カラーピッカー変更時
    colorInput.addEventListener('input', () => {
      selectedColor = colorInput.value;
      colorPreview.style.backgroundColor = selectedColor;
      
      // プリセットボタンの選択状態をクリア
      presetColorButtons.forEach(btn => {
        if (btn.dataset.color.toUpperCase() === selectedColor.toUpperCase()) {
          btn.classList.add('selected');
        } else {
          btn.classList.remove('selected');
        }
      });
    });
    
    // 向きボタンのイベント
    horizontalBtn.addEventListener('click', () => {
      isVertical = false;
      horizontalBtn.classList.add('active');
      verticalBtn.classList.remove('active');
    });
    
    verticalBtn.addEventListener('click', () => {
      isVertical = true;
      verticalBtn.classList.add('active');
      horizontalBtn.classList.remove('active');
    });
    
    // ESCキーで閉じる
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        cleanup();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    
    const cleanup = () => {
      document.removeEventListener('keydown', handleKeyDown);
      dialog.remove();
    };
    
    cancelBtn.addEventListener('click', () => {
      cleanup();
    });
    
    okBtn.addEventListener('click', () => {
      console.log('OK button clicked');
      // 変更を適用
      textBoxData.text = textInput.value.trim();
      textBoxData.strokeColor = selectedColor;
      textBoxData.fontSize = parseInt(fontSizeSelect.value);
      textBoxData.isVertical = isVertical;
      
      console.log('Updated textBoxData:', textBoxData);
      
      // サイズを再計算
      this.recalculateTextBoxSize(textBoxData);
      
      // 履歴をクリア（編集は新しい操作として扱う）
      this.redoStack = [];
      this.lastOperationType = 'path';
      
      // アンドゥ/リドゥボタンの状態を更新
      this.updateUndoRedoButtons();
      
      // 再描画
      this.redrawCanvas();
      
      console.log('Calling cleanup');
      cleanup();
    });
    
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        cleanup();
      }
    });
    
    // テキストエリアにフォーカス
    setTimeout(() => {
      textInput.focus();
      textInput.select();
    }, 100);
  },

  recalculateTextBoxSize(textBoxData) {
    const text = textBoxData.text || '';
    const fontSize = textBoxData.fontSize;
    const padding = 20;
    
    this.ctx.font = `${fontSize}px "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", Arial, sans-serif`;
    
    if (textBoxData.isVertical) {
      // 縦書き：行数×フォントサイズで幅、最長行×フォントサイズで高さ
      const lines = text.split('\n');
      const maxLineLength = Math.max(...lines.map(line => line.length), 1);
      textBoxData.width = lines.length * fontSize * 1.2 + padding * 2;
      textBoxData.height = maxLineLength * fontSize + padding * 2;
    } else {
      // 横書き：最長行の幅、行数×行高で高さ
      const lines = text.split('\n');
      let maxWidth = 0;
      for (const line of lines) {
        const metrics = this.ctx.measureText(line);
        maxWidth = Math.max(maxWidth, metrics.width);
      }
      const lineHeight = fontSize * 1.3;
      textBoxData.width = maxWidth + padding * 2;
      textBoxData.height = lines.length * lineHeight + padding * 2;
    }
  },

};
