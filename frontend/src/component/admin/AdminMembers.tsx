import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../../lib/errorMessage';
import { api, ApiError } from '../../lib/api';
import { baht, localDateTime } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../common/Modal';
import { showAdminError } from './adminError';
import Pager, { PAGE_SIZE } from './Pager';
import { dangerButton, iconButton, primaryButtonInline, secondaryButton } from '../ui/buttonStyles';
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
  /** Removed while they had orders: cannot sign in, orders kept. */
  deactivated_at?: string | null;
}

const RoleSelect: React.FC<{ id: string; value: Role; onChange: (r: Role) => void }> = ({ id, value, onChange }) => {
  const { t } = useTranslation();
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as Role)} className={fieldClass()}>
      <option value="user">{t('admin.members.role_user')}</option>
      <option value="admin">{t('admin.members.role_admin')}</option>
    </select>
  );
};

const emptyNew = { full_name: '', email: '', phone: '', role: 'user' as Role };

/** Creates a Member by invitation: they get an email to set their own password, so the admin never knows it. */
const CreateMember: React.FC<{ isOpen: boolean; onClose: () => void; onCreated: () => void }> = ({ isOpen, onClose, onCreated }) => {
  const { t } = useTranslation();
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
      Swal.fire({ icon: 'success', title: t('admin.members.invited'), text: t('admin.members.invited_text', { email: form.email }), timer: 1800, showConfirmButton: false });
    } catch (err: any) {
      setError(err instanceof ApiError && err.status === 409 ? t('admin.members.email_taken') : err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('admin.members.new')} maxWidth="md">
      <form onSubmit={submit} className="space-y-4 text-sm">
        <div>
          <label htmlFor="member-name" className={fieldLabel}>{t('admin.members.full_name')}</label>
          <input id="member-name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={fieldClass()} />
        </div>
        <div>
          <label htmlFor="member-email" className={fieldLabel}>{t('admin.members.email')}</label>
          <input id="member-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={fieldClass()} />
        </div>
        <div>
          <label htmlFor="member-phone" className={fieldLabel}>
            {t('admin.members.phone')} <span className="font-normal text-muted">({t('login_page.optional')})</span>
          </label>
          <input id="member-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={fieldClass()} />
        </div>
        <div>
          <label htmlFor="member-role" className={fieldLabel}>{t('admin.members.role')}</label>
          <RoleSelect id="member-role" value={form.role} onChange={(role) => setForm({ ...form, role })} />
        </div>
        <p className="text-muted">{t('admin.members.invite_note')}</p>
        {error && <p role="alert" className="text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButton}>{t('admin.common.cancel')}</button>
          <button type="submit" disabled={saving} className={primaryButtonInline}>{saving ? t('admin.settings.sending') : t('admin.members.send_invite')}</button>
        </div>
      </form>
    </Modal>
  );
};

/** A Member's profile, read-only except for the role. */
const EditRole: React.FC<{ member: Member | null; onClose: () => void; onSaved: () => void }> = ({ member, onClose, onSaved }) => {
  const { t, i18n } = useTranslation();
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
      showAdminError(err, t);
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
              [t('admin.members.email'), member.email || '—'],
              [t('admin.members.phone'), member.phone || '—'],
              [t('admin.members.joined'), localDateTime(member.created_at, i18n.language)],
              [t('admin.common.orders'), t('admin.members.orders_spent', { count: member.orders, amount: baht(member.total_spent) })],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-4 py-2.5">
                <dt className="w-20 shrink-0 text-muted">{label}</dt>
                <dd className="min-w-0 break-all text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <label htmlFor="edit-role" className={fieldLabel}>{t('admin.members.role')}</label>
            <RoleSelect id="edit-role" value={role} onChange={setRole} />
            {role === 'admin' && member.role !== 'admin' && <p className="mt-2 text-muted">{t('admin.members.admin_note')}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={secondaryButton}>{t('admin.common.cancel')}</button>
            <button type="submit" disabled={saving} className={primaryButtonInline}>{t('admin.members.save_role')}</button>
          </div>
        </form>
      )}
    </Modal>
  );
};

