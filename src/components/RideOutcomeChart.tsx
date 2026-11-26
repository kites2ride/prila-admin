import { useEffect, useRef } from 'react';
import { css, echarts, prefersReducedMotion } from '../lib/echarts';

export type OutcomeSlice = { label: string; n: number; color: string };

/** Apache ECharts donut (tree-shaken: Pie + Tooltip + Canvas only). Re-themes when dark mode flips. */
export default function RideOutcomeChart({
  slices,
  centerLabel,
  centerValue,
}: {
  slices: OutcomeSlice[];
  centerLabel: string;
  centerValue: string;
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
      const reduce = prefersReducedMotion();
      c.setOption({
        animation: !reduce,
        animationDuration: 700,
        animationEasing: 'cubicOut',
        tooltip: {
          trigger: 'item',
          backgroundColor: surface,
          borderColor: css('--prila-border', '#e2e8f0'),
          textStyle: { color: ink, fontSize: 12 },
          formatter: '{b}: {c} ({d}%)',
        },
        title: {
          text: centerValue,
          subtext: centerLabel,
          left: 'center',
          top: '36%',
          textStyle: { color: ink, fontSize: 22, fontWeight: 600 },
          subtextStyle: { color: muted, fontSize: 12 },
          itemGap: 2,
        },
        series: [
          {
            type: 'pie',
            radius: ['62%', '86%'],
            avoidLabelOverlap: true,
            itemStyle: { borderColor: surface, borderWidth: 3, borderRadius: 6 },
            label: { show: false },
            emphasis: { scaleSize: 4 },
            data: slices.map((s) => ({ name: s.label, value: s.n, itemStyle: { color: s.color } })),
          },
        ],
      });
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, [slices, centerLabel, centerValue]);

  return (
    <div
      ref={host}
      className="h-48 w-48 shrink-0"
      role="img"
      aria-label={`Ride outcomes: ${slices.map((s) => `${s.label} ${s.n}`).join(', ')}`}
    />
  );
}
