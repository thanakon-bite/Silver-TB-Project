import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Truck } from 'lucide-react';
import { errorMessage } from '../../lib/errorMessage';
import { api } from '../../lib/api';
import { baht, tierLabel } from '../../lib/format';
import type { ShippingRule } from '../../lib/types';
import { iconButton, primaryButtonInline, secondaryButton } from '../ui/buttonStyles';
import { fieldClass, fieldLabel } from '../ui/fieldStyles';
import PromotionsEditor from './PromotionsEditor';

/**
 * One row per Shipping Tier. Only "up to" and the fee are edited: each tier starts right after the
 * previous one ends and the last is always open-ended, so the ranges can never have gaps or overlaps.
 */
interface Row {
  max: string; // ignored on the last row
  fee: string;
}

const toRows = (rule: ShippingRule): Row[] => rule.tiers.map((t) => ({ max: t.max_units === null ? '' : String(t.max_units), fee: String(t.fee) }));

/** The tiers the rows describe, with each min derived from the row above. */
function toTiers(rows: Row[]) {
  let min = 1;
  return rows.map((r, i) => {
    const last = i === rows.length - 1;
    const max = last ? null : Math.max(min, Math.floor(Number(r.max) || min));
    const tier = { min_units: min, max_units: max, fee: Number(r.fee) || 0 };
    if (max !== null) min = max + 1;
    return tier;
  });
}

const ShippingRuleEditor: React.FC = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [free, setFree] = useState('');
  const [fallback, setFallback] = useState(0);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<ShippingRule>('/admin/rules/shipping')
      .then((rule) => {
        setRows(toRows(rule));
        setFree(rule.free_threshold === null ? '' : String(rule.free_threshold));
        setFallback(Number(rule.fallback_fee || 0));
      })
      .catch((e) => setError(e.message));
  }, []);

  const edit = (i: number, patch: Partial<Row>) => {
    setSaved(false);
    setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  // A new tier takes over one unit from the open-ended last tier, so nothing is left uncovered.
  const addTier = () => {
    setSaved(false);
    setRows((rs) => {
      if (!rs || rs.length === 0) return [{ max: '', fee: '0' }];
      const tiers = toTiers(rs);
      const lastMin = tiers[tiers.length - 1].min_units;
      const last = rs[rs.length - 1];
      return [...rs.slice(0, -1), { max: String(lastMin), fee: last.fee }, last];
    });
  };

  const removeTier = (i: number) => {
    setSaved(false);
    setRows((rs) => rs!.filter((_, j) => j !== i));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rows) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const rule = await api.put<ShippingRule>('/admin/rules/shipping', {
        tiers: toTiers(rows),
        free_threshold: free.trim() === '' ? null : Number(free),
      });
      setRows(toRows(rule));
      setSaved(true);
    } catch (err: any) {
      setError(errorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  const tiers = rows ? toTiers(rows) : [];

  return (
    <section aria-label={t('admin.rules.shipping_title')} className="rounded-2xl border border-line bg-paper p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
        <Truck className="h-5 w-5 text-accent-strong" aria-hidden /> {t('admin.rules.shipping_title')}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {t('admin.rules.shipping_intro')}
      </p>

      {rows === null ? (
        !error && <p className="mt-4 text-sm text-muted">{t('loading')}</p>
      ) : (
        <form onSubmit={save} className="mt-4 space-y-4 text-sm">
          {rows.length === 0 ? (
            <p className="text-muted">{t('admin.rules.no_tiers', { amount: baht(fallback) })}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full max-w-xl text-left">
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th className="py-2 pr-3 font-semibold">{t('admin.rules.units')}</th>
                    <th className="py-2 pr-3 font-semibold">{t('admin.rules.up_to')}</th>
                    <th className="py-2 pr-3 font-semibold">{t('admin.rules.fee')}</th>
                    <th className="py-2">
                      <span className="sr-only">{t('remove')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const last = i === rows.length - 1;
                    return (
                      <tr key={i} className="border-b border-line">
                        <td className="py-2 pr-3 whitespace-nowrap text-ink">{tierLabel(tiers[i], t)}</td>
                        <td className="py-2 pr-3">
                          {last ? (
                            <span className="text-muted" aria-hidden>
                              —
                            </span>
                          ) : (
                            <input
                              type="number"
                              min={tiers[i].min_units}
                              step={1}
                              aria-label={t('admin.rules.up_to_tier', { n: i + 1 })}
                              value={r.max}
                              onChange={(e) => edit(i, { max: e.target.value })}
                              className={`${fieldClass()} w-24`}
                            />
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            aria-label={t('admin.rules.fee_tier', { n: i + 1 })}
                            value={r.fee}
                            onChange={(e) => edit(i, { fee: e.target.value })}
                            className={`${fieldClass()} w-28`}
                          />
                        </td>
                        <td className="py-2 text-right">
                          {rows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTier(i)}
                              aria-label={t('admin.rules.remove_tier', { n: i + 1 })}
                              className={`${iconButton} hover:text-danger`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <button type="button" onClick={addTier} className={secondaryButton}>
            <Plus className="h-4 w-4" aria-hidden /> {t('admin.rules.add_tier')}
          </button>

          <div className="max-w-xs">
            <label htmlFor="free-threshold" className={fieldLabel}>
              {t('admin.rules.free_at')}
            </label>
            <input
              id="free-threshold"
              type="number"
              min={0}
              step="0.01"
              placeholder={t('admin.rules.off')}
              value={free}
              onChange={(e) => {
                setSaved(false);
                setFree(e.target.value);
              }}
              className={fieldClass()}
            />
            <p className="mt-1 text-muted">{t('admin.rules.free_hint')}</p>
          </div>

          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          {saved && <p role="status" className="text-success">{t('admin.common.saved')}</p>}
          <button type="submit" disabled={saving} className={primaryButtonInline}>
            {saving ? t('admin.common.saving') : t('admin.rules.save')}
          </button>
        </form>
      )}
      {rows === null && error && (
        <p role="alert" className="mt-4 text-danger">
          {error}
        </p>
      )}
    </section>
  );
};

/** Admin rules (กฎ): the Shipping Rule and Promotions. */
const AdminRules: React.FC = () => (
  <div className="space-y-6">
    <ShippingRuleEditor />
    <PromotionsEditor />
  </div>
);

export default AdminRules;
