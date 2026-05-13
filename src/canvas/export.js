// 画像/PDF/Excel エクスポート関連メソッド群。
// DrawingCanvas のメソッドとして prototype に Object.assign される（mixin 形式）。
// このため this はインスタンスを指す（this.allPaths / this.canvas / this.ctx 等）。

export const exportMethods = {
  // 画像エクスポート機能（PDFと完全に同じレイアウト）
  async exportToImage(format = 'png', quality = 0.95) {
    try {
      console.log('🖼️ 画像エクスポート開始（PDF完全準拠）:', format);
      
      // PNG形式の場合は余白なし、それ以外はPDFと同じ
      const pdfWidth = 210; // A4幅(mm)
      const pdfHeight = 297; // A4高さ(mm)
      const margin = format === 'png' ? 0 : 15; // PNG: 余白なし、JPG: 余白あり
      const headerHeight = 20; // ヘッダー高さ(mm) - PDFと同じ
      const footerHeight = 0; // フッター削除 - PDFと同じ
      
      // PDFと同じ利用可能エリア計算
      const availablePDFWidth = pdfWidth - (margin * 2); // 180mm
      const availablePDFHeight = pdfHeight - (margin * 2) - headerHeight; // 252mm
      const optimalRatio = availablePDFWidth / availablePDFHeight; // 約0.714
      
      // キャプチャ範囲：中心を合わせるために横34マスに固定（2倍に拡大、偶数）
      const captureHeightMas = 44; // 縦マス数（2倍）
      const captureWidthMas = 34; // 横マス数（2倍、偶数、中心を0マスに）
      
      const captureWidth = captureWidthMas * this.gridSize;   
      const captureHeight = captureHeightMas * this.gridSize; 
      
      // グリッドに合わせたキャプチャ開始位置（中心を0,0に）
      const halfGrid = this.gridSize / 2;
      const startX = -captureWidth / 2;  // 中心
      const startY = -captureHeight / 2; // 中心
      
      console.log('キャプチャ範囲（PDF準拠）:', {
        マス数: { width: captureWidthMas, height: captureHeightMas },
        ピクセル: { width: captureWidth, height: captureHeight },
        アスペクト比: (captureWidth / captureHeight).toFixed(3),
        PDF最適比: optimalRatio.toFixed(3)
      });
      
      // 高解像度でA4サイズのCanvasを作成
      const dpi = 300; // 300DPI
      const mmToPx = dpi / 25.4; // 1mm = 約11.81px
      
      // PNG/JPG共にA4フルサイズ(210mm × 297mm)
      const imageWidth = Math.round(pdfWidth * mmToPx);
      const imageHeight = Math.round(pdfHeight * mmToPx);
      
      const marginPx = Math.round(margin * mmToPx); // PNG: 0, JPG: 15mm
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
      
      // アスペクト比を保ったままキャンバスサイズを制限
      const maxSize = 4096;
      const pixelScale = Math.min(1, maxSize / Math.max(captureWidth, captureHeight));
      const safeWidth = Math.round(captureWidth * pixelScale);
      const safeHeight = Math.round(captureHeight * pixelScale);

      tempCanvas.width = safeWidth;
      tempCanvas.height = safeHeight;

      tempCtx.fillStyle = 'white';
      tempCtx.fillRect(0, 0, safeWidth, safeHeight);
      tempCtx.imageSmoothingEnabled = true;
      tempCtx.imageSmoothingQuality = 'high';
      // 世界座標 → ピクセルのスケーリング（縦横同じ倍率なのでアスペクト保持）
      tempCtx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);

      // グリッドとパスは「世界座標サイズ」を渡す（スケールは ctx 側で適用）
      this.drawGridOnContext(tempCtx, captureWidth, captureHeight);
      this.redrawPathsOnContext(tempCtx, startX, startY, captureWidth, captureHeight);
      
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
      await this.drawImageLogo(ctx, marginPx, headerHeightPx, mmToPx, imageWidth, imageHeight, format);
      
      // PDFと同じオレンジ色の枠線を描画（ヘッダーごと囲む）
      ctx.strokeStyle = '#e26b0a'; // PDFと同じ色 (RGB: 226, 107, 10)
      ctx.lineWidth = 1 * mmToPx; // PDFと同じ線の太さ (1mm)
      
      // 枠線の範囲（PNG: 端から端まで、JPG: 余白内）
      const frameX = marginPx;
      const frameY = marginPx;
      const frameWidth = imageWidth - (marginPx * 2);
      const frameHeight = imageHeight - (marginPx * 2);
      
      ctx.strokeRect(frameX, frameY, frameWidth, frameHeight);
      
      console.log('オレンジ色枠線を画像に追加:', {
        color: '#e26b0a',
        lineWidth: 1 * mmToPx,
        format: format,
        margin: marginPx,
        frame: { x: frameX, y: frameY, width: frameWidth, height: frameHeight },
        imageSize: { width: imageWidth, height: imageHeight }
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
  },
  // Excel貼り付け用: 装飾なし（ヘッダー・ロゴ・枠線なし）の図面のみを Blob として返す
  // PDF/画像と同じく原点中心の固定範囲（34×44マス）をキャプチャ。アスペクト比は保持。
  async renderDrawingToBlob({ widthGridUnits = 34, heightGridUnits = 44, withGrid = true } = {}) {
    const captureWidth = widthGridUnits * this.gridSize;
    const captureHeight = heightGridUnits * this.gridSize;
    const startX = -captureWidth / 2;
    const startY = -captureHeight / 2;

    // アスペクト比を保ったまま 4096 以内に収める
    const maxSize = 4096;
    const pixelScale = Math.min(1, maxSize / Math.max(captureWidth, captureHeight));
    const safeWidth = Math.round(captureWidth * pixelScale);
    const safeHeight = Math.round(captureHeight * pixelScale);

    const canvas = document.createElement('canvas');
    canvas.width = safeWidth;
    canvas.height = safeHeight;
    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 白背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, safeWidth, safeHeight);

    // 世界座標 → ピクセル のスケーリング（縦横同じ倍率）
    ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);

    if (withGrid) {
      this.drawGridOnContext(ctx, captureWidth, captureHeight);
    }
    this.redrawPathsOnContext(ctx, startX, startY, captureWidth, captureHeight);

    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
    });
  },
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
    
    // PDFと同じ太い線を描画（#99ccff色、6mm太さ）
    const lineThicknessMm = 6; // 12mmから6mmに変更
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
  },
  // 画像にロゴを描画（PDFと同じ）
  async drawImageLogo(ctx, marginPx, headerHeightPx, mmToPx, imageWidth, imageHeight, format = 'jpg') {
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
      
      // A4フルサイズ基準で配置（PNG/JPG共通）
      const a4WidthMm = 210;
      const a4HeightMm = 297;
      const edgeMarginMm = format === 'png' ? 5 : 10; // PNG: 端から5mm、JPG: 端から10mm
      
      // 右下配置：右端からedgeMarginMm、下端からedgeMarginMm
      const logoXMm = a4WidthMm - edgeMarginMm - (logoHeightMm * aspectRatio);
      const logoYMm = a4HeightMm - edgeMarginMm - logoHeightMm;
      
      // mm → px 変換
      const logoX = logoXMm * mmToPx;
      const logoY = logoYMm * mmToPx;
      
      // キャンバスにロゴを描画
      ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
      
      console.log(`ロゴ画像を画像に追加しました（${format}形式、右下端配置）:`, {
        format: format,
        logoSize: { width: logoWidth, height: logoHeight },
        logoPosition: { x: logoX, y: logoY },
        logoPositionMm: { x: logoXMm, y: logoYMm }
      });
      
    } catch (error) {
      console.warn('ロゴ画像の読み込みに失敗:', error.message);
      // エラーが発生しても画像エクスポートは続行
    }
  },
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
  },
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
  },
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
  },
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
  },
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
      
      // キャプチャ範囲：中心を合わせるために横34マスに固定（2倍に拡大、偶数）
      const captureHeightMas = 48; // 縦マス数（A4比率に近づける）
      const captureWidthMas = 34; // 横マス数（2倍、偶数、中心を0マスに）
      
      const captureWidth = captureWidthMas * this.gridSize;   
      const captureHeight = captureHeightMas * this.gridSize; 
      
      console.log('PDF キャプチャ範囲（最適化）:', {
        マス数: { width: captureWidthMas, height: captureHeightMas },
        ピクセル: { width: captureWidth, height: captureHeight },
        アスペクト比: (captureWidth / captureHeight).toFixed(3),
        PDF最適比: optimalRatio.toFixed(3)
      });
      
      // グリッドに合わせたキャプチャ開始位置（中心を0,0に）
      const halfGrid = this.gridSize / 2;
      const startX = -captureWidth / 2;  // 中心
      const startY = -captureHeight / 2; // 中心
      
      // 指定範囲をキャプチャするための一時キャンバスを作成（改善版）
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d', { 
        alpha: false, // アルファチャンネルを無効にして安定性向上
        willReadFrequently: true // 頻繁な読み取りを最適化
      });
      
      // アスペクト比を保ったままキャンバスサイズを制限
      const maxSize = 4096;
      const pixelScale = Math.min(1, maxSize / Math.max(captureWidth, captureHeight));
      const safeWidth = Math.round(captureWidth * pixelScale);
      const safeHeight = Math.round(captureHeight * pixelScale);

      tempCanvas.width = safeWidth;
      tempCanvas.height = safeHeight;

      console.log('一時キャンバス作成:', {
        requestedSize: { width: captureWidth, height: captureHeight },
        actualSize: { width: safeWidth, height: safeHeight },
        pixelScale,
        context: tempCtx ? 'OK' : 'ERROR'
      });

      try {
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, safeWidth, safeHeight);
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = 'high';
        // 世界座標 → ピクセルのスケーリング（縦横同じ倍率なのでアスペクト保持）
        tempCtx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
      } catch (canvasError) {
        console.error('キャンバス初期化エラー:', canvasError);
        throw new Error('キャンバスの初期化に失敗しました');
      }

      // グリッドとパスには「世界座標サイズ」を渡す（スケールは ctx で適用）
      try {
        this.drawGridOnContext(tempCtx, captureWidth, captureHeight);
        console.log('グリッド描画完了');
      } catch (gridError) {
        console.warn('グリッド描画エラー:', gridError);
      }

      try {
        this.redrawPathsOnContext(tempCtx, startX, startY, captureWidth, captureHeight);
        console.log('パス描画完了');
      } catch (pathError) {
        console.warn('パス描画エラー:', pathError);
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
  },
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
    
    // ヘッダー下に太い線を追加（#99ccff色、6mm）
    pdf.setDrawColor(153, 204, 255); // #99ccff (RGB: 153, 204, 255)
    pdf.setLineWidth(6); // 太い線（6mm、12mmから半分に変更）
    pdf.line(margin, margin + headerHeight, pdfWidth - margin, margin + headerHeight);
  },
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
  },
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
  },
};
