import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Pencil, Trash2, Plus, Star, Package } from 'lucide-react';
import Swal from 'sweetalert2';
import { api } from '../lib/api';
import { formatAddressLines } from '../lib/format';
import type { Address } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../component/common/Modal';
import AddressForm, { addressToForm, emptyAddress, pruneErrors, toAddressPayload, validateAddress, AddressFormValue } from '../component/address/AddressForm';

const Account: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState({ full_name: user?.full_name || '', phone: user?.phone || '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const [form, setForm] = useState<AddressFormValue>(emptyAddress());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadAddresses = () => api.get<Address[]>('/addresses').then(setAddresses).catch(() => setAddresses([]));
  useEffect(() => {
    loadAddresses();
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.patch('/auth/profile', { full_name: profile.full_name, phone: profile.phone || null });
      await refreshProfile();
      Swal.fire({ icon: 'success', title: 'Profile saved', timer: 1000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const openEditor = (a: Address | 'new') => {
    setEditing(a);
    setErrors({});
    setForm(a === 'new' ? emptyAddress({ recipient_name: user?.full_name || '', phone: user?.phone || '' }) : addressToForm(a));
  };

  const saveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateAddress(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      if (editing === 'new') await api.post('/addresses', toAddressPayload(form));
      else if (editing) await api.patch(`/addresses/${editing.id}`, toAddressPayload(form));
      setEditing(null);
      await loadAddresses();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Address) => {
    const r = await Swal.fire({ icon: 'warning', title: 'Delete this address?', showCancelButton: true, confirmButtonColor: '#FF922B' });
    if (!r.isConfirmed) return;
    await api.delete(`/addresses/${a.id}`).catch((err) => Swal.fire({ icon: 'error', title: 'Error', text: err.message }));
    loadAddresses();
  };

  const makeDefault = async (a: Address) => {
    await api.post(`/addresses/${a.id}/default`, {}).catch((err) => Swal.fire({ icon: 'error', title: 'Error', text: err.message }));
    loadAddresses();
  };

  const input = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange/50';

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">My account</h1>
        <Link to="/orders" className="flex items-center gap-2 text-sm font-semibold text-orange hover:underline">
          <Package className="w-4 h-4" /> My orders
        </Link>
      </div>

      <form onSubmit={saveProfile} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Profile</h2>
        <p className="text-sm text-gray-500">{user?.email}</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className={input} value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} placeholder="Full name" required maxLength={120} />
          <input className={input} value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="Phone (optional)" type="tel" />
        </div>
        <button disabled={savingProfile} className="px-5 py-2 bg-orange text-white font-semibold rounded-xl disabled:opacity-50">
          {savingProfile ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-orange" /> Shipping addresses
          </h2>
          <button onClick={() => openEditor('new')} disabled={addresses.length >= 10} className="flex items-center gap-1 text-sm font-semibold text-orange disabled:opacity-40">
            <Plus className="w-4 h-4" /> Add address
          </button>
        </div>

        {addresses.length === 0 && <p className="text-sm text-gray-500">No saved addresses yet. You can also add one during checkout.</p>}

        <div className="grid sm:grid-cols-2 gap-3">
          {addresses.map((a) => (
            <div key={a.id} className={`rounded-xl border p-4 text-sm ${a.is_default ? 'border-orange bg-orange/5' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wide text-orange">{a.label || (a.is_default ? 'Default' : '')}</span>
                <div className="flex gap-1">
                  {!a.is_default && (
                    <button title="Make default" onClick={() => makeDefault(a)} className="p-1.5 text-gray-400 hover:text-orange">
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button title="Edit" onClick={() => openEditor(a)} className="p-1.5 text-gray-400 hover:text-blue-500">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button title="Delete" onClick={() => remove(a)} className="p-1.5 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {formatAddressLines(a).map((l, i) => (
                <div key={i} className={i === 0 ? 'font-semibold text-gray-900' : 'text-gray-600'}>{l}</div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add address' : 'Edit address'} maxWidth="2xl">
        <form onSubmit={saveAddress} className="space-y-5">
          <AddressForm
            value={form}
            onChange={(next) => {
              setErrors((e) => pruneErrors(e, form, next));
              setForm(next);
            }}
            errors={errors}
            showLabel
          />
          <button disabled={saving} className="w-full py-3 bg-orange-gradient text-white font-bold rounded-xl disabled:opacity-50">
            {saving ? 'Saving…' : 'Save address'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default Account;
