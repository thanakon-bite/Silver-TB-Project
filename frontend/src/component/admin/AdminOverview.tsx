import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { AlertTriangle, Banknote, PackageOpen, Users, Table2, BarChart3 } from 'lucide-react';
import { api } from '../../lib/api';
import { baht } from '../../lib/format';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

interface Stats {
  revenue_total: number;
  orders_by_status: Record<string, number>;
  to_fulfil: number;
  needs_attention: number;
  customers: number;
  low_stock: { id: string; name: string; stock: number }[];
  daily: { date: string; revenue: number; orders: number }[];
}

const BAR_COLOR = '#E67E22'; // brand orange-dark; < 3:1 on white → tooltip + table view provided

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
    className={`text-left bg-white rounded-2xl border p-5 transition-colors ${
      tone === 'warn' ? 'border-red-200' : 'border-gray-100'
    } ${onClick ? 'hover:border-orange/40' : 'cursor-default'}`}
  >
    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
      <Icon className={`w-4 h-4 ${tone === 'warn' ? 'text-red-500' : 'text-gray-400'}`} />
      {label}
    </div>
    <div className="text-2xl font-extrabold text-gray-900">{value}</div>
  </button>
);

const AdminOverview: React.FC<{ goTo: (tab: 'orders' | 'products', filter?: string) => void }> = ({ goTo }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    api.get<Stats>('/admin/stats').then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!stats) return <p className="text-gray-500">Loading…</p>;

  const labels = stats.daily.map((d) => new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));

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

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Paid revenue, last 14 days</h3>
            <p className="text-xs text-gray-400">Thai Baht per day (Asia/Bangkok)</p>
          </div>
          <button
            onClick={() => setAsTable(!asTable)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-orange"
            aria-pressed={asTable}
          >
            {asTable ? <BarChart3 className="w-4 h-4" /> : <Table2 className="w-4 h-4" />}
            {asTable ? 'Chart' : 'Table'}
          </button>
        </div>

        {asTable ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium text-right">Orders</th>
                <th className="py-2 font-medium text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {stats.daily.map((d, i) => (
                <tr key={d.date} className="border-b border-gray-50">
                  <td className="py-1.5 text-gray-700">{labels[i]}</td>
                  <td className="py-1.5 text-right text-gray-700">{d.orders}</td>
                  <td className="py-1.5 text-right font-semibold text-gray-900">{baht(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="h-64">
            <Bar
              data={{
                labels,
                datasets: [
                  {
                    data: stats.daily.map((d) => d.revenue),
                    backgroundColor: BAR_COLOR,
                    hoverBackgroundColor: '#C96A12',
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
                  tooltip: {
                    callbacks: {
                      label: (ctx) => `${baht(ctx.parsed.y)} · ${stats.daily[ctx.dataIndex].orders} order(s)`,
                    },
                  },
                },
                scales: {
                  x: { grid: { display: false }, ticks: { color: '#6B7280', maxRotation: 0, autoSkip: true } },
                  y: {
                    beginAtZero: true,
                    border: { display: false },
                    grid: { color: '#F1F2F4', lineWidth: 1 },
                    ticks: { color: '#6B7280', callback: (v) => baht(Number(v)) },
                  },
                },
              }}
            />
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Orders by status</h3>
          <ul className="space-y-1.5 text-sm">
            {Object.entries(stats.orders_by_status).map(([s, n]) => (
              <li key={s} className="flex justify-between">
                <span className="capitalize text-gray-600">{s}</span>
                <span className="font-semibold text-gray-900">{n}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Low stock (≤ 2)</h3>
            <button onClick={() => goTo('products', 'low')} className="text-xs font-semibold text-orange hover:underline">
              Manage
            </button>
          </div>
          {stats.low_stock.length === 0 ? (
            <p className="text-sm text-gray-500">All active products are well stocked.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {stats.low_stock.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span className="text-gray-700 truncate">{p.name}</span>
                  <span className={`font-semibold ${p.stock === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {p.stock === 0 ? 'Sold out' : p.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
