/**
 * TASK_CARD_05 SCOPE 5: "90 日价格 sparkline(SVG)". Flat single-color
 * polyline (green if the period ended up, red if down) - no gradients,
 * no fill, no chart-junk, per the card's own "禁止 AI-slop(紫渐变/
 * 卡片套卡片)".
 */
export function renderSparklineSvg(closes: number[], width = 120, height = 30): string {
  if (closes.length < 2) {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="sparkline" role="img" aria-label="insufficient price history"></svg>`;
  }

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  const points = closes
    .map((c, i) => {
      const x = (i / (closes.length - 1)) * width;
      const y = height - ((c - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const trendUp = closes[closes.length - 1] >= closes[0];
  const color = trendUp ? "var(--up)" : "var(--down)";

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="sparkline" role="img" aria-label="90-day price trend">` +
    `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>` +
    `</svg>`;
}
