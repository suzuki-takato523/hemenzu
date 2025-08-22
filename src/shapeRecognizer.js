/**
 * 図形認識クラス
 * フリーハンド描画を直線、円、四角形に自動変換
 */
export class ShapeRecognizer {
  constructor() {
    this.tolerance = {
      line: 25,        // 直線の許容誤差（より寛容に）
      circle: 20,      // 円の許容誤差
      rectangle: 25    // 四角形の許容誤差
    };
  }

  recognize(path) {
    if (!path || path.length < 3) return null;

    // 各図形の認識を試行（直線を最優先で検査）
    const lineResult = this.recognizeLine(path);
    if (lineResult && lineResult.confidence > 0.5) {
      return lineResult;
    }

    const circleResult = this.recognizeCircle(path);
    const rectangleResult = this.recognizeRectangle(path);

    // 最も信頼度の高い結果を選択
    const results = [circleResult, rectangleResult]
      .filter(result => result !== null)
      .sort((a, b) => b.confidence - a.confidence);

    if (results.length > 0 && results[0].confidence > 0.7) {
      return results[0];
    }

    return null;
  }

  recognizeLine(path) {
    if (path.length < 2) return null;

    let start = path[0];
    let end = path[path.length - 1];
    
    // 線の長さが短すぎる場合は無視
    const lineLength = Math.sqrt(
      Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
    );
    if (lineLength < 20) return null;
    
    // 水平・垂直線の補正
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    // 水平線に近い場合（±15度以内）
    if (angle < 15 || angle > 165) {
      end = { x: end.x, y: start.y };
    }
    // 垂直線に近い場合（75-105度）
    else if (angle > 75 && angle < 105) {
      end = { x: start.x, y: end.y };
    }
    
    // 直線からの距離の合計を計算
    let totalDistance = 0;
    let maxDistance = 0;

    for (let i = 1; i < path.length - 1; i++) {
      const distance = this.pointToLineDistance(path[i], start, end);
      totalDistance += distance;
      maxDistance = Math.max(maxDistance, distance);
    }

    const avgDistance = totalDistance / (path.length - 2);
    
    // より寛容な直線判定
    if (maxDistance < this.tolerance.line && avgDistance < this.tolerance.line / 1.5) {
      const confidence = Math.max(0.5, 1 - (avgDistance / this.tolerance.line));
      return {
        type: 'line',
        tool: 'line',
        startPoint: start,
        endPoint: end,
        path: [start, end],
        strokeWidth: 2,
        strokeColor: '#000000',
        confidence: confidence
      };
    }

    return null;
  }

  recognizeCircle(path) {
    if (path.length < 10) return null;

    // 中心点を推定（バウンディングボックスの中心）
    const bounds = this.getBounds(path);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    // 各点から中心までの距離を計算
    const distances = path.map(point => 
      Math.sqrt(Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2))
    );
    
    // 平均半径を計算
    const avgRadius = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    
    // 距離のばらつきを計算
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgRadius, 2), 0) / distances.length;
    const standardDeviation = Math.sqrt(variance);
    
    // 円判定
    if (standardDeviation < this.tolerance.circle) {
      // 開始点と終了点が近いかチェック
      const startEnd = Math.sqrt(
        Math.pow(path[0].x - path[path.length - 1].x, 2) + 
        Math.pow(path[0].y - path[path.length - 1].y, 2)
      );
      
      if (startEnd < avgRadius * 0.3) {
        return {
          type: 'circle',
          tool: 'circle',
          startPoint: { x: centerX, y: centerY },
          endPoint: { x: centerX + avgRadius, y: centerY },
          path: path,
          strokeWidth: 2,
          strokeColor: '#000000',
          confidence: 1 - (standardDeviation / this.tolerance.circle)
        };
      }
    }

    return null;
  }

  recognizeRectangle(path) {
    if (path.length < 8) return null;

    // コーナーポイントを検出
    const corners = this.detectCorners(path);
    
    if (corners.length === 4) {
      // 4つのコーナーが矩形を形成するかチェック
      const bounds = this.getBounds(corners);
      
      // 各辺の平行性をチェック
      const isRectangular = this.checkRectangularity(corners);
      
      if (isRectangular) {
        return {
          type: 'rectangle',
          tool: 'rectangle',
          startPoint: { x: bounds.minX, y: bounds.minY },
          endPoint: { x: bounds.maxX, y: bounds.maxY },
          path: path,
          strokeWidth: 2,
          strokeColor: '#000000',
          confidence: 0.8
        };
      }
    }

    return null;
  }

  // ユーティリティメソッド
  pointToLineDistance(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return Math.sqrt(A * A + B * B);
    
    let param = dot / lenSq;
    param = Math.max(0, Math.min(1, param));

    const xx = lineStart.x + param * C;
    const yy = lineStart.y + param * D;

    return Math.sqrt(Math.pow(point.x - xx, 2) + Math.pow(point.y - yy, 2));
  }

  getBounds(points) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    points.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });

    return { minX, minY, maxX, maxY };
  }

  detectCorners(path) {
    const corners = [];
    const threshold = Math.PI / 4; // 45度

    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const next = path[i + 1];

      const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
      
      let angleDiff = Math.abs(angle2 - angle1);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

      if (angleDiff > threshold) {
        corners.push(curr);
      }
    }

    return corners;
  }

  checkRectangularity(corners) {
    if (corners.length !== 4) return false;

    // 対辺の平行性と垂直性をチェック
    const vectors = [];
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      vectors.push({
        x: corners[next].x - corners[i].x,
        y: corners[next].y - corners[i].y
      });
    }

    // 対辺が平行かチェック
    const parallel1 = this.areVectorsParallel(vectors[0], vectors[2]);
    const parallel2 = this.areVectorsParallel(vectors[1], vectors[3]);

    // 隣接する辺が垂直かチェック
    const perpendicular = this.areVectorsPerpendicular(vectors[0], vectors[1]);

    return parallel1 && parallel2 && perpendicular;
  }

  areVectorsParallel(v1, v2, tolerance = 0.2) {
    const cross = Math.abs(v1.x * v2.y - v1.y * v2.x);
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    return cross < tolerance * mag1 * mag2;
  }

  areVectorsPerpendicular(v1, v2, tolerance = 0.2) {
    const dot = Math.abs(v1.x * v2.x + v1.y * v2.y);
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    return dot < tolerance * mag1 * mag2;
  }
}
