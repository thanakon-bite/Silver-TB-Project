import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Search, ShieldCheck } from 'lucide-react';
import Swal from 'sweetalert2';
import { api, ApiError } from '../../lib/api';
import { baht, dateTime } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../common/Modal';
import Pager, { PAGE_SIZE } from './Pager';
import { primaryButtonInline, secondaryButton } from '../ui/buttonStyles';
import { fieldClass, fieldLabel } from '../ui/fieldStyles';

type Role = 'user' | 'admin';

/** Anyone with an account, Customer or Admin (CONTEXT.md: Member). */
interface Member {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  created_at: string;
  orders: number;
  total_spent: number;
}


const RoleSelect: React.FC<{ id: string; value: Role; onChange: (r: Role) => void }> = ({ id, value, onChange }) => (
  <select id={id} value={value} onChange={(e) => onChange(e.target.value as Role)} className={fieldClass()}>
    <option value="user">Customer (user)</option>
    <option value="admin">Admin</option>
  </select>
);

const emptyNew = { full_name: '', email: '', phone: '', role: 'user' as Role };

/** Creates a Member by invitation: they get an email to set their own password, so the admin never knows it. */
const CreateMember: React.FC<{ isOpen: boolean; onClose: () => void; onCreated: () => void }> = ({ isOpen, onClose, onCreated }) => {
  const [form, setForm] = useState(emptyNew);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(emptyNew);
      setError('');
    }
  }, [isOpen]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/admin/customers', { ...form, phone: form.phone.trim() || undefined });
      onClose();
      onCreated();
      Swal.fire({ icon: 'success', title: 'Invitation sent', text: `${form.email} will get an email to set a password.`, timer: 1800, showConfirmButton: false });
    } catch (err: any) {
      setError(err instanceof ApiError && err.status === 409 ? 'A member with this email already exists.' : err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New member" maxWidth="md">
      <form onSubmit={submit} className="space-y-4 text-sm">
        <div>
          <label htmlFor="member-name" className={fieldLabel}>Full name</label>
          <input id="member-name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={fieldClass()} />
        </div>
        <div>
          <label htmlFor="member-email" className={fieldLabel}>Email</label>
          <input id="member-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={fieldClass()} />
        </div>
        <div>
          <label htmlFor="member-phone" className={fieldLabel}>
            Phone <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="member-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={fieldClass()} />
        </div>
        <div>
          <label htmlFor="member-role" className={fieldLabel}>Role</label>
          <RoleSelect id="member-role" value={form.role} onChange={(role) => setForm({ ...form, role })} />
        </div>
        <p className="text-muted">They will get an email with a link to set their own password.</p>
        {error && <p role="alert" className="text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButton}>Cancel</button>
          <button type="submit" disabled={saving} className={primaryButtonInline}>{saving ? 'Sending…' : 'Send invitation'}</button>
        </div>
      </form>
    </Modal>
  );
};

/** A Member's profile, read-only except for the role. */
const EditRole: React.FC<{ member: Member | null; onClose: () => void; onSaved: () => void }> = ({ member, onClose, onSaved }) => {
  const [role, setRole] = useState<Role>('user');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (member) setRole(member.role);
  }, [member]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    if (role === member.role) return onClose();
    setSaving(true);
    try {
      await api.patch(`/admin/customers/${member.id}/role`, { role });
      onClose();
      onSaved();
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={!!member} onClose={onClose} title={member ? member.full_name : ''} maxWidth="md">
      {member && (
        <form onSubmit={save} className="space-y-4 text-sm">
          <dl className="divide-y divide-line border-y border-line">
            {[
              ['Email', member.email || '—'],
              ['Phone', member.phone || '—'],
              ['Joined', dateTime(member.created_at)],
              ['Orders', `${member.orders} · ${baht(member.total_spent)} spent`],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-4 py-2.5">
                <dt className="w-20 shrink-0 text-muted">{label}</dt>
                <dd className="min-w-0 break-all text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <label htmlFor="edit-role" className={fieldLabel}>Role</label>
            <RoleSelect id="edit-role" value={role} onChange={setRole} />
            {role === 'admin' && member.role !== 'admin' && <p className="mt-2 text-muted">Admins can manage products, orders, refunds and members.</p>}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={secondaryButton}>Cancel</button>
            <button type="submit" disabled={saving} className={primaryButtonInline}>Save role</button>
          </div>
        </form>
      )}
    </Modal>
  );
};

const AdminMembers: React.FC = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  const fetchMembers = useCallback(async () => {
    const q = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (search) q.set('search', search);
    try {
      const data = await api.get<{ customers: Member[]; total: number }>(`/admin/customers?${q}`);
      setMembers(data.customers || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    }
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(fetchMembers, 250);
    return () => clearTimeout(t);
  }, [fetchMembers]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between mb-4">
        <div className="flex-1 max-w-sm">
          <label htmlFor="member-search" className={fieldLabel}>Search members</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden />
            <input
              id="member-search"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Name or email"
              className={`${fieldClass()} pl-9`}
            />
          </div>
        </div>
        <button type="button" onClick={() => setCreating(true)} className={primaryButtonInline}>
          <Plus className="w-4 h-4" aria-hidden /> New member
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-sunken text-muted">
              <th className="p-3 font-semibold">Member</th>
              <th className="p-3 font-semibold">Phone</th>
              <th className="p-3 font-semibold text-right">Orders</th>
              <th className="p-3 font-semibold text-right">Spent</th>
              <th className="p-3 font-semibold">Joined</th>
              <th className="p-3 font-semibold">Role</th>
              <th className="p-3">
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-line">
                <td className="p-3">
                  <div className="font-semibold text-ink">{m.full_name}</div>
                  <div className="text-xs text-muted">{m.email}</div>
                </td>
                <td className="p-3 text-muted">{m.phone || '—'}</td>
                <td className="p-3 text-right text-ink">{m.orders}</td>
                <td className="p-3 text-right font-semibold text-ink">{baht(m.total_spent)}</td>
                <td className="p-3 text-muted">{dateTime(m.created_at)}</td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold ${
                      m.role === 'admin' ? 'bg-accent-strong/15 text-accent-strong' : 'bg-sunken text-muted'
                    }`}
                  >
                    {m.role === 'admin' && <ShieldCheck className="w-3 h-3" aria-hidden />}
                    {m.role}
                  </span>
                </td>
                <td className="p-3 text-right">
                  {/* Nobody changes their own role: the server refuses it too. */}
                  {m.id !== user?.id && (
                    <button
                      type="button"
                      onClick={() => setEditing(m)}
                      aria-label={`Edit ${m.full_name}`}
                      title="Edit role"
                      className="p-2 text-ink hover:bg-sunken rounded-lg"
                    >
                      <Pencil className="w-4 h-4" aria-hidden />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">No members found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager page={page} total={total} onPage={setPage} />

      <CreateMember isOpen={creating} onClose={() => setCreating(false)} onCreated={() => (page === 1 ? fetchMembers() : setPage(1))} />
      <EditRole member={editing} onClose={() => setEditing(null)} onSaved={fetchMembers} />
    </div>
  );
};

export default AdminMembers;
