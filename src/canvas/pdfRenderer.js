// PDF/画像/Excel 出力時に、別Canvasコンテキストへ描画するための一連のメソッド群。
// すべて DrawingCanvas のメソッドとして prototype に Object.assign される（mixin 形式）。
// このため this はインスタンス（this.allPaths / this.gridSize / this.getBackgroundColor 等）を指す。

export const pdfRendererMethods = {
  // 指定されたコンテキストにグリッド線を描画（PDF用・正方形グリッド確保）
  drawGridOnContext(ctx, width, height) {
    if (!this.snapToGrid) return;

    ctx.save();

    // PDF用のグリッドサイズを正方形に保つ（確実に160px）
    const pdfGridSize = 160;

    // 0.25マスのドット（40px間隔）
    ctx.fillStyle = '#cccccc';
    for (let x = pdfGridSize / 4; x < width; x += pdfGridSize / 4) {
      for (let y = pdfGridSize / 4; y < height; y += pdfGridSize / 4) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 0.5マス: ごく薄い細い実線（サブグリッド）
    ctx.strokeStyle = '#ececec';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([]);
    for (let x = pdfGridSize / 2; x < width; x += pdfGridSize / 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = pdfGridSize / 2; y < height; y += pdfGridSize / 2) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 1マス: 中庸の実線（主グリッド）
    ctx.strokeStyle = '#bbbbbb';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    for (let x = pdfGridSize; x < width; x += pdfGridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = pdfGridSize; y < height; y += pdfGridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 中心線（正方形グリッドに合わせて配置）
    const centerX = Math.floor(width / 2 / pdfGridSize) * pdfGridSize;
    const centerY = Math.floor(height / 2 / pdfGridSize) * pdfGridSize;

    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 3;

    if (centerX > 0 && centerX < width) {
      ctx.beginPath();
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, height);
      ctx.stroke();
    }

    if (centerY > 0 && centerY < height) {
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
    }

    ctx.restore();
  },

  // 指定されたコンテキストにすべてのパスを再描画
  redrawPathsOnContext(ctx, offsetX, offsetY, width, height) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();

    for (let i = 0; i < this.allPaths.length; i++) {
      const pathData = this.allPaths[i];
      try {
        this.drawPathOnContext(ctx, pathData, offsetX, offsetY);
      } catch (error) {
        console.error(`パス${i}描画エラー:`, error);
      }
    }
    ctx.restore();
  },

  // パスが指定範囲内にあるかチェック
  isPathInRange(pathData, offsetX, offsetY, width, height) {
    if (!pathData) return false;

    const rangeRight = offsetX + width;
    const rangeBottom = offsetY + height;

    if (pathData.type === 'freehand' && pathData.points) {
      return pathData.points.some(point =>
        point.x >= offsetX && point.x <= rangeRight &&
        point.y >= offsetY && point.y <= rangeBottom
      );
    } else if (pathData.startPoint && pathData.endPoint) {
      return (
        (pathData.startPoint.x >= offsetX && pathData.startPoint.x <= rangeRight &&
         pathData.startPoint.y >= offsetY && pathData.startPoint.y <= rangeBottom) ||
        (pathData.endPoint.x >= offsetX && pathData.endPoint.x <= rangeRight &&
         pathData.endPoint.y >= offsetY && pathData.endPoint.y <= rangeBottom)
      );
    }
    return false;
  },

  // 指定されたコンテキストに単一のパスを描画
  drawPathOnContext(ctx, pathData, offsetX, offsetY) {
    ctx.save();

    ctx.strokeStyle = pathData.strokeColor || pathData.color || '#000000';
    ctx.lineWidth = pathData.strokeWidth || pathData.lineWidth || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (pathData.tool === 'pen' && pathData.path) {
      ctx.beginPath();
      if (pathData.path.length > 0) {
        ctx.moveTo(pathData.path[0].x - offsetX, pathData.path[0].y - offsetY);
        for (let i = 1; i < pathData.path.length; i++) {
          ctx.lineTo(pathData.path[i].x - offsetX, pathData.path[i].y - offsetY);
        }
      }
      ctx.stroke();
    } else if (pathData.tool === 'line' && pathData.startPoint && pathData.endPoint) {
      const x1 = pathData.startPoint.x - offsetX;
      const y1 = pathData.startPoint.y - offsetY;
      const x2 = pathData.endPoint.x - offsetX;
      const y2 = pathData.endPoint.y - offsetY;

      const lineStyle = pathData.lineStyle || (pathData.isDashed ? 'dashed' : (pathData.hasArrow ? 'arrow' : 'solid'));

      if (lineStyle === 'dashed' || pathData.isDashed) {
        ctx.save();
        const dashLength = 20;
        const gapLength = 15;
        ctx.setLineDash([dashLength, gapLength]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      } else if (lineStyle === 'arrow' || pathData.hasArrow) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        this.drawArrowHeadOnContext(ctx, x1, y1, x2, y2);
      } else {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    } else if (pathData.tool === 'rectangle' && pathData.startPoint && pathData.endPoint) {
      ctx.beginPath();
      ctx.rect(pathData.startPoint.x - offsetX, pathData.startPoint.y - offsetY,
               pathData.endPoint.x - pathData.startPoint.x,
               pathData.endPoint.y - pathData.startPoint.y);
      ctx.stroke();
    } else if (pathData.tool === 'circle' && pathData.startPoint && pathData.endPoint) {
      const centerX = (pathData.startPoint.x + pathData.endPoint.x) / 2 - offsetX;
      const centerY = (pathData.startPoint.y + pathData.endPoint.y) / 2 - offsetY;
      const radius = Math.sqrt(
        Math.pow(pathData.endPoint.x - pathData.startPoint.x, 2) +
        Math.pow(pathData.endPoint.y - pathData.startPoint.y, 2)
      ) / 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (pathData.tool === 'door' && pathData.startPoint && pathData.endPoint) {
      if (!pathData.doorType) {
        pathData.doorType = 'single';
      }
      ctx.save();
      const adjustedStart = { x: pathData.startPoint.x - offsetX, y: pathData.startPoint.y - offsetY };
      const adjustedEnd = { x: pathData.endPoint.x - offsetX, y: pathData.endPoint.y - offsetY };
      this.drawDoorOnContext(ctx, adjustedStart, adjustedEnd, pathData);
      ctx.restore();
    } else if (pathData.tool === 'stairs' && pathData.startPoint && pathData.endPoint) {
      ctx.save();
      const adjustedStart = { x: pathData.startPoint.x - offsetX, y: pathData.startPoint.y - offsetY };
      const adjustedEnd = { x: pathData.endPoint.x - offsetX, y: pathData.endPoint.y - offsetY };
      this.drawStairsOnContext(ctx, adjustedStart, adjustedEnd, pathData);
      ctx.restore();
    } else if (pathData.tool === 'polyline-grid' && pathData.path) {
      ctx.beginPath();
      if (pathData.path.length > 0) {
        ctx.moveTo(pathData.path[0].x - offsetX, pathData.path[0].y - offsetY);
        for (let i = 1; i < pathData.path.length; i++) {
          ctx.lineTo(pathData.path[i].x - offsetX, pathData.path[i].y - offsetY);
        }
      }
      ctx.stroke();
    } else if (pathData.tool === 'textbox' && pathData.x && pathData.y) {
      ctx.save();
      const adjustedX = pathData.x - offsetX;
      const adjustedY = pathData.y - offsetY;
      this.drawTextBoxOnContext(ctx, adjustedX, adjustedY, pathData);
      ctx.restore();
    } else if (pathData.tool === 'fill') {
      const pattern = pathData.fillPattern || 'solid';
      if (pathData.positions) {
        pathData.positions.forEach(pos => {
          const posPattern = pos.pattern || pattern;
          const adjustedX = pos.x - offsetX;
          const adjustedY = pos.y - offsetY;

          if (posPattern === 'diagonal') {
            ctx.save();
            ctx.fillStyle = pathData.strokeColor + '20';
            ctx.fillRect(adjustedX, adjustedY, pos.size, pos.size);
            ctx.beginPath();
            ctx.rect(adjustedX, adjustedY, pos.size, pos.size);
            ctx.clip();
            ctx.strokeStyle = pathData.strokeColor;
            ctx.lineWidth = 2;
            const spacing = 16;
            ctx.beginPath();
            for (let offset = -pos.size; offset < pos.size * 2; offset += spacing) {
              ctx.moveTo(adjustedX + offset, adjustedY);
              ctx.lineTo(adjustedX + offset + pos.size, adjustedY + pos.size);
            }
            ctx.stroke();
            ctx.restore();

            ctx.strokeStyle = pathData.strokeColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(adjustedX, adjustedY, pos.size, pos.size);
          } else {
            ctx.fillStyle = pathData.strokeColor;
            ctx.fillRect(adjustedX, adjustedY, pos.size, pos.size);
          }
        });
      }
    } else if (pathData.type === 'line' && pathData.startPoint && pathData.endPoint) {
      // 旧形式との互換性
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
  },

  // PDF用扉描画
  drawDoorOnContext(ctx, start, end, pathData) {
    ctx.lineWidth = pathData.strokeWidth || 2;
    ctx.strokeStyle = pathData.strokeColor || '#000000';

    const doorType = pathData.doorType || 'single';
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const fixedDoorWidth = 80; // 0.5マス（gridSize=160pxの0.5倍）

    let doorStart, doorEnd, direction;
    if (Math.abs(dx) > Math.abs(dy)) {
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
      if (dy > 0) {
        direction = 'vertical-down';
        doorStart = { x: start.x, y: start.y };
        doorEnd = { x: start.x, y: start.y + fixedDoorWidth };
      } else {
        direction = 'vertical-up';
        doorStart = { x: start.x, y: start.y };
        doorEnd = { x: start.x, y: start.y - fixedDoorWidth };
      }
    }

    const perpDx = direction.startsWith('horizontal') ? 0 : 1;
    const perpDy = direction.startsWith('vertical') ? 0 : 1;

    switch (doorType) {
      case 'single':
        this.drawSingleDoorOnContext(ctx, doorStart, doorEnd, perpDx, perpDy, fixedDoorWidth, 'right');
        break;
      case 'double':
        this.drawDoubleDoorOnContext(ctx, doorStart, doorEnd, perpDx, perpDy, fixedDoorWidth);
        break;
      case 'smallbox':
        this.drawSmallBoxOnContext(ctx, doorStart, doorEnd, pathData.openingSize);
        break;
      case 'circle':
        this.drawCircleSymbolOnContext(ctx, doorStart, doorEnd);
        break;
      case 'square':
        this.drawSquareSymbolOnContext(ctx, doorStart, doorEnd);
        break;
      case 'cross':
        this.drawCrossSymbolOnContext(ctx, doorStart, doorEnd);
        break;
      case 'single-left':
        this.drawSingleDoorOnContext(ctx, doorStart, doorEnd, perpDx, perpDy, fixedDoorWidth, 'left');
        break;
      case 'single-right':
        this.drawSingleDoorOnContext(ctx, doorStart, doorEnd, perpDx, perpDy, fixedDoorWidth, 'right');
        break;
      default:
        this.drawSingleDoorOnContext(ctx, doorStart, doorEnd, perpDx, perpDy, fixedDoorWidth);
        break;
    }
  },

  // PDF用片開き扉描画
  drawSingleDoorOnContext(ctx, start, end, perpDx, perpDy, width, direction) {
    const intStart = { x: Math.floor(start.x), y: Math.floor(start.y) };
    const intEnd = { x: Math.floor(end.x), y: Math.floor(end.y) };

    // 壁を背景色で上書き（開口部表現）
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = this.getBackgroundColor();
    ctx.beginPath();
    ctx.moveTo(intStart.x, intStart.y);
    ctx.lineTo(intEnd.x, intEnd.y);
    ctx.stroke();

    ctx.lineWidth = 6;
    ctx.strokeStyle = this.getBackgroundColor();
    ctx.beginPath();
    ctx.moveTo(intStart.x, intStart.y);
    ctx.lineTo(intEnd.x, intEnd.y);
    ctx.stroke();
    ctx.restore();

    const hingePoint = direction === 'left' ? intEnd : intStart;
    const radius = width;
    const baseAngle = Math.atan2(intEnd.y - intStart.y, intEnd.x - intStart.x);

    let openAngle;
    if (direction === 'left') {
      openAngle = baseAngle + Math.PI / 2;
    } else {
      openAngle = baseAngle - Math.PI / 2;
    }

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.arc(hingePoint.x, hingePoint.y, radius,
             Math.min(baseAngle, openAngle),
             Math.max(baseAngle, openAngle));
    ctx.stroke();
    ctx.restore();

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
  },

  // PDF用両開き扉描画
  drawDoubleDoorOnContext(ctx, start, end, perpDx, perpDy, width) {
    const intStart = { x: Math.floor(start.x), y: Math.floor(start.y) };
    const intEnd = { x: Math.floor(end.x), y: Math.floor(end.y) };

    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = this.getBackgroundColor();
    ctx.beginPath();
    ctx.moveTo(intStart.x, intStart.y);
    ctx.lineTo(intEnd.x, intEnd.y);
    ctx.stroke();
    ctx.restore();

    const midX = Math.floor((intStart.x + intEnd.x) / 2);
    const midY = Math.floor((intStart.y + intEnd.y) / 2);
    const halfWidth = width / 2;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    const markSize = 4;
    ctx.moveTo(midX + perpDx * markSize, midY + perpDy * markSize);
    ctx.lineTo(midX - perpDx * markSize, midY - perpDy * markSize);
    ctx.stroke();
    ctx.restore();

    const baseAngle = Math.atan2(intEnd.y - intStart.y, intEnd.x - intStart.x);
    const radius = halfWidth;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    const leftOpenAngle = baseAngle - Math.PI / 2;
    ctx.arc(intStart.x, intStart.y, radius,
             Math.min(baseAngle, leftOpenAngle),
             Math.max(baseAngle, leftOpenAngle));
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    const leftDoorX = Math.floor(intStart.x + Math.cos(leftOpenAngle) * radius);
    const leftDoorY = Math.floor(intStart.y + Math.sin(leftOpenAngle) * radius);
    ctx.moveTo(intStart.x, intStart.y);
    ctx.lineTo(leftDoorX, leftDoorY);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    const rightBaseAngle = baseAngle + Math.PI;
    const rightOpenAngle = rightBaseAngle + Math.PI / 2;
    ctx.arc(intEnd.x, intEnd.y, radius,
             Math.min(rightBaseAngle, rightOpenAngle),
             Math.max(rightBaseAngle, rightOpenAngle));
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    const rightDoorX = Math.floor(intEnd.x + Math.cos(rightOpenAngle) * radius);
    const rightDoorY = Math.floor(intEnd.y + Math.sin(rightOpenAngle) * radius);
    ctx.moveTo(intEnd.x, intEnd.y);
    ctx.lineTo(rightDoorX, rightDoorY);
    ctx.stroke();
    ctx.restore();
  },

  // PDF用開口部描画
  drawSmallBoxOnContext(ctx, start, end, openingSize = 'half') {
    let sizeMultiplier;
    switch (openingSize) {
      case 'quarter': sizeMultiplier = 0.25; break;
      case 'one': sizeMultiplier = 1; break;
      default: sizeMultiplier = 0.5;
    }
    const boxSize = this.gridSize * sizeMultiplier;
    const boxX = Math.floor(start.x);
    const boxY = Math.floor(start.y);

    ctx.save();
    ctx.fillStyle = 'rgba(100, 150, 255, 0.3)';
    ctx.fillRect(boxX, boxY, boxSize, boxSize);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#4080ff';
    ctx.strokeRect(boxX, boxY, boxSize, boxSize);
    ctx.restore();
  },

  drawCircleSymbolOnContext(ctx, start, end) {
    const size = this.gridSize / 2;
    const centerX = start.x + size / 2;
    const centerY = start.y + size / 2;
    const radius = size / 2;

    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  drawSquareSymbolOnContext(ctx, start, end) {
    const size = this.gridSize / 2;

    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(start.x, start.y, size, size);
    ctx.restore();
  },

  drawCrossSymbolOnContext(ctx, start, end) {
    const size = this.gridSize / 2;

    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(start.x + size, start.y + size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(start.x + size, start.y);
    ctx.lineTo(start.x, start.y + size);
    ctx.stroke();

    ctx.restore();
  },

  drawStairsOnContext(ctx, start, end, pathData) {
    ctx.lineWidth = pathData.strokeWidth || 2;
    ctx.strokeStyle = pathData.strokeColor || '#000000';

    const stairSteps = pathData.stairSteps || 10;
    const stairWidth = pathData.stairWidth || this.gridSize;
    const stairType = pathData.stairType || 'straight';

    if (stairType === 'l-shape') {
      this.drawLShapeStairsOnContext(ctx, start, end, pathData);
      return;
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return;

    const unitX = dx / length;
    const unitY = dy / length;
    const perpX = -unitY;
    const perpY = unitX;
    const halfWidth = stairWidth / 2;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

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
  },

  drawLShapeStairsOnContext(ctx, start, end, pathData) {
    ctx.save();
    ctx.lineWidth = pathData.strokeWidth || 2;
    ctx.strokeStyle = pathData.strokeColor || '#000000';

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    let isHorizontalFirst;
    if (pathData.isHorizontalFirst !== undefined) {
      isHorizontalFirst = pathData.isHorizontalFirst;
    } else {
      isHorizontalFirst = absDx >= absDy;
    }

    const corner = isHorizontalFirst ? { x: end.x, y: start.y } : { x: start.x, y: end.y };

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(corner.x, corner.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(corner.x, corner.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    const arrowLength = 20;
    let angle;
    if (isHorizontalFirst) {
      angle = Math.atan2(end.y - corner.y, 0);
    } else {
      angle = Math.atan2(0, end.x - corner.x);
    }
    const arrowAngle = Math.PI / 6;

    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - arrowLength * Math.cos(angle - arrowAngle),
      end.y - arrowLength * Math.sin(angle - arrowAngle)
    );
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - arrowLength * Math.cos(angle + arrowAngle),
      end.y - arrowLength * Math.sin(angle + arrowAngle)
    );
    ctx.stroke();

    const stairWidth = pathData.stairWidth || this.gridSize;
    const halfWidth = stairWidth / 2;
    const diagonalLength = halfWidth * 1.4;
    const signX = dx >= 0 ? 1 : -1;
    const signY = dy >= 0 ? 1 : -1;

    if (isHorizontalFirst) {
      ctx.beginPath();
      ctx.moveTo(corner.x - signX * diagonalLength * 0.7, corner.y + signY * diagonalLength * 0.7);
      ctx.lineTo(corner.x + signX * diagonalLength * 0.7, corner.y - signY * diagonalLength * 0.7);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(corner.x + signX * diagonalLength * 0.7, corner.y - signY * diagonalLength * 0.7);
      ctx.lineTo(corner.x - signX * diagonalLength * 0.7, corner.y + signY * diagonalLength * 0.7);
      ctx.stroke();
    }

    const stairSteps = pathData.stairSteps || 10;
    const stepsPerSegment = Math.floor(stairSteps / 2);
    const cornerMargin = stairWidth * 0.6;

    if (isHorizontalFirst) {
      const length1 = Math.abs(corner.x - start.x);
      if (length1 > 0) {
        for (let i = 1; i <= stepsPerSegment; i++) {
          const t = i / (stepsPerSegment + 1);
          const x = start.x + (corner.x - start.x) * t;
          const y = start.y;
          if (Math.abs(x - corner.x) > cornerMargin) {
            ctx.beginPath();
            ctx.moveTo(x, y - halfWidth);
            ctx.lineTo(x, y + halfWidth);
            ctx.stroke();
          }
        }
      }

      const length2 = Math.abs(end.y - corner.y);
      if (length2 > 0) {
        for (let i = 1; i <= stepsPerSegment; i++) {
          const t = i / (stepsPerSegment + 1);
          const x = corner.x;
          const y = corner.y + (end.y - corner.y) * t;
          if (Math.abs(y - corner.y) > cornerMargin) {
            ctx.beginPath();
            ctx.moveTo(x - halfWidth, y);
            ctx.lineTo(x + halfWidth, y);
            ctx.stroke();
          }
        }
      }
    } else {
      const length1 = Math.abs(corner.y - start.y);
      if (length1 > 0) {
        for (let i = 1; i <= stepsPerSegment; i++) {
          const t = i / (stepsPerSegment + 1);
          const x = start.x;
          const y = start.y + (corner.y - start.y) * t;
          if (Math.abs(y - corner.y) > cornerMargin) {
            ctx.beginPath();
            ctx.moveTo(x - halfWidth, y);
            ctx.lineTo(x + halfWidth, y);
            ctx.stroke();
          }
        }
      }

      const length2 = Math.abs(end.x - corner.x);
      if (length2 > 0) {
        for (let i = 1; i <= stepsPerSegment; i++) {
          const t = i / (stepsPerSegment + 1);
          const x = corner.x + (end.x - corner.x) * t;
          const y = corner.y;
          if (Math.abs(x - corner.x) > cornerMargin) {
            ctx.beginPath();
            ctx.moveTo(x, y - halfWidth);
            ctx.lineTo(x, y + halfWidth);
            ctx.stroke();
          }
        }
      }
    }

    ctx.restore();
  },

  // PDF用テキストボックス描画
  drawTextBoxOnContext(ctx, x, y, pathData) {
    let width = pathData.width || 100;
    let height = pathData.height || 40;
    const text = pathData.text || '';
    const fontSize = pathData.fontSize || 14;
    const fontFamily = pathData.fontFamily || 'Arial, sans-serif';
    const isVertical = pathData.isVertical || false;
    const padding = Math.max(4, fontSize * 0.2);
    const lineHeight = fontSize * 1.3;

    ctx.font = `${fontSize}px ${fontFamily}`;

    // テキストサイズに合わせてボックスサイズを調整
    if (text && text.trim()) {
      if (isVertical) {
        const inputLines = text.split('\n');
        let maxLineLength = 0;
        for (let inputLine of inputLines) {
          maxLineLength = Math.max(maxLineLength, inputLine.length);
        }
        const totalColumns = inputLines.length;
        const textHeight = maxLineLength * fontSize + padding * 2;
        const textWidth = totalColumns * fontSize * 1.2 + padding * 2;
        if (height < textHeight) height = textHeight;
        if (width < textWidth) width = textWidth;
      } else {
        const inputLines = text.split('\n');
        let allLines = [];
        let maxLineWidth = 0;

        for (let inputLine of inputLines) {
          if (inputLine === '') {
            allLines.push('');
            continue;
          }
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

    if (text) {
      ctx.fillStyle = pathData.textColor || pathData.strokeColor || '#000000';
      ctx.font = `${fontSize}px ${fontFamily}`;

      if (isVertical) {
        this.drawVerticalTextPDF(ctx, text, x, y, width, height, fontSize, padding);
      } else {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const inputLines = text.split('\n');
        let allLines = [];
        for (let inputLine of inputLines) {
          if (inputLine === '') {
            allLines.push('');
            continue;
          }
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

        const totalTextHeight = allLines.length * lineHeight;
        const startY = y + (height - totalTextHeight) / 2 + fontSize / 2;

        allLines.forEach((lineText, index) => {
          const textX = x + padding;
          const textY = startY + (index * lineHeight);
          if (textY - fontSize / 2 >= y && textY + fontSize / 2 <= y + height) {
            ctx.fillText(lineText, textX, textY);
          }
        });
      }
    }
  },

  // PDF用縦書きテキスト描画（完全中央配置）
  drawVerticalTextPDF(ctx, text, x, y, width, height, fontSize, padding = 5) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const inputLines = text.split('\n');
    const totalColumns = inputLines.length;
    const columnSpacing = fontSize * 1.2;
    const totalTextWidth = totalColumns * columnSpacing;
    const maxLineLength = Math.max(...inputLines.map(line => line.length));
    const totalTextHeight = maxLineLength * fontSize;

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const startX = centerX + (totalTextWidth - columnSpacing) / 2;
    const startY = centerY - totalTextHeight / 2;

    inputLines.forEach((line, columnIndex) => {
      const chars = line.split('');
      const columnX = startX - (columnIndex * columnSpacing);

      chars.forEach((char, charIndex) => {
        const yy = startY + (charIndex * fontSize) + fontSize / 2;
        if (yy - fontSize / 2 >= y && yy + fontSize / 2 <= y + height &&
            columnX - fontSize / 2 >= x && columnX + fontSize / 2 <= x + width) {
          ctx.fillText(char, columnX, yy);
        }
      });
    });
  },

  // PDF用矢印頭部描画
  drawArrowHeadOnContext(ctx, fromX, fromY, toX, toY, arrowSize = 10) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    const adjustedSize = Math.max(arrowSize, ctx.lineWidth * 3);
    const arrowAngle = Math.PI / 6;

    const x1 = toX - adjustedSize * Math.cos(angle - arrowAngle);
    const y1 = toY - adjustedSize * Math.sin(angle - arrowAngle);
    const x2 = toX - adjustedSize * Math.cos(angle + arrowAngle);
    const y2 = toY - adjustedSize * Math.sin(angle + arrowAngle);

    ctx.save();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(x1, y1);
    ctx.moveTo(toX, toY);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  },
};
