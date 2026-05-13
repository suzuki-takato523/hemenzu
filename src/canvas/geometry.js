// ジオメトリ・当たり判定の純関数モジュール
// インスタンス状態に依存しない、テスト容易な計算ロジックをここに集約

// 点と線分（端点制限あり）との距離
export function distanceToLine(point, lineStart, lineEnd) {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  if (lenSq === 0) return Math.sqrt(A * A + B * B);

  const param = dot / lenSq;

  let xx, yy;
  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

// 別名（旧コードと互換）。中身は distanceToLine と同等
export function distanceToLineSegment(point, lineStart, lineEnd) {
  return distanceToLine(point, lineStart, lineEnd);
}

// 線分への近接判定（斜め線は判定範囲を1.4倍に拡大）
export function isPointNearLineSegmentImproved(coords, segmentStart, segmentEnd, tolerance) {
  const distance = distanceToLine(coords, segmentStart, segmentEnd);

  const dx = segmentEnd.x - segmentStart.x;
  const dy = segmentEnd.y - segmentStart.y;
  const angle = Math.abs(Math.atan2(dy, dx));
  const angleInDegrees = (angle * 180) / Math.PI;
  const isHorizontalOrVertical =
    angleInDegrees < 10 ||
    (angleInDegrees > 80 && angleInDegrees < 100) ||
    angleInDegrees > 170;

  const adjustedTolerance = isHorizontalOrVertical ? tolerance : tolerance * 1.4;
  return distance <= adjustedTolerance;
}

// 線分への近接判定（改良版のラッパー）
export function isPointNearLineSegment(coords, segmentStart, segmentEnd, tolerance) {
  return isPointNearLineSegmentImproved(coords, segmentStart, segmentEnd, tolerance);
}

// 矩形の輪郭への近接判定
export function isPointNearRectangle(coords, start, end, tolerance) {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);

  const distances = [
    distanceToLine(coords, { x: left, y: top }, { x: right, y: top }),
    distanceToLine(coords, { x: right, y: top }, { x: right, y: bottom }),
    distanceToLine(coords, { x: right, y: bottom }, { x: left, y: bottom }),
    distanceToLine(coords, { x: left, y: bottom }, { x: left, y: top }),
  ];

  return Math.min(...distances) <= tolerance;
}

// 円周への近接判定（startとendは外接矩形の対角）
export function isPointNearCircle(coords, start, end, tolerance) {
  const centerX = (start.x + end.x) / 2;
  const centerY = (start.y + end.y) / 2;
  const radius = Math.abs(end.x - start.x) / 2;

  const distanceToCenter = Math.sqrt(
    Math.pow(coords.x - centerX, 2) + Math.pow(coords.y - centerY, 2)
  );

  const distanceToCircle = Math.abs(distanceToCenter - radius);
  return distanceToCircle <= tolerance;
}

// 矢印の先端領域（三角形の代わりに、先端 + ベース点 + 長さ で表現）
export function getArrowHeadRegion(startPoint, endPoint, arrowSize = 10) {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) return null;

  const headLength = Math.max(arrowSize, length * 0.1);
  const ratio = headLength / length;
  const headBaseX = endPoint.x - dx * ratio;
  const headBaseY = endPoint.y - dy * ratio;

  return {
    tip: { x: endPoint.x, y: endPoint.y },
    base: { x: headBaseX, y: headBaseY },
    length: headLength,
  };
}

// 点が矢印の先端領域内にあるか
export function isPointInArrowHead(point, arrowHeadRegion, tolerance = 0) {
  if (!arrowHeadRegion) return false;
  const distance = distanceToLineSegment(point, arrowHeadRegion.base, arrowHeadRegion.tip);
  return distance <= arrowHeadRegion.length / 2 + tolerance;
}

// セグメントが矢印の先端領域と重なるか
export function isSegmentInArrowHead(segment, arrowHeadRegion) {
  if (!arrowHeadRegion) return false;
  const startInHead = isPointInArrowHead(segment.start, arrowHeadRegion, 5);
  const endInHead = isPointInArrowHead(segment.end, arrowHeadRegion, 5);
  return startInHead || endInHead;
}

// セグメント配列から新しい線分オブジェクトを作る
export function createLineFromSegments(segments, originalPathData) {
  if (!segments || segments.length === 0) return null;

  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];

  return {
    tool: 'line',
    startPoint: firstSegment.start,
    endPoint: lastSegment.end,
    strokeWidth: originalPathData.strokeWidth,
    strokeColor: originalPathData.strokeColor,
  };
}

// 連続する点列の総距離
export function calculatePolylineLength(points) {
  if (!points || points.length < 2) return 0;
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }
  return totalLength;
}
