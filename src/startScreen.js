export default class StartScreen {
  constructor() {
    this.startScreen = document.getElementById('start-screen');
    this.appElement = document.getElementById('app');
    this.initializeEventListeners();
    this.loadLastSession();
  }

  initializeEventListeners() {
    // 新規作成ボタン
    const newProjectBtn = document.getElementById('new-project-btn');
    if (newProjectBtn) {
      newProjectBtn.addEventListener('click', () => {
        this.startNewProject();
      });
    }

    // 継続ボタン
    const continueProjectBtn = document.getElementById('continue-project-btn');
    if (continueProjectBtn) {
      continueProjectBtn.addEventListener('click', () => {
        this.continueProject();
      });
    }

    // マニュアルリンク
    const manualLink = document.getElementById('manual-link');
    if (manualLink) {
      manualLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showManual();
      });
    }

    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
      if (this.startScreen && !this.startScreen.classList.contains('hidden')) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.startNewProject();
        } else if (e.key === 'o' || e.key === 'O') {
          e.preventDefault();
          this.continueProject();
        }
      }
    });
  }

  startNewProject() {
    console.log('新規プロジェクト開始');
    this.clearExistingData();
    this.hideStartScreen();
    window.dispatchEvent(new CustomEvent('startNewProject'));
  }

  continueProject() {
    console.log('プロジェクト継続: ファイル選択ダイアログを開きます');
    const input = document.createElement('input');
    input.type = 'file';
    // accept は MIME と拡張子の両方を指定（OS/ブラウザによる差異対策）
    input.accept = 'application/json,application/pdf,image/png,image/jpeg,.json,.pdf,.png,.jpg,.jpeg';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        console.log(`ファイル選択: name=${file.name}, type=${file.type}, size=${file.size}`);
        this.loadProjectFile(file);
      } else {
        console.log('ファイルが選択されませんでした');
      }
    };
    input.click();
  }

  loadProjectFile(file) {
    const fileName = file.name.toLowerCase();

    if (file.type === 'application/json' || fileName.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const projectData = JSON.parse(e.target.result);
          this.restoreProject(projectData);
        } catch (error) {
          console.error('プロジェクトファイルの読み込みに失敗:', error);
          this.showError('プロジェクトファイルの形式が正しくありません。');
        }
      };
      reader.readAsText(file);
    } else if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
      this.loadPdfAsBackground(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.loadImageAsBackground(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  async loadPdfAsBackground(file) {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);

      // 解像度を上げて鮮明な下絵にする
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

      const dataUrl = canvas.toDataURL('image/png');
      this.loadImageAsBackground(dataUrl);
    } catch (error) {
      console.error('PDFの読み込みに失敗:', error);
      this.showError('PDFの読み込みに失敗しました。');
    }
  }

  restoreProject(projectData) {
    console.log('プロジェクト復元:', projectData);
    this.hideStartScreen();
    window.dispatchEvent(new CustomEvent('restoreProject', { detail: projectData }));
  }

  loadImageAsBackground(imageUrl) {
    console.log('背景画像として読み込み');
    this.hideStartScreen();
    window.dispatchEvent(new CustomEvent('loadBackgroundImage', { detail: { imageUrl } }));
  }

  hideStartScreen() {
    if (this.startScreen) {
      this.startScreen.style.display = 'none';
    }
    if (this.appElement) {
      this.appElement.style.display = 'flex';
    }
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.style.display = 'flex';
    }
  }

  showStartScreen() {
    if (this.startScreen) {
      this.startScreen.style.display = 'flex';
    }
    if (this.appElement) {
      this.appElement.style.display = 'none';
    }
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.style.display = 'none';
    }
  }

  clearExistingData() {
    localStorage.removeItem('floorplan-autosave');
    localStorage.removeItem('floorplan-paths');
    localStorage.removeItem('floorplan-settings');
  }

  loadLastSession() {
    const autosaveData = localStorage.getItem('floorplan-autosave');
    const continueBtn = document.getElementById('continue-project-btn');
    
    if (!continueBtn) {
      console.warn('continue-project-btn要素が見つかりません');
      return;
    }

    if (autosaveData) {
      try {
        const savedData = JSON.parse(autosaveData);
        if (savedData.paths && savedData.paths.length > 0) {
          // タイトルと説明を更新
          const titleElement = continueBtn.querySelector('.option-content h3');
          const descElement = continueBtn.querySelector('.option-content p');
          
          if (titleElement) {
            titleElement.textContent = '前回の続きから';
          }
          if (descElement) {
            descElement.textContent = '前回の作業を復元して続きを作成';
          }
          continueBtn.classList.add('has-data');
        }
      } catch (error) {
        console.log('前回のセッションデータが無効:', error);
      }
    } else {
      // タイトルはそのまま、説明を更新
      const descElement = continueBtn.querySelector('.option-content p');
      if (descElement) {
        descElement.textContent = 'ファイルを読み込んで続きを作成';
      }
    }
  }

  showManual() {
    window.open('./manual.html', '_blank');
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ff4757;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      z-index: 2000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      if (errorDiv.parentNode) {
        document.body.removeChild(errorDiv);
      }
    }, 3000);
  }
}

// スタートスクリーンを初期化
document.addEventListener('DOMContentLoaded', () => {
  window.startScreen = new StartScreen();
});
