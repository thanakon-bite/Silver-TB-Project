/**
 * A design token (index.css) as an rgb() string, for libraries that draw on canvas and cannot read
 * CSS variables (Chart.js). Read it again after the theme changes: the value follows the .dark class.
 */
export function tokenColor(name: string, alpha = 1): string {
  if (typeof document === 'undefined') return `rgb(0 0 0 / ${alpha})`;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  const ctx = document.createElement('canvas').getContext('2d');
  if (!raw || !ctx) return `rgb(0 0 0 / ${alpha})`;
  ctx.fillStyle = `oklch(${raw})`;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  const [r, g, b] = [d[0], d[1], d[2]];
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
