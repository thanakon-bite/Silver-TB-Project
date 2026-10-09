import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingBag, Users, Settings } from 'lucide-react';
import AdminOverview from '../component/admin/AdminOverview';
import AdminProducts from '../component/admin/AdminProducts';
import AdminOrders from '../component/admin/AdminOrders';
import AdminCustomers from '../component/admin/AdminCustomers';
import AdminSettings from '../component/admin/AdminSettings';

type Tab = 'overview' | 'products' | 'orders' | 'customers' | 'settings';

const TABS: { key: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'orders', label: 'Orders', icon: ShoppingBag },
  { key: 'products', label: 'Products & stock', icon: Package },
  { key: 'customers', label: 'Customers', icon: Users },
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
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold text-gray-900 border-l-8 border-orange pl-4 mb-8">Admin Dashboard</h1>

      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => {
              setFilter(undefined);
              setTab(key);
            }}
            className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-t-xl whitespace-nowrap transition-colors ${
              tab === key ? 'bg-orange text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow border border-gray-100 p-6 min-h-[500px]">
        {tab === 'overview' && <AdminOverview goTo={goTo} />}
        {tab === 'orders' && <AdminOrders key={filter || 'all'} initialFilter={filter} initialOrderId={deepLinkOrder} />}
        {tab === 'products' && <AdminProducts key={filter || 'all'} initialFilter={filter} />}
        {tab === 'customers' && <AdminCustomers />}
        {tab === 'settings' && <AdminSettings />}
      </div>
    </div>
  );
};

export default AdminDashboard;
