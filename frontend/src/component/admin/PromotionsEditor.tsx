import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { errorMessage } from '../../lib/errorMessage';
import { api } from '../../lib/api';
import { amountText, type DiscountTier, type Stacking } from '../../lib/promotions';
import Modal from '../common/Modal';
import { dangerButton, iconButton, primaryButtonInline, secondaryButton } from '../ui/buttonStyles';
import { fieldClass, fieldLabel } from '../ui/fieldStyles';

/** A Promotion as GET /admin/promotions returns it (CONTEXT.md: Promotion, Redemption). */
interface AdminPromotion {
  id: string;
  name_th: string;
  name_en: string | null;
  starts_at: string;
  ends_at: string;
  applies_to_all: boolean;
  product_ids: string[];
  gift_product_ids: string[];
  discount_tiers: DiscountTier[];
  gift_every: number | null;
  gift_quantity: number | null;
  per_customer_limit: number | null;
  customer_limit: number | null;
  stacking: Stacking;
  is_active: boolean;
  redemptions: number;
  customers: number;
}

interface ProductOption {
  id: string;
  name: string;
  name_th: string | null;
  is_active: boolean;
}

interface TierRow {
  min_units: string;
  type: 'percent' | 'baht';
  value: string;
}

interface Form {
  name_th: string;
  name_en: string;
  start_date: string;
  end_date: string;
  applies_to_all: boolean;
  product_ids: string[];
  tiers: TierRow[];
  gift_every: string;
  gift_quantity: string;
  gift_product_ids: string[];
  per_customer_limit: string;
  customer_limit: string;
  stacking: Stacking;
  is_active: boolean;
}

/** The Thai calendar date of a stored timestamp: Promotions run on Thai days, both ends included. */
const bangkokDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

const emptyForm: Form = {
  name_th: '',
  name_en: '',
  start_date: '',
  end_date: '',
  applies_to_all: false,
  product_ids: [],
  tiers: [],
  gift_every: '',
  gift_quantity: '',
  gift_product_ids: [],
  per_customer_limit: '',
  customer_limit: '',
  // New Promotions never combine by accident (ADR 0004)
  stacking: 'exclusive',
  is_active: true,
};

const toForm = (p: AdminPromotion): Form => ({
  name_th: p.name_th,
  name_en: p.name_en || '',
  start_date: bangkokDate(p.starts_at),
  end_date: bangkokDate(p.ends_at),
  applies_to_all: p.applies_to_all,
  product_ids: p.product_ids,
  tiers: p.discount_tiers.map((t) => ({ min_units: String(t.min_units), type: t.type, value: String(t.value) })),
  gift_every: p.gift_every === null ? '' : String(p.gift_every),
  gift_quantity: p.gift_quantity === null ? '' : String(p.gift_quantity),
  gift_product_ids: p.gift_product_ids || [],
  per_customer_limit: p.per_customer_limit === null ? '' : String(p.per_customer_limit),
  customer_limit: p.customer_limit === null ? '' : String(p.customer_limit),
  stacking: p.stacking || 'exclusive',
  is_active: p.is_active,
});

const toBody = (f: Form) => ({
  name_th: f.name_th,
  name_en: f.name_en,
  start_date: f.start_date,
  end_date: f.end_date,
  applies_to_all: f.applies_to_all,
  product_ids: f.applies_to_all ? [] : f.product_ids,
  discount_tiers: f.tiers.map((t) => ({ min_units: Number(t.min_units), type: t.type, value: Number(t.value) })),
  gift_every: f.gift_every.trim() === '' ? null : Number(f.gift_every),
  gift_quantity: f.gift_quantity.trim() === '' ? null : Number(f.gift_quantity),
  gift_product_ids: f.gift_every.trim() === '' ? [] : f.gift_product_ids,
  per_customer_limit: f.per_customer_limit.trim() === '' ? null : Number(f.per_customer_limit),
  customer_limit: f.customer_limit.trim() === '' ? null : Number(f.customer_limit),
  stacking: f.stacking,
  is_active: f.is_active,
});

