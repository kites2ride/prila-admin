import { useEffect, useRef } from 'react';
import { css, echarts, prefersReducedMotion } from '../lib/echarts';

export type BarSeries = { name: string; color: string; data: (number | null)[] };

/** Horizontal stacked bars (Apache ECharts). Re-themes when dark mode flips. */
export default function StackedBarChart({
  categories,
  series,
  height = 220,
}: {
  categories: string[];
  series: BarSeries[];
  height?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const c = echarts.init(el, undefined, { renderer: 'canvas' });
    chart.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    const apply = () => {
      const c = chart.current;
      if (!c) return;
      const ink = css('--prila-ink', '#0f172a');
      const muted = css('--prila-muted', '#64748b');
      const surface = css('--prila-surface', '#ffffff');
      const border = css('--prila-border', '#e2e8f0');
      c.setOption(
        {
          animation: !prefersReducedMotion(),
          animationDuration: 600,
          animationEasing: 'cubicOut',
          grid: { left: 8, right: 16, top: 8, bottom: 32, containLabel: true },
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'none' },
            backgroundColor: surface,
            borderColor: border,
            textStyle: { color: ink, fontSize: 12 },
          },
          legend: { bottom: 0, itemWidth: 10, itemHeight: 10, icon: 'roundRect', textStyle: { color: muted, fontSize: 12 } },
          xAxis: { type: 'value', splitLine: { lineStyle: { color: border } }, axisLabel: { color: muted, fontSize: 11 } },
          yAxis: {
            type: 'category',
            inverse: true,
            data: categories,
            axisTick: { show: false },
            axisLine: { show: false },
            axisLabel: { color: ink, fontSize: 12 },
          },
          series: series.map((s, i) => ({
            name: s.name,
            type: 'bar',
            stack: 'total',
            barWidth: 18,
            itemStyle: {
              color: s.color,
              borderRadius: i === 0 ? [6, 0, 0, 6] : i === series.length - 1 ? [0, 6, 6, 0] : 0,
            },
            data: s.data,
          })),
        },
        true,
      );
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, [categories, series]);

  return (
    <div
      ref={host}
      style={{ height }}
      className="w-full"
      role="img"
      aria-label={categories
        .map((c, i) => `${c}: ${series.map((s) => `${s.name} ${s.data[i] ?? 0}`).join(', ')}`)
        .join('. ')}
    />
  );
}
