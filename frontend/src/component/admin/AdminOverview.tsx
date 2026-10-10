import React, { useEffect, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { AlertTriangle, Banknote, PackageOpen, Users, Table2, BarChart3 } from 'lucide-react';
import { api } from '../../lib/api';
import { baht, ORDER_STATUS_LABEL } from '../../lib/format';
import { tokenColor } from '../../lib/tokenColor';
import { ORDER_STATUSES, PRODUCT_CATEGORIES, type OrderStatus, type ProductCategory } from '../../lib/types';
import { CATEGORY_LABELS } from './AdminProducts';
import { useTheme } from '../../contexts/ThemeContext';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip);

interface Stats {
  revenue_total: number;
  orders_by_status: Record<OrderStatus, number>;
  products_by_category?: Record<ProductCategory, number>;
  to_fulfil: number;
  needs_attention: number;
  customers: number;
  low_stock: { id: string; name: string; stock: number }[];
  daily: { date: string; revenue: number; orders: number }[];
}


/**
 * Order Status identity colours: the chart series tokens in fixed order, Cancelled in the neutral muted ink
 * because it is the end of the road. Text never wears these: the legend and table carry names and counts.
 */
const STATUS_SERIES: Record<OrderStatus, [token: string, alpha: number]> = {
  pending: ['series-1', 1],
  paid: ['series-2', 1],
  shipped: ['series-3', 1],
  delivered: ['series-4', 1],
  cancelled: ['muted', 0.55],
};

const Tile: React.FC<{ icon: React.FC<{ className?: string }>; label: string; value: string; tone?: 'warn'; onClick?: () => void }> = ({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}) => (
  <button
    onClick={onClick}
    disabled={!onClick}
    className={`text-left bg-paper rounded-xl border p-5 transition-colors ${
      tone === 'warn' ? 'border-danger/40' : 'border-line'
    } ${onClick ? 'hover:border-accent-strong/40' : 'cursor-default'}`}
  >
    <div className="flex items-center gap-2 text-sm text-muted mb-2">
      <Icon className={`w-4 h-4 ${tone === 'warn' ? 'text-danger' : 'text-muted'}`} />
      {label}
    </div>
    <div className="font-mono text-2xl font-medium tabular-nums text-ink">{value}</div>
  </button>
);

