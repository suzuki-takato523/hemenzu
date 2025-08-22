/**
 * ツール管理クラス
 * 描画ツールの切り替えと管理を行う
 */
export class ToolManager {
  constructor() {
    this.currentTool = 'pen';
    this.tools = {
      pen: {
        name: 'ペン',
        cursor: 'crosshair',
        mode: 'freehand'
      },
      eraser: {
        name: '消しゴム',
        cursor: 'crosshair',
        mode: 'eraser'
      },
      line: {
        name: '直線',
        cursor: 'crosshair',
        mode: 'shape'
      },
      rectangle: {
        name: '四角形',
        cursor: 'crosshair',
        mode: 'shape'
      },
      door: {
        name: '扉',
        cursor: 'crosshair',
        mode: 'shape'
      },
      stairs: {
        name: '階段',
        cursor: 'crosshair',
        mode: 'shape'
      },
      circle: {
        name: '円',
        cursor: 'crosshair',
        mode: 'shape'
      },
      'text-horizontal': {
        name: '横書きテキスト',
        cursor: 'text',
        mode: 'text'
      },
      'text-vertical': {
        name: '縦書きテキスト',
        cursor: 'text',
        mode: 'text'
      }
    };
  }

  setTool(toolName) {
    if (this.tools[toolName]) {
      this.currentTool = toolName;
      this.updateCursor();
      return true;
    }
    return false;
  }

  getCurrentTool() {
    return this.currentTool;
  }

  getToolInfo(toolName = null) {
    const tool = toolName || this.currentTool;
    return this.tools[tool];
  }

  updateCursor() {
    const canvas = document.getElementById('drawing-canvas');
    const toolInfo = this.getToolInfo();
    if (canvas && toolInfo) {
      canvas.style.cursor = toolInfo.cursor;
    }
  }

  isShapeTool() {
    const toolInfo = this.getToolInfo();
    return toolInfo && toolInfo.mode === 'shape';
  }

  isFreehandTool() {
    const toolInfo = this.getToolInfo();
    return toolInfo && toolInfo.mode === 'freehand';
  }
}