/** A Promotion's benefits as tags: its Discount Tiers from fewest units up ("3+ ชิ้น −10%"), then its Gift ("ซื้อ 3 แถม 1"). */
const PromotionTags: React.FC<{ promotion: AdminPromotion; t: TFunction }> = ({ promotion: p, t }) => {
  const tiers = [...p.discount_tiers].sort((a, b) => a.min_units - b.min_units);
  const tag = 'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap';
  return (
    <ul aria-label={t('admin.promos.tags_for', { name: p.name_th })} className="flex flex-wrap gap-1.5">
      {tiers.map((tier) => (
        <li key={tier.min_units} className={`${tag} bg-accent-strong/10 text-accent-strong`}>
          {t('admin.promos.tier_tag', { count: tier.min_units, amount: amountText(tier, t) })}
        </li>
      ))}
      {p.gift_every && p.gift_quantity ? (
        <li className={`${tag} border border-accent-strong/40 text-ink`}>{t('admin.promos.gift_tag', { every: p.gift_every, gift: p.gift_quantity })}</li>
      ) : null}
      <li className={`${tag} ${p.stacking === 'stackable' ? 'bg-sunken text-ink' : 'font-normal text-muted'}`}>
        {t(`admin.promos.tag_${p.stacking === 'stackable' ? 'stackable' : 'exclusive'}`)}
      </li>
    </ul>
  );
};