/** One dashboard panel: a title, an optional Chart/Table switch, and an empty state when there is nothing to draw. */
const Panel: React.FC<{
  title: string;
  note?: string;
  action?: React.ReactNode;
  empty?: string;
  table?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, note, action, empty, table, className = '', children }) => {
  const [asTable, setAsTable] = useState(false);
  return (
    <section aria-label={title} className={`bg-paper rounded-2xl border border-line p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-ink">{title}</h3>
          {note && <p className="text-xs text-muted">{note}</p>}
        </div>
        <div className="flex items-center gap-3">
          {action}
          {table && !empty && (
            <button
              type="button"
              onClick={() => setAsTable(!asTable)}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-accent-strong"
              aria-pressed={asTable}
            >
              {asTable ? <BarChart3 className="w-4 h-4" aria-hidden /> : <Table2 className="w-4 h-4" aria-hidden />}
              {asTable ? 'Chart' : 'Table'}
            </button>
          )}
        </div>
      </div>
      {empty ? <p className="py-10 text-center text-sm text-muted">{empty}</p> : asTable ? table : children}
    </section>
  );
};

const th = 'py-2 font-medium';
const td = 'py-1.5 text-ink';

const AdminOverview: React.FC<{ goTo: (tab: 'orders' | 'products', filter?: string) => void }> = ({ goTo }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const { theme } = useTheme();
  // Canvas cannot read CSS variables; re-read the tokens whenever the theme flips.
  const chart = React.useMemo(
    () => ({
      bar: tokenColor('accent-strong', 0.85),
      barHover: tokenColor('accent-strong'),
      danger: tokenColor('danger', 0.85),
      muted: tokenColor('muted'),
      line: tokenColor('line'),
      surface: tokenColor('paper'),
      status: Object.fromEntries(ORDER_STATUSES.map((s) => [s, tokenColor(...STATUS_SERIES[s])])) as Record<OrderStatus, string>,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- theme is the trigger: the values come from the DOM
    [theme]
  );

  useEffect(() => {
    api.get<Stats>('/admin/stats').then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-danger">{error}</p>;
  if (!stats) return <p className="text-muted">Loading…</p>;

  const labels = stats.daily.map((d) => new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
  const statusCounts = ORDER_STATUSES.map((s) => stats.orders_by_status[s] || 0);
  const orderTotal = statusCounts.reduce((a, b) => a + b, 0);
  const byCategory = PRODUCT_CATEGORIES.map((c) => stats.products_by_category?.[c] || 0);
  const lowStock = stats.low_stock;
  const revenueDays = stats.daily.filter((d) => d.revenue > 0).length;

  const axis = {
    grid: { color: chart.line, lineWidth: 1 },
    border: { display: false },
    ticks: { color: chart.muted, precision: 0 },
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile icon={Banknote} label="Paid revenue (all time)" value={baht(stats.revenue_total)} />
        <Tile icon={PackageOpen} label="Paid, waiting to ship" value={String(stats.to_fulfil)} onClick={() => goTo('orders', 'paid')} />
        <Tile
          icon={AlertTriangle}
          label="Needs attention"
          value={String(stats.needs_attention)}
          tone={stats.needs_attention ? 'warn' : undefined}
          onClick={() => goTo('orders', 'attention')}
        />
        <Tile icon={Users} label="Customers" value={String(stats.customers)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Orders by status"
          note="Every order so far · click a status to see its orders"
          empty={orderTotal === 0 ? 'No orders yet.' : undefined}
          table={
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-line">
                  <th className={th}>Status</th>
                  <th className={`${th} text-right`}>Orders</th>
                </tr>
              </thead>
              <tbody>
                {ORDER_STATUSES.map((s, i) => (
                  <tr key={s} className="border-b border-line">
                    <td className={td}>{ORDER_STATUS_LABEL[s]}</td>
                    <td className={`${td} text-right font-mono tabular-nums`}>{statusCounts[i]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <div className="grid items-center gap-6 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <div className="relative mx-auto h-48 w-48">
              <Doughnut
                data={{
                  labels: ORDER_STATUSES.map((s) => ORDER_STATUS_LABEL[s]),
                  datasets: [
                    {
                      data: statusCounts,
                      backgroundColor: ORDER_STATUSES.map((s) => chart.status[s]),
                      borderColor: chart.surface,
                      borderWidth: 2,
                      hoverOffset: 4,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '68%',
                  onClick: (_e, els) => els[0] && goTo('orders', ORDER_STATUSES[els[0].index]),
                  onHover: (e, els) => {
                    const target = e.native?.target as HTMLElement | undefined;
                    if (target) target.style.cursor = els.length ? 'pointer' : 'default';
                  },
                  plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed} order(s)` } } },
                }}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-2xl font-medium tabular-nums text-ink">{orderTotal}</span>
                <span className="text-xs text-muted">orders</span>
              </div>
            </div>
            {/* The legend names each slice and states its count, so colour never carries the meaning alone. */}
            <ul className="space-y-1 text-sm">
              {ORDER_STATUSES.map((s, i) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => goTo('orders', s)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-sunken"
                  >
                    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: chart.status[s] }} />
                    <span className="flex-1 text-ink">{ORDER_STATUS_LABEL[s]}</span>
                    <span className="font-mono tabular-nums text-ink">{statusCounts[i]}</span>
                    <span className="w-10 text-right font-mono text-xs tabular-nums text-muted">
                      {orderTotal ? Math.round((statusCounts[i] / orderTotal) * 100) : 0}%
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel
          title="Products by category"
          note="Active products in the shop"
          empty={byCategory.every((n) => n === 0) ? 'No active products yet.' : undefined}
          table={
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-line">
                  <th className={th}>Category</th>
                  <th className={`${th} text-right`}>Products</th>
                </tr>
              </thead>
              <tbody>
                {PRODUCT_CATEGORIES.map((c, i) => (
                  <tr key={c} className="border-b border-line">
                    <td className={td}>{CATEGORY_LABELS[c]}</td>
                    <td className={`${td} text-right font-mono tabular-nums`}>{byCategory[i]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <div className="h-56">
            <Bar
              data={{
                labels: PRODUCT_CATEGORIES.map((c) => CATEGORY_LABELS[c]),
                datasets: [
                  {
                    data: byCategory,
                    backgroundColor: chart.bar,
                    hoverBackgroundColor: chart.barHover,
                    borderRadius: { topLeft: 4, topRight: 4 },
                    borderSkipped: 'bottom',
                    maxBarThickness: 40,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y} product(s)` } } },
                scales: { x: { grid: { display: false }, ticks: { color: chart.muted } }, y: { beginAtZero: true, ...axis } },
              }}
            />
          </div>
        </Panel>
      </div>

      <Panel
        title="Running low (stock ≤ 2)"
        note="Active products, lowest first · click a bar to restock"
        action={
          <button type="button" onClick={() => goTo('products', 'low')} className="text-xs font-semibold text-accent-strong hover:underline">
            Manage
          </button>
        }
        empty={lowStock.length === 0 ? 'All active products are well stocked.' : undefined}
        table={
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className={th}>Product</th>
                <th className={`${th} text-right`}>Stock</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((p) => (
                <tr key={p.id} className="border-b border-line">
                  <td className={td}>{p.name}</td>
                  <td className={`${td} text-right font-mono tabular-nums ${p.stock === 0 ? 'text-danger' : ''}`}>{p.stock === 0 ? 'Sold out' : p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        {/* Sold-out products have no bar to see, so their label says it in words. */}
        <div style={{ height: Math.max(120, lowStock.length * 32 + 40) }}>
          <Bar
            data={{
              labels: lowStock.map((p) => (p.stock === 0 ? `${p.name} · sold out` : p.name)),
              datasets: [
                {
                  data: lowStock.map((p) => p.stock),
                  backgroundColor: lowStock.map((p) => (p.stock === 0 ? chart.danger : chart.bar)),
                  hoverBackgroundColor: chart.barHover,
                  borderRadius: { topRight: 4, bottomRight: 4 },
                  borderSkipped: 'left',
                  maxBarThickness: 18,
                },
              ],
            }}
            options={{
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: false,
              onClick: (_e, els) => els[0] && goTo('products', 'low'),
              plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.x} in stock` } } },
              scales: {
                x: { beginAtZero: true, suggestedMax: 2, ...axis, ticks: { ...axis.ticks, stepSize: 1 } },
                y: { grid: { display: false }, ticks: { color: chart.muted, autoSkip: false } },
              },
            }}
          />
        </div>
      </Panel>

      <Panel
        title="Paid revenue, last 14 days"
        note="Thai Baht per day (Asia/Bangkok)"
        empty={revenueDays === 0 ? 'No paid orders in the last 14 days.' : undefined}
        table={
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className={th}>Date</th>
                <th className={`${th} text-right`}>Orders</th>
                <th className={`${th} text-right`}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {stats.daily.map((d, i) => (
                <tr key={d.date} className="border-b border-line">
                  <td className={td}>{labels[i]}</td>
                  <td className={`${td} text-right`}>{d.orders}</td>
                  <td className={`${td} text-right font-semibold`}>{baht(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <div className="h-64">
          <Bar
            data={{
              labels,
              datasets: [
                {
                  data: stats.daily.map((d) => d.revenue),
                  backgroundColor: chart.bar,
                  hoverBackgroundColor: chart.barHover,
                  borderRadius: { topLeft: 4, topRight: 4 },
                  borderSkipped: 'bottom',
                  maxBarThickness: 24,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => `${baht(ctx.parsed.y)} · ${stats.daily[ctx.dataIndex].orders} order(s)` } },
              },
              scales: {
                x: { grid: { display: false }, ticks: { color: chart.muted, maxRotation: 0, autoSkip: true } },
                y: { beginAtZero: true, ...axis, ticks: { color: chart.muted, callback: (v) => baht(Number(v)) } },
              },
            }}
          />
        </div>
      </Panel>
    </div>
  );
};

export default AdminOverview;