/** Confirms removing a Member: deleted when they have no orders, Deactivated when they do (CONTEXT.md: Member). */
const RemoveMember: React.FC<{ member: Member | null; onClose: () => void; onRemoved: () => void }> = ({ member, onClose, onRemoved }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const deactivate = !!member && member.orders > 0;
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setError(''), [member]);
  // design.md: focus starts on the safe choice. After the Modal has moved focus into its panel.
  useEffect(() => {
    if (!member) return;
    const id = setTimeout(() => keepRef.current?.focus());
    return () => clearTimeout(id);
  }, [member]);

  const remove = async () => {
    if (!member) return;
    setBusy(true);
    setError('');
    try {
      await api.delete(`/admin/customers/${member.id}`);
      onClose();
      onRemoved();
    } catch (err: any) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={!!member} onClose={onClose} title={member ? t('admin.members.remove_title', { name: member.full_name }) : ''} maxWidth="md">
      {member && (
        <div className="space-y-4 text-sm">
          <p className="text-ink">
            {deactivate
              ? t('admin.members.deactivate_text', { name: member.full_name, count: member.orders })
              : t('admin.members.delete_text', { name: member.full_name })}
          </p>
          {error && <p role="alert" className="text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button ref={keepRef} type="button" onClick={onClose} className={secondaryButton}>{t('admin.members.keep')}</button>
            <button type="button" onClick={remove} disabled={busy} className={dangerButton}>
              <Trash2 className="w-4 h-4" aria-hidden />
              {deactivate ? t('admin.members.deactivate') : t('admin.common.delete')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

const AdminMembers: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);

  const fetchMembers = useCallback(async () => {
    const q = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (search) q.set('search', search);
    try {
      const data = await api.get<{ customers: Member[]; total: number }>(`/admin/customers?${q}`);
      setMembers(data.customers || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      showAdminError(err, t);
    }
  }, [page, search, t]);

  useEffect(() => {
    const timer = setTimeout(fetchMembers, 250);
    return () => clearTimeout(timer);
  }, [fetchMembers]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between mb-4">
        <div className="flex-1 max-w-sm">
          <label htmlFor="member-search" className={fieldLabel}>{t('admin.members.search')}</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden />
            <input
              id="member-search"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder={t('admin.members.search_placeholder')}
              className={`${fieldClass()} pl-9`}
            />
          </div>
        </div>
        <button type="button" onClick={() => setCreating(true)} className={primaryButtonInline}>
          <Plus className="w-4 h-4" aria-hidden /> {t('admin.members.new')}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-sunken text-muted">
              <th className="p-3 font-semibold">{t('admin.members.member')}</th>
              <th className="p-3 font-semibold">{t('admin.members.phone')}</th>
              <th className="p-3 font-semibold text-right">{t('admin.common.orders')}</th>
              <th className="p-3 font-semibold text-right">{t('admin.members.spent')}</th>
              <th className="p-3 font-semibold">{t('admin.members.joined')}</th>
              <th className="p-3 font-semibold">{t('admin.members.role')}</th>
              <th className="p-3">
                <span className="sr-only">{t('admin.common.actions')}</span>
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
                <td className="p-3 text-muted">{localDateTime(m.created_at, i18n.language)}</td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold ${
                      m.role === 'admin' ? 'bg-accent-strong/15 text-accent-strong' : 'bg-sunken text-muted'
                    }`}
                  >
                    {m.role === 'admin' && <ShieldCheck className="w-3 h-3" aria-hidden />}
                    {m.role === 'admin' ? t('admin.members.role_admin') : t('admin.members.role_customer')}
                  </span>
                  {m.deactivated_at && (
                    <span className="ml-1 inline-flex px-2 py-1 rounded-md text-xs font-semibold border border-line text-muted">{t('admin.members.deactivated')}</span>
                  )}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  {/* Nobody changes their own role or removes themselves: the server refuses it too. */}
                  {m.id !== user?.id && !m.deactivated_at && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditing(m)}
                        aria-label={t('admin.products.edit_named', { name: m.full_name })}
                        title={t('admin.members.edit_role')}
                        className={iconButton}
                      >
                        <Pencil className="w-4 h-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemoving(m)}
                        aria-label={t('admin.members.remove_named', { name: m.full_name })}
                        title={t('admin.members.remove')}
                        className={`${iconButton} hover:text-danger`}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">{t('admin.members.none')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager page={page} total={total} onPage={setPage} />

      <CreateMember isOpen={creating} onClose={() => setCreating(false)} onCreated={() => (page === 1 ? fetchMembers() : setPage(1))} />
      <EditRole member={editing} onClose={() => setEditing(null)} onSaved={fetchMembers} />
      <RemoveMember member={removing} onClose={() => setRemoving(null)} onRemoved={fetchMembers} />
    </div>
  );
};

export default AdminMembers;
