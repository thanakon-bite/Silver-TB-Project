import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingBag, Users, Settings } from 'lucide-react';
import AdminOverview from '../component/admin/AdminOverview';
import AdminProducts from '../component/admin/AdminProducts';
import AdminOrders from '../component/admin/AdminOrders';
import AdminMembers from '../component/admin/AdminMembers';
import AdminSettings from '../component/admin/AdminSettings';

type Tab = 'overview' | 'products' | 'orders' | 'members' | 'settings';

const TABS: { key: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'orders', label: 'Orders', icon: ShoppingBag },
  { key: 'products', label: 'Products & stock', icon: Package },
  { key: 'members', label: 'Members', icon: Users },
  { key: 'settings', label: 'Payments & LINE', icon: Settings },
];

/** Route is wrapped in <RequireAdmin>; every endpoint used here is also admin-only on the server. */
const AdminDashboard = () => {
  const [params] = useSearchParams();
  const deepLinkOrder = params.get('order'); // from LINE notification links
  const [tab, setTab] = useState<Tab>(deepLinkOrder ? 'orders' : 'overview');
  const [filter, setFilter] = useState<string | undefined>();

  const goTo = (t: 'orders' | 'products', f?: string) => {
    setFilter(f);
    setTab(t);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold text-ink">Admin</h1>

      {/* Still swipes sideways on narrow screens; only the scrollbar is hidden. */}
      <div role="tablist" aria-label="Admin sections" className="no-scrollbar -mx-4 mt-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setFilter(undefined);
              setTab(key);
            }}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors motion-reduce:transition-none ${
              tab === key ? 'border-accent-strong text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <Icon className="w-4 h-4" aria-hidden /> {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="min-h-[500px] pt-6">
        {tab === 'overview' && <AdminOverview goTo={goTo} />}
        {tab === 'orders' && <AdminOrders key={filter || 'all'} initialFilter={filter} initialOrderId={deepLinkOrder} />}
        {tab === 'products' && <AdminProducts key={filter || 'all'} initialFilter={filter} />}
        {tab === 'members' && <AdminMembers />}
        {tab === 'settings' && <AdminSettings />}
      </div>
    </div>
  );
};

export default AdminDashboard;
