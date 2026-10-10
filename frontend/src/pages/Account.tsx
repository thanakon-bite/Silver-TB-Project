import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Plus, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errorMessage';
import { formatAddressLines } from '../lib/format';
import type { Address } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../component/common/Modal';
import AddressForm, { addressToForm, emptyAddress, pruneErrors, toAddressPayload, validateAddress, AddressFormValue } from '../component/address/AddressForm';
import { ErrorBox, Notice, PageHeader } from '../component/ui/Feedback';
import { primaryButton, primaryButtonInline, secondaryButton, textLink } from '../component/ui/buttonStyles';
import { fieldClass, fieldLabel } from '../component/ui/fieldStyles';

const sectionTitle = 'font-display text-xl font-bold text-ink';

/**
 * One saved address. Deleting is confirmed in place (design.md: destructive actions never use a popup),
 * with focus on the safe choice.
 */
const AddressItem: React.FC<{
  address: Address;
  onEdit: () => void;
  onMakeDefault: () => Promise<void>;
  onDelete: () => Promise<void>;
}> = ({ address: a, onEdit, onMakeDefault, onDelete }) => {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <li className={`rounded-xl border p-4 text-sm ${a.is_default ? 'border-accent-strong/60' : 'border-line'}`}>
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
        {a.label && <span className="text-ink">{a.label}</span>}
        {a.is_default && <span className="rounded-md bg-accent-strong/10 px-1.5 py-0.5 text-accent-strong">{t('checkout_page.default_address')}</span>}
      </p>
      {formatAddressLines(a).map((l, i) => (
        <div key={i} className={i === 0 ? 'font-semibold text-ink' : 'text-muted'}>
          {l}
        </div>
      ))}

      {confirming ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-ink">{t('account_page.delete_question')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button ref={keepRef} type="button" onClick={() => setConfirming(false)} disabled={busy} className={secondaryButton}>
              {t('order_page.cancel_keep')}
            </button>
            <button
              type="button"
              onClick={() => run(onDelete)}
              disabled={busy}
              className="inline-flex items-center rounded-xl border border-danger/40 px-4 py-2.5 text-sm font-semibold text-danger hover:bg-danger/5 disabled:opacity-60"
            >
              {busy ? t('account_page.deleting') : t('account_page.delete_confirm')}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3">
          <button type="button" onClick={onEdit} className={`${textLink} py-1`}>
            {t('account_page.edit')}
          </button>
          {!a.is_default && (
            <button type="button" onClick={() => run(onMakeDefault)} disabled={busy} className={`${textLink} py-1`}>
              {t('account_page.make_default')}
            </button>
          )}
          <button type="button" onClick={() => setConfirming(true)} className="py-1 text-muted underline-offset-4 hover:text-danger hover:underline">
            {t('account_page.delete')}
          </button>
        </div>
      )}
    </li>
  );
};

const Account: React.FC = () => {
  const { t } = useTranslation();
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState({ full_name: user?.full_name || '', phone: user?.phone || '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [addressError, setAddressError] = useState('');
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const [form, setForm] = useState<AddressFormValue>(emptyAddress());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAddresses = () => api.get<Address[]>('/addresses').then(setAddresses).catch(() => setAddresses([]));
  useEffect(() => {
    loadAddresses();
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileStatus(null);
    try {
      await api.patch('/auth/profile', { full_name: profile.full_name, phone: profile.phone || null });
      await refreshProfile();
      setProfileStatus({ ok: true, text: t('account_page.profile_saved') });
    } catch (err) {
      setProfileStatus({ ok: false, text: errorMessage(err, t) });
    } finally {
      setSavingProfile(false);
    }
  };

  const openEditor = (a: Address | 'new') => {
    setEditing(a);
    setErrors({});
    setSaveError('');
    setForm(a === 'new' ? emptyAddress({ recipient_name: user?.full_name || '', phone: user?.phone || '' }) : addressToForm(a));
  };

  const saveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateAddress(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setSaveError('');
    try {
      if (editing === 'new') await api.post('/addresses', toAddressPayload(form));
      else if (editing) await api.patch(`/addresses/${editing.id}`, toAddressPayload(form));
      setEditing(null);
      await loadAddresses();
    } catch (err) {
      setSaveError(errorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  const act = (fn: () => Promise<unknown>) => async () => {
    setAddressError('');
    try {
      await fn();
    } catch (err) {
      setAddressError(errorMessage(err, t));
    }
    await loadAddresses();
  };

  const full = (addresses?.length ?? 0) >= 10;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
      <PageHeader
        title={t('nav.my_account')}
        description={user?.email}
        action={
          <Link to="/orders" className={textLink}>
            {t('order_page.my_orders')} →
          </Link>
        }
      />

      <form onSubmit={saveProfile} className="grid gap-6 border-b border-line py-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div>
          <h2 className={sectionTitle}>{t('account_page.profile')}</h2>
          <p className="mt-1 text-sm text-muted">{t('account_page.profile_text')}</p>
        </div>
        <div className="max-w-xl space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="acc-name" className={fieldLabel}>
                {t('full_name')}
              </label>
              <input
                id="acc-name"
                autoComplete="name"
                className={fieldClass()}
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                required
                maxLength={120}
              />
            </div>
            <div>
              <label htmlFor="acc-phone" className={fieldLabel}>
                {t('phone')} <span className="font-normal text-muted">({t('login_page.optional')})</span>
              </label>
              <input
                id="acc-phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                className={fieldClass()}
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </div>
          </div>
          {profileStatus &&
            (profileStatus.ok ? (
              <Notice icon={<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />}>{profileStatus.text}</Notice>
            ) : (
              <ErrorBox title={t('account_page.save_error')}>{profileStatus.text}</ErrorBox>
            ))}
          <button disabled={savingProfile} className={primaryButtonInline}>
            {savingProfile ? t('account_page.saving') : t('account_page.save_profile')}
          </button>
        </div>
      </form>

      <section className="grid gap-6 py-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div>
          <h2 className={sectionTitle}>{t('account_page.addresses')}</h2>
          <p className="mt-1 text-sm text-muted">{full ? t('account_page.addresses_full') : t('account_page.addresses_text')}</p>
        </div>
        <div className="space-y-4">
          {addressError && <ErrorBox>{addressError}</ErrorBox>}
          {addresses === null ? (
            <p role="status" className="text-sm text-muted">
              {t('checkout_page.loading_addresses')}
            </p>
          ) : (
            <>
              {addresses.length === 0 && <p className="text-sm text-muted">{t('account_page.no_addresses')}</p>}
              {addresses.length > 0 && (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {addresses.map((a) => (
                    <AddressItem
                      key={a.id}
                      address={a}
                      onEdit={() => openEditor(a)}
                      onMakeDefault={act(() => api.post(`/addresses/${a.id}/default`, {}))}
                      onDelete={act(() => api.delete(`/addresses/${a.id}`))}
                    />
                  ))}
                </ul>
              )}
              <button type="button" onClick={() => openEditor('new')} disabled={full} className={secondaryButton}>
                <Plus className="h-4 w-4" aria-hidden />
                {t('account_page.add_address')}
              </button>
            </>
          )}
        </div>
      </section>

      <Modal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? t('account_page.add_address') : t('account_page.edit_address')}
        maxWidth="2xl"
      >
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
          {saveError && <ErrorBox title={t('account_page.save_error')}>{saveError}</ErrorBox>}
          <button disabled={saving} className={primaryButton}>
            {saving ? t('account_page.saving') : t('account_page.save_address')}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default Account;
