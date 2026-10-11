import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Package, ShoppingBag, Users, Settings, Scale, Tags } from 'lucide-react';
import AdminOverview from '../component/admin/AdminOverview';
import AdminProducts from '../component/admin/AdminProducts';
import AdminOrders from '../component/admin/AdminOrders';
import AdminMembers from '../component/admin/AdminMembers';
import AdminSettings from '../component/admin/AdminSettings';
import AdminRules from '../component/admin/AdminRules';
import AdminCategories from '../component/admin/AdminCategories';

type Tab = 'overview' | 'products' | 'orders' | 'categories' | 'members' | 'rules' | 'settings';

const TABS: { key: Tab; icon: React.FC<{ className?: string }> }[] = [
  { key: 'overview', icon: LayoutDashboard },
  { key: 'orders', icon: ShoppingBag },
  { key: 'products', icon: Package },
  { key: 'categories', icon: Tags },
  { key: 'members', icon: Users },
  { key: 'rules', icon: Scale },
  { key: 'settings', icon: Settings },
];

/** Route is wrapped in <RequireAdmin>; every endpoint used here is also admin-only on the server. */
const AdminDashboard = () => {
  const { t } = useTranslation();
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
      <h1 className="font-display text-3xl font-bold text-ink">{t('admin.title')}</h1>

      {/* Still swipes sideways on narrow screens; only the scrollbar is hidden. */}
      <div role="tablist" aria-label={t('admin.sections')} className="no-scrollbar -mx-4 mt-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        {TABS.map(({ key, icon: Icon }) => (
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
            <Icon className="w-4 h-4" aria-hidden /> {t(`admin.tabs.${key}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="min-h-[500px] pt-6">
        {tab === 'overview' && <AdminOverview goTo={goTo} />}
        {tab === 'orders' && <AdminOrders key={filter || 'all'} initialFilter={filter} initialOrderId={deepLinkOrder} />}
        {tab === 'products' && <AdminProducts key={filter || 'all'} initialFilter={filter} />}
        {tab === 'categories' && <AdminCategories />}
        {tab === 'members' && <AdminMembers />}
        {tab === 'rules' && <AdminRules />}
        {tab === 'settings' && <AdminSettings />}
      </div>
    </div>
  );
};

export default AdminDashboard;
