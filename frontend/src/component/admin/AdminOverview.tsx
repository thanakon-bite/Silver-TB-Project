import React, { useEffect, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { AlertTriangle, Banknote, PackageCheck, Users, Table2, BarChart3 } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';
import { baht } from '../../lib/format';
import { tokenColor } from '../../lib/tokenColor';
import { ORDER_STATUSES, type OrderStatus, type ProductCategory } from '../../lib/types';
import { useCatalogue, useCategoryName } from '../../lib/catalogue';
import { useTheme } from '../../contexts/ThemeContext';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip);

interface Stats {
  /** Revenue: totals of Confirmed orders only (CONTEXT.md). */
  revenue_total: number;
  confirmed_orders: number;
  orders_by_status: Record<OrderStatus, number>;
  products_by_category?: Record<ProductCategory, number>;
  to_fulfil: number;
  needs_attention: number;
  customers: number;
  low_stock: { id: string; name: string; available: number }[];
  daily: { date: string; revenue: number; orders: number }[];
}


/**
 * Order Status identity colours: the chart series tokens in fixed order, Cancelled in the neutral muted ink
 * because it is the end of the road. Text never wears these: the legend and table carry names and counts.
 */
const STATUS_SERIES: Record<OrderStatus, [token: string, alpha: number]> = {
  awaiting_payment: ['series-1', 1],
  // Paid only lasts until the Owner is alerted, so it shares Waiting Shipping's hue at a lower alpha.
  paid: ['series-2', 0.55],
  waiting_shipping: ['series-2', 1],
  shipping: ['series-3', 1],
  confirmed: ['series-4', 1],
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
  const { t } = useTranslation();
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
              {asTable ? t('admin.overview.chart') : t('admin.overview.table')}
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
  const { t, i18n } = useTranslation();
  const statusLabel = (s: OrderStatus) => t(`order_status.${s}`);
  const { categories } = useCatalogue();
  const categoryName = useCategoryName();
  const PRODUCT_CATEGORIES = categories.map((c) => c.slug);
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
  if (!stats) return <p className="text-muted">{t('loading')}</p>;

  const labels = stats.daily.map((d) => new Date(d.date).toLocaleDateString(i18n.language?.startsWith('en') ? 'en-GB' : 'th-TH', { day: 'numeric', month: 'short' }));
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
        <Tile icon={Banknote} label={t('admin.overview.revenue')} value={baht(stats.revenue_total)} />
        <Tile icon={PackageCheck} label={t('admin.overview.confirmed_orders')} value={String(stats.confirmed_orders)} onClick={() => goTo('orders', 'confirmed')} />
        <Tile
          icon={AlertTriangle}
          label={t('admin.overview.attention')}
          value={String(stats.needs_attention)}
          tone={stats.needs_attention ? 'warn' : undefined}
          onClick={() => goTo('orders', 'attention')}
        />
        <Tile icon={Users} label={t('admin.overview.customers')} value={String(stats.customers)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={t('admin.overview.by_status')}
          note={t('admin.overview.by_status_note')}
          empty={orderTotal === 0 ? t('admin.overview.no_orders') : undefined}
          table={
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-line">
                  <th className={th}>{t('admin.common.status')}</th>
                  <th className={`${th} text-right`}>{t('admin.common.orders')}</th>
                </tr>
              </thead>
              <tbody>
                {ORDER_STATUSES.map((s, i) => (
                  <tr key={s} className="border-b border-line">
                    <td className={td}>{statusLabel(s)}</td>
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
                  labels: ORDER_STATUSES.map((s) => statusLabel(s)),
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
                  plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${t('admin.overview.n_orders', { count: ctx.parsed })}` } } },
                }}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-2xl font-medium tabular-nums text-ink">{orderTotal}</span>
                <span className="text-xs text-muted">{t('admin.overview.orders_word')}</span>
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
                    <span className="flex-1 text-ink">{statusLabel(s)}</span>
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
          title={t('admin.overview.by_category')}
          note={t('admin.overview.by_category_note')}
          empty={byCategory.every((n) => n === 0) ? t('admin.overview.no_products') : undefined}
          table={
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-line">
                  <th className={th}>{t('category')}</th>
                  <th className={`${th} text-right`}>{t('admin.common.products')}</th>
                </tr>
              </thead>
              <tbody>
                {PRODUCT_CATEGORIES.map((c, i) => (
                  <tr key={c} className="border-b border-line">
                    <td className={td}>{categoryName(c)}</td>
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
                labels: PRODUCT_CATEGORIES.map((c) => categoryName(c)),
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
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${t('admin.overview.n_products', { count: ctx.parsed.y ?? 0 })}` } } },
                scales: { x: { grid: { display: false }, ticks: { color: chart.muted } }, y: { beginAtZero: true, ...axis } },
              }}
            />
          </div>
        </Panel>
      </div>

      <Panel
        title={t('admin.overview.low')}
        note={t('admin.overview.low_note')}
        action={
          <button type="button" onClick={() => goTo('products', 'low')} className="text-xs font-semibold text-accent-strong hover:underline">
            {t('admin.overview.manage')}
          </button>
        }
        empty={lowStock.length === 0 ? t('admin.overview.well_stocked') : undefined}
        table={
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className={th}>{t('admin.common.product')}</th>
                <th className={`${th} text-right`}>{t('admin.products.available_label')}</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((p) => (
                <tr key={p.id} className="border-b border-line">
                  <td className={td}>{p.name}</td>
                  <td className={`${td} text-right font-mono tabular-nums ${p.available === 0 ? 'text-danger' : ''}`}>{p.available === 0 ? t('sold_out') : p.available}</td>
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
              labels: lowStock.map((p) => (p.available === 0 ? `${p.name} · ${t('sold_out')}` : p.name)),
              datasets: [
                {
                  data: lowStock.map((p) => p.available),
                  backgroundColor: lowStock.map((p) => (p.available === 0 ? chart.danger : chart.bar)),
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
              plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${t('admin.overview.n_in_stock', { count: ctx.parsed.x ?? 0 })}` } } },
              scales: {
                x: { beginAtZero: true, suggestedMax: 2, ...axis, ticks: { ...axis.ticks, stepSize: 1 } },
                y: { grid: { display: false }, ticks: { color: chart.muted, autoSkip: false } },
              },
            }}
          />
        </div>
      </Panel>

      <Panel
        title={t('admin.overview.revenue_14')}
        note={t('admin.overview.revenue_14_note')}
        empty={revenueDays === 0 ? t('admin.overview.no_revenue') : undefined}
        table={
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className={th}>{t('admin.common.date')}</th>
                <th className={`${th} text-right`}>{t('admin.common.orders')}</th>
                <th className={`${th} text-right`}>{t('admin.overview.revenue_col')}</th>
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
                tooltip: { callbacks: { label: (ctx) => `${baht(ctx.parsed.y)} · ${t('admin.overview.n_orders', { count: stats.daily[ctx.dataIndex].orders })}` } },
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
