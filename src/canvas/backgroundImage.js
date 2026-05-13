// 背景画像（下絵）の制御メソッド群。
// DrawingCanvas のメソッドとして prototype に Object.assign される（mixin 形式）。
//
// 関連する状態（コンストラクタで初期化される）:
//   this.backgroundImage         : Image | null
//   this.backgroundImageOpacity  : number  (0..1)
//   this.backgroundImageScale    : number  (倍率)
//   this.backgroundImageOffsetX/Y: number  (ワールド座標オフセット)
//   this.backgroundImageRotation : number  (ラジアン)

export const backgroundImageMethods = {
  // 背景画像（下絵）の設定
  setBackgroundImage(imageUrl) {
    const img = new Image();
    img.onload = () => {
      this.backgroundImage = img;
      this.fitViewToBackgroundImage();
      console.log(`背景画像読み込み完了: ${img.naturalWidth} x ${img.naturalHeight}`);
    };
    img.onerror = (err) => {
      console.error('背景画像の読み込みに失敗:', err);
    };
    img.src = imageUrl;
  },

  clearBackgroundImage() {
    this.backgroundImage = null;
    this.resetBackgroundImageTransform();
    this.redrawCanvas();
  },

  setBackgroundImageOpacity(opacity) {
    this.backgroundImageOpacity = Math.max(0, Math.min(1, opacity));
    this.redrawCanvas();
  },

  setBackgroundImageOffset(x, y) {
    this.backgroundImageOffsetX = x;
    this.backgroundImageOffsetY = y;
    this.redrawCanvas();
  },

  setBackgroundImageScale(scale) {
    this.backgroundImageScale = Math.max(0.05, Math.min(10, scale));
    this.redrawCanvas();
  },

  setBackgroundImageRotation(radians) {
    this.backgroundImageRotation = radians;
    this.redrawCanvas();
  },

  resetBackgroundImageTransform() {
    this.backgroundImageOffsetX = 0;
    this.backgroundImageOffsetY = 0;
    this.backgroundImageScale = 1.0;
    this.backgroundImageRotation = 0;
    this.backgroundImageOpacity = 0.4;
    this.redrawCanvas();
  },

  // 背景画像が画面に収まるようスケールと位置を調整
  // 画像は原点(0,0)を中心に描画されるので、原点を画面中央に置けば画像も中央に来る
  fitViewToBackgroundImage() {
    if (!this.backgroundImage) return;

    const imgW = this.backgroundImage.naturalWidth;
    const imgH = this.backgroundImage.naturalHeight;
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;

    // 画像が90%収まるスケール（余白を確保）
    const fitScale = Math.min(canvasW / imgW, canvasH / imgH) * 0.9;
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, fitScale));

    // 原点(0,0)をキャンバス中央に → 画像も中央に来る（十字の交点と画像中心が一致）
    this.translateX = canvasW / 2;
    this.translateY = canvasH / 2;

    this.redrawCanvas();
  },
};
