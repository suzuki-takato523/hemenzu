// 初期画面制御クラス
class StartScreen {
  constructor() {
    this.startScreen = document.getElementById('start-screen');
    this.appElement = document.getElementById('app');
    this.initializeEventListeners();
    this.loadLastSession();
  }

  initializeEventListeners() {
    // 新規作成ボタン
    const newProjectBtn = document.getElementById('new-project-btn');
    newProjectBtn.addEventListener('click', () => {
      this.startNewProject();
    });

    // 途中から作成するボタン
    const continueProjectBtn = document.getElementById('continue-project-btn');
    continueProjectBtn.addEventListener('click', () => {
      this.continueProject();
    });

    // クイックリンク
    const manualLink = document.getElementById('manual-link');
    manualLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.showManual();
    });

    const samplesLink = document.getElementById('samples-link');
    samplesLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.showSamples();
    });

    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
      if (this.startScreen.classList.contains('hidden')) return;
      
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.startNewProject();
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        this.continueProject();
      }
    });
  }

  startNewProject() {
    console.log('新規プロジェクト開始');
    
    // 既存データをクリア
    this.clearExistingData();
    
    // 初期画面を非表示にしてメインアプリを表示
    this.hideStartScreen();
    
    // 新規プロジェクト開始のイベントを発行
    window.dispatchEvent(new CustomEvent('startNewProject'));
  }

  continueProject() {
    console.log('プロジェクト継続');
    
    // ファイル選択ダイアログを表示
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,.png,.jpg,.jpeg';
    
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        this.loadProjectFile(file);
      }
    };
    
    fileInput.click();
  }

  loadProjectFile(file) {
    const reader = new FileReader();
    
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      // JSONファイルの場合
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
    } else {
      // 画像ファイルの場合
      reader.onload = (e) => {
        this.loadImageAsBackground(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  restoreProject(projectData) {
    console.log('プロジェクト復元:', projectData);
    
    // 初期画面を非表示
    this.hideStartScreen();
    
    // プロジェクト復元のイベントを発行
    window.dispatchEvent(new CustomEvent('restoreProject', {
      detail: projectData
    }));
  }

  loadImageAsBackground(imageDataUrl) {
    console.log('背景画像として読み込み');
    
    // 初期画面を非表示
    this.hideStartScreen();
    
    // 背景画像読み込みのイベントを発行
    window.dispatchEvent(new CustomEvent('loadBackgroundImage', {
      detail: { imageUrl: imageDataUrl }
    }));
  }

  hideStartScreen() {
    this.startScreen.classList.add('hidden');
    this.appElement.style.display = 'flex';
    
    // アニメーション後に完全に削除
    setTimeout(() => {
      this.startScreen.style.display = 'none';
    }, 300);
  }

  showStartScreen() {
    this.startScreen.style.display = 'flex';
    this.startScreen.classList.remove('hidden');
    this.appElement.style.display = 'none';
  }

  clearExistingData() {
    // ローカルストレージのデータをクリア
    localStorage.removeItem('floorplan-autosave');
    localStorage.removeItem('floorplan-paths');
    localStorage.removeItem('floorplan-settings');
  }

  loadLastSession() {
    // 最後のセッションがあるかチェック
    const lastSession = localStorage.getItem('floorplan-autosave');
    const continueBtn = document.getElementById('continue-project-btn');
    
    if (lastSession) {
      try {
        const sessionData = JSON.parse(lastSession);
        if (sessionData.paths && sessionData.paths.length > 0) {
          // データがある場合は「途中から作成する」ボタンを強調
          continueBtn.querySelector('.option-content h3').textContent = '前回の続きから';
          continueBtn.querySelector('.option-content p').textContent = '前回の作業を復元して続きを作成';
          continueBtn.classList.add('has-data');
        }
      } catch (error) {
        console.log('前回のセッションデータが無効:', error);
      }
    } else {
      // データがない場合
      continueBtn.querySelector('.option-content p').textContent = 'ファイルを読み込んで続きを作成';
    }
  }

  showManual() {
    // マニュアルを新しいタブで開く
    window.open('./USER_MANUAL.md', '_blank');
  }

  showSamples() {
    console.log('サンプル表示');
    
    // サンプルデータを表示するモーダルを作成
    this.showSampleModal();
  }

  showSampleModal() {
    const modal = document.createElement('div');
    modal.className = 'sample-modal';
    modal.innerHTML = `
      <div class="sample-modal-content">
        <div class="sample-modal-header">
          <h3>📋 サンプル平面図</h3>
          <button class="close-btn">&times;</button>
        </div>
        <div class="sample-grid">
          <div class="sample-item" data-sample="living-room">
            <div class="sample-preview">🏠</div>
            <h4>リビング</h4>
            <p>基本的なリビングルームのレイアウト</p>
          </div>
          <div class="sample-item" data-sample="bedroom">
            <div class="sample-preview">🛏️</div>
            <h4>寝室</h4>
            <p>寝室とクローゼットの配置例</p>
          </div>
          <div class="sample-item" data-sample="kitchen">
            <div class="sample-preview">🍳</div>
            <h4>キッチン</h4>
            <p>L字型キッチンのレイアウト</p>
          </div>
          <div class="sample-item" data-sample="office">
            <div class="sample-preview">💼</div>
            <h4>オフィス</h4>
            <p>小規模オフィスの間取り例</p>
          </div>
        </div>
      </div>
    `;

    // モーダルを追加
    document.body.appendChild(modal);

    // イベントリスナー
    modal.querySelector('.close-btn').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });

    // サンプル選択
    modal.querySelectorAll('.sample-item').forEach(item => {
      item.addEventListener('click', () => {
        const sampleType = item.dataset.sample;
        this.loadSample(sampleType);
        document.body.removeChild(modal);
      });
    });
  }

  loadSample(sampleType) {
    console.log('サンプル読み込み:', sampleType);
    
    // サンプルデータを生成
    const sampleData = this.generateSampleData(sampleType);
    
    // 初期画面を非表示
    this.hideStartScreen();
    
    // サンプル読み込みのイベントを発行
    window.dispatchEvent(new CustomEvent('loadSample', {
      detail: { sampleType, data: sampleData }
    }));
  }

  generateSampleData(sampleType) {
    // サンプルデータの生成（実際のパスデータ）
    const samples = {
      'living-room': {
        paths: [
          { tool: 'rect', startPoint: { x: 100, y: 100 }, endPoint: { x: 400, y: 300 }, strokeWidth: 4, strokeColor: '#000000' },
          { tool: 'line', startPoint: { x: 100, y: 200 }, endPoint: { x: 250, y: 200 }, strokeWidth: 2, strokeColor: '#000000' },
          { tool: 'door', x: 250, y: 100, width: 80, height: 8, doorType: 'opening' }
        ],
        settings: { gridSize: 160, scale: 1.0, offsetX: 0, offsetY: 0 }
      },
      'bedroom': {
        paths: [
          { tool: 'rect', startPoint: { x: 120, y: 120 }, endPoint: { x: 360, y: 280 }, strokeWidth: 4, strokeColor: '#000000' },
          { tool: 'rect', startPoint: { x: 280, y: 120 }, endPoint: { x: 360, y: 200 }, strokeWidth: 2, strokeColor: '#666666' },
          { tool: 'door', x: 200, y: 280, width: 80, height: 8, doorType: 'hinged-right' }
        ],
        settings: { gridSize: 160, scale: 1.0, offsetX: 0, offsetY: 0 }
      },
      'kitchen': {
        paths: [
          { tool: 'rect', startPoint: { x: 80, y: 80 }, endPoint: { x: 320, y: 240 }, strokeWidth: 4, strokeColor: '#000000' },
          { tool: 'line', startPoint: { x: 80, y: 160 }, endPoint: { x: 200, y: 160 }, strokeWidth: 3, strokeColor: '#444444' },
          { tool: 'line', startPoint: { x: 200, y: 160 }, endPoint: { x: 200, y: 80 }, strokeWidth: 3, strokeColor: '#444444' }
        ],
        settings: { gridSize: 160, scale: 1.0, offsetX: 0, offsetY: 0 }
      },
      'office': {
        paths: [
          { tool: 'rect', startPoint: { x: 60, y: 60 }, endPoint: { x: 420, y: 320 }, strokeWidth: 4, strokeColor: '#000000' },
          { tool: 'line', startPoint: { x: 240, y: 60 }, endPoint: { x: 240, y: 200 }, strokeWidth: 2, strokeColor: '#000000' },
          { tool: 'door', x: 300, y: 320, width: 80, height: 8, doorType: 'hinged-left' },
          { tool: 'door', x: 60, y: 150, width: 8, height: 80, doorType: 'opening' }
        ],
        settings: { gridSize: 160, scale: 1.0, offsetX: 0, offsetY: 0 }
      }
    };

    return samples[sampleType] || samples['living-room'];
  }

  showError(message) {
    // エラーメッセージを表示
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

// スタートスクリーンの初期化
document.addEventListener('DOMContentLoaded', () => {
  window.startScreen = new StartScreen();
});

export default StartScreen;