const PromotionForm: React.FC<{
  editing: AdminPromotion | 'new' | null;
  products: ProductOption[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ editing, products, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<Form>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // After the start, Customers may have redeemed it: what it covers and gives stays fixed.
  const started = editing !== null && editing !== 'new' && new Date(editing.starts_at) <= new Date();

  useEffect(() => {
    if (!editing) return;
    setForm(editing === 'new' ? emptyForm : toForm(editing));
    setError('');
  }, [editing]);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const setTier = (i: number, patch: Partial<TierRow>) => set({ tiers: form.tiers.map((row, j) => (j === i ? { ...row, ...patch } : row)) });
  const toggleProduct = (id: string) =>
    set({ product_ids: form.product_ids.includes(id) ? form.product_ids.filter((x) => x !== id) : [...form.product_ids, id] });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing === 'new') await api.post('/admin/promotions', toBody(form));
      else if (editing) await api.patch(`/admin/promotions/${editing.id}`, toBody(form));
      onClose();
      onSaved();
    } catch (err: any) {
      setError(errorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  const title = editing === 'new' ? t('admin.promos.new') : editing ? editing.name_th : '';

  return (
    <Modal isOpen={!!editing} onClose={onClose} title={title} maxWidth="2xl">
      <form onSubmit={save} className="space-y-5 text-sm">
        {started && (
          <p className="rounded-lg border border-line bg-sunken p-3 text-muted">
            {t('admin.promos.started')}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="promo-name-th" className={fieldLabel}>{t('admin.products.name_th')}</label>
            <input id="promo-name-th" required maxLength={120} value={form.name_th} onChange={(e) => set({ name_th: e.target.value })} className={fieldClass()} />
          </div>
          <div>
            <label htmlFor="promo-name-en" className={fieldLabel}>
              {t('admin.products.name_en')} <span className="font-normal text-muted">({t('login_page.optional')})</span>
            </label>
            <input id="promo-name-en" maxLength={120} value={form.name_en} onChange={(e) => set({ name_en: e.target.value })} className={fieldClass()} />
          </div>
          <div>
            <label htmlFor="promo-start" className={fieldLabel}>{t('admin.promos.start')}</label>
            <input id="promo-start" type="date" required disabled={started} value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} className={fieldClass()} />
          </div>
          <div>
            <label htmlFor="promo-end" className={fieldLabel}>{t('admin.promos.end')}</label>
            <input id="promo-end" type="date" required value={form.end_date} onChange={(e) => set({ end_date: e.target.value })} className={fieldClass()} />
          </div>
        </div>
        <p className="-mt-2 text-muted">{t('admin.promos.time_note')}</p>

        <fieldset disabled={started} className="space-y-2">
          <legend className={fieldLabel}>{t('admin.common.products')}</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-accent-strong" checked={form.applies_to_all} onChange={(e) => set({ applies_to_all: e.target.checked })} />
            {t('admin.promos.all_products')}
          </label>
          {!form.applies_to_all && (
            <div role="group" aria-label={t('admin.promos.products_group')} className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line p-3">
              {products.length === 0 && <p className="text-muted">{t('admin.common.loading_products')}</p>}
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-2">
                  <input type="checkbox" className="accent-accent-strong" checked={form.product_ids.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                  <span className="text-ink">{p.name}</span>
                  {p.name_th && <span className="text-muted">· {p.name_th}</span>}
                  {!p.is_active && <span className="text-xs text-muted">({t('admin.products.inactive')})</span>}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset disabled={started} className="space-y-2">
          <legend className={fieldLabel}>{t('admin.promos.discount')}</legend>
          <p className="text-muted">{t('admin.promos.discount_note')}</p>
          {form.tiers.map((tier, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={1}
                step={1}
                aria-label={t('admin.promos.buy_at_least', { n: i + 1 })}
                value={tier.min_units}
                onChange={(e) => setTier(i, { min_units: e.target.value })}
                className={`${fieldClass()} w-24`}
              />
              <select aria-label={t('admin.promos.discount_type', { n: i + 1 })} value={tier.type} onChange={(e) => setTier(i, { type: e.target.value as TierRow['type'] })} className={`${fieldClass()} w-32`}>
                <option value="percent">{t('admin.promos.percent_off')}</option>
                <option value="baht">{t('admin.promos.baht_off')}</option>
              </select>
              <input
                type="number"
                min={0}
                step="0.01"
                aria-label={t('admin.promos.discount_tier', { n: i + 1 })}
                value={tier.value}
                onChange={(e) => setTier(i, { value: e.target.value })}
                className={`${fieldClass()} w-28`}
              />
              <button type="button" onClick={() => set({ tiers: form.tiers.filter((_, j) => j !== i) })} aria-label={t('admin.promos.remove_tier', { n: i + 1 })} className={`${iconButton} hover:text-danger`}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const last = form.tiers[form.tiers.length - 1];
              set({ tiers: [...form.tiers, { min_units: String(last ? Number(last.min_units) + 1 : 1), type: last?.type || 'percent', value: '' }] });
            }}
            className={secondaryButton}
          >
            <Plus className="h-4 w-4" aria-hidden /> {t('admin.promos.add_tier')}
          </button>
        </fieldset>

        <fieldset disabled={started} className="space-y-2">
          <legend className={fieldLabel}>{t('promotions.gift_label')}</legend>
          <p className="text-muted">{t('admin.promos.gift_note')}</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="promo-gift-every" className={fieldLabel}>{t('admin.promos.gift_every')}</label>
              <input id="promo-gift-every" type="number" min={1} step={1} placeholder={t('admin.promos.no_gift')} value={form.gift_every} onChange={(e) => set({ gift_every: e.target.value })} className={`${fieldClass()} w-36`} />
            </div>
            <div>
              <label htmlFor="promo-gift-qty" className={fieldLabel}>{t('admin.promos.gift_qty')}</label>
              <input id="promo-gift-qty" type="number" min={1} step={1} value={form.gift_quantity} onChange={(e) => set({ gift_quantity: e.target.value })} className={`${fieldClass()} w-28`} />
            </div>
          </div>
          <div role="group" aria-label={t('admin.promos.gift_products')} className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-line p-3">
            {products.map((p) => (
              <label key={p.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-accent-strong"
                  checked={form.gift_product_ids.includes(p.id)}
                  onChange={() =>
                    set({
                      gift_product_ids: form.gift_product_ids.includes(p.id) ? form.gift_product_ids.filter((x) => x !== p.id) : [...form.gift_product_ids, p.id],
                    })
                  }
                />
                <span className="text-ink">{p.name}</span>
                {!p.is_active && <span className="text-xs text-muted">({t('admin.promos.not_for_sale')})</span>}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset disabled={started} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="promo-per-customer" className={fieldLabel}>{t('admin.promos.per_customer')}</label>
            <input id="promo-per-customer" type="number" min={1} step={1} placeholder={t('admin.promos.unlimited')} value={form.per_customer_limit} onChange={(e) => set({ per_customer_limit: e.target.value })} className={fieldClass()} />
          </div>
          <div>
            <label htmlFor="promo-customers" className={fieldLabel}>{t('admin.promos.customers_total')}</label>
            <input id="promo-customers" type="number" min={1} step={1} placeholder={t('admin.promos.unlimited')} value={form.customer_limit} onChange={(e) => set({ customer_limit: e.target.value })} className={fieldClass()} />
          </div>
        </fieldset>

        <fieldset disabled={started} className="space-y-2">
          <legend className={fieldLabel}>{t('admin.promos.stacking_label')}</legend>
          {(['exclusive', 'stackable'] as const).map((kind) => (
            <label key={kind} className="flex items-start gap-2">
              <input
                type="radio"
                name="promo-stacking"
                value={kind}
                className="mt-1 accent-accent-strong"
                checked={form.stacking === kind}
                onChange={() => set({ stacking: kind })}
              />
              <span>
                <span className="block text-ink">{t(`admin.promos.${kind}`)}</span>
                <span className="block text-muted">{t(`admin.promos.${kind}_hint`)}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-accent-strong" checked={form.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
          {t('admin.promos.on')}
        </label>

        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButton}>{t('admin.common.cancel')}</button>
          <button type="submit" disabled={saving} className={primaryButtonInline}>
            {saving ? t('admin.common.saving') : t('admin.promos.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

/** Admin list of Promotions with create / edit / delete. */
/** design.md "Destructive": deleting asks first, in one sentence, with focus on keeping the Promotion. */
const DeletePromotion: React.FC<{ promotion: AdminPromotion | null; onKeep: () => void; onDelete: (p: AdminPromotion) => void }> = ({
  promotion,
  onKeep,
  onDelete,
}) => {
  const { t } = useTranslation();
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!promotion) return;
    // After the Modal has moved focus into its panel
    const id = setTimeout(() => keepRef.current?.focus());
    return () => clearTimeout(id);
  }, [promotion]);

  return (
    <Modal isOpen={!!promotion} onClose={onKeep} title={promotion ? t('admin.promos.delete_title', { name: promotion.name_th }) : ''} maxWidth="md">
      {promotion && (
        <div className="space-y-4 text-sm">
          <p className="text-ink">{t('admin.promos.delete_text')}</p>
          <div className="flex justify-end gap-2">
            <button ref={keepRef} type="button" onClick={onKeep} className={secondaryButton}>
              {t('admin.promos.keep')}
            </button>
            <button type="button" onClick={() => onDelete(promotion)} className={dangerButton}>
              <Trash2 className="h-4 w-4" aria-hidden />
              {t('admin.common.delete')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

const PromotionsEditor: React.FC = () => {
  const { t } = useTranslation();
  const [list, setList] = useState<AdminPromotion[] | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [editing, setEditing] = useState<AdminPromotion | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminPromotion | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get<AdminPromotion[]>('/admin/promotions')
      .then(setList)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    api
      .get<{ products: ProductOption[] }>('/products/admin/all?limit=200')
      .then((d) => setProducts(d.products || []))
      .catch(() => {});
  }, [load]);

  const remove = async (p: AdminPromotion) => {
    setDeleting(null);
    setError('');
    try {
      await api.delete(`/admin/promotions/${p.id}`);
      load();
    } catch (err: any) {
      setError(errorMessage(err, t));
    }
  };

  const now = new Date();
  const state = (p: AdminPromotion) =>
    t(`admin.promos.state_${!p.is_active ? 'off' : new Date(p.starts_at) > now ? 'scheduled' : new Date(p.ends_at) < now ? 'ended' : 'running'}`);

  return (
    <section aria-label={t('admin.promos.title')} className="rounded-2xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <Tag className="h-5 w-5 text-accent-strong" aria-hidden /> {t('admin.promos.title')}
        </h2>
        <button type="button" onClick={() => setEditing('new')} className={primaryButtonInline}>
          <Plus className="h-4 w-4" aria-hidden /> {t('admin.promos.new')}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">{t('admin.promos.intro')}</p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-sunken text-muted">
              <th className="p-3 font-semibold">{t('promotions.title')}</th>
              <th className="p-3 font-semibold">{t('admin.promos.dates')}</th>
              <th className="p-3 font-semibold">{t('admin.promos.discount_gift')}</th>
              <th className="p-3 font-semibold">{t('admin.promos.used')}</th>
              <th className="p-3 font-semibold">{t('admin.common.status')}</th>
              <th className="p-3">
                <span className="sr-only">{t('admin.common.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list?.map((p) => (
              <tr key={p.id} className="border-b border-line">
                <td className="p-3">
                  <div className="font-semibold text-ink">{p.name_th}</div>
                  <div className="text-xs text-muted">{p.applies_to_all ? t('admin.promos.all_products') : t('admin.overview.n_products', { count: p.product_ids.length })}</div>
                </td>
                <td className="p-3 whitespace-nowrap text-muted">{`${bangkokDate(p.starts_at)} – ${bangkokDate(p.ends_at)}`}</td>
                <td className="p-3 text-ink">
                  <PromotionTags promotion={p} t={t} />
                </td>
                <td className="p-3 whitespace-nowrap text-muted">{`${t('admin.promos.redemptions_n', { count: p.redemptions })} · ${t('admin.promos.customers_n', { count: p.customers })}`}</td>
                <td className="p-3 text-muted">{state(p)}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button type="button" onClick={() => setEditing(p)} aria-label={t('admin.products.edit_named', { name: p.name_th })} className={iconButton}>
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button type="button" onClick={() => setDeleting(p)} aria-label={t('admin.promos.delete_named', { name: p.name_th })} className={`${iconButton} hover:text-danger`}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
            {list && list.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted">{t('admin.promos.none')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PromotionForm editing={editing} products={products} onClose={() => setEditing(null)} onSaved={load} />
      <DeletePromotion promotion={deleting} onKeep={() => setDeleting(null)} onDelete={remove} />
    </section>
  );
};

export default PromotionsEditor;
