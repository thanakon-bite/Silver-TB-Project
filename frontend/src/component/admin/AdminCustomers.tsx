import React, { useCallback, useEffect, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import Swal from 'sweetalert2';
import { api } from '../../lib/api';
import { baht, dateTime } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';

interface Customer {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: 'user' | 'admin';
  created_at: string;
  orders: number;
  total_spent: number;
}

const AdminCustomers: React.FC = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');

  const fetchCustomers = useCallback(async () => {
    const q = new URLSearchParams({ limit: '100' });
    if (search) q.set('search', search);
    try {
      const data = await api.get<{ customers: Customer[] }>(`/admin/customers?${q}`);
      setCustomers(data.customers);
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchCustomers, 250);
    return () => clearTimeout(t);
  }, [fetchCustomers]);

  const toggleRole = async (c: Customer) => {
    const role = c.role === 'admin' ? 'user' : 'admin';
    const r = await Swal.fire({
      icon: 'warning',
      title: role === 'admin' ? `Make ${c.full_name} an admin?` : `Remove admin access from ${c.full_name}?`,
      text: role === 'admin' ? 'Admins can manage products, orders, refunds and customers.' : undefined,
      showCancelButton: true,
      confirmButtonColor: '#FF922B',
    });
    if (!r.isConfirmed) return;
    try {
      await api.patch(`/admin/customers/${c.id}/role`, { role });
      fetchCustomers();
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  return (
    <div>
      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email"
          className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange/50"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-gray-100 bg-gray-50/50 text-gray-600">
              <th className="p-3 font-semibold">Customer</th>
              <th className="p-3 font-semibold">Phone</th>
              <th className="p-3 font-semibold text-right">Orders</th>
              <th className="p-3 font-semibold text-right">Spent</th>
              <th className="p-3 font-semibold">Joined</th>
              <th className="p-3 font-semibold">Role</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-gray-100">
                <td className="p-3">
                  <div className="font-semibold text-gray-800">{c.full_name}</div>
                  <div className="text-xs text-gray-400">{c.email}</div>
                </td>
                <td className="p-3 text-gray-600">{c.phone || '—'}</td>
                <td className="p-3 text-right text-gray-800">{c.orders}</td>
                <td className="p-3 text-right font-semibold text-gray-900">{baht(c.total_spent)}</td>
                <td className="p-3 text-gray-500">{dateTime(c.created_at)}</td>
                <td className="p-3">
                  <button
                    onClick={() => toggleRole(c)}
                    disabled={c.id === user?.id}
                    title={c.id === user?.id ? 'You cannot change your own role' : 'Change role'}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold disabled:cursor-not-allowed ${
                      c.role === 'admin' ? 'bg-orange/15 text-orange-dark' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {c.role === 'admin' && <ShieldCheck className="w-3 h-3" />}
                    {c.role}
                  </button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">No customers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminCustomers;
