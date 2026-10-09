/**
 * Utility functions for generating smooth cubic Bezier SVG paths for line & area charts.
 */

/**
 * Converts array of point objects [{x, y}, ...] into a smooth cubic Bezier SVG path string.
 * @param {Array<{x: number, y: number}>} points - Coordinates array.
 * @param {number} [tension=0.22] - Smoothing tension (0 = linear straight, 0.22 = optimal smooth curve).
 * @returns {string} SVG Path 'd' attribute string.
 */
export const createSmoothPathD = (points, tension = 0.22) => {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  if (points.length === 2 || tension <= 0) {
    return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} ` +
      points.slice(1).map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  let path = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    // Control Point 1
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;

    // Control Point 2
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  return path;
};

/**
 * Generates smooth filled area path under the curve ending at zeroY baseline.
 * @param {Array<{x: number, y: number}>} points - Coordinates array.
 * @param {number} zeroY - Y coordinate of baseline.
 * @param {number} [tension=0.22] - Smoothing tension.
 * @returns {string} SVG Path 'd' attribute string.
 */
export const createSmoothAreaPathD = (points, zeroY, tension = 0.22) => {
  if (!points || points.length === 0) return '';
  const linePath = createSmoothPathD(points, tension);
  const firstX = points[0].x.toFixed(1);
  const lastX = points[points.length - 1].x.toFixed(1);
  const zY = zeroY.toFixed(1);

  return `${linePath} L ${lastX},${zY} L ${firstX},${zY} Z`;
};
