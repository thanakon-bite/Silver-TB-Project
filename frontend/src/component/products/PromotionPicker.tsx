import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Layers, Tag } from 'lucide-react';
import { promotionName, tierText, type DiscountTier } from '../../lib/promotions';

/** What a card needs to describe one Promotion; the tiers and Gift are shown when known. */
export interface PickerPromotion {
  id: string;
  name_th: string;
  name_en: string | null;
  discount_tiers?: DiscountTier[];
  gift_every?: number | null;
  gift_quantity?: number | null;
}

/** One way to take a product's Promotions: one Exclusive Promotion, or the Stackable ones together (ADR 0004). */
export interface PickerOption {
  key: string;
  kind: 'exclusive' | 'stack';
  promotions: PickerPromotion[];
  /** A line under the card, e.g. what it saves in the Cart. */
  note?: string;
}

/** The Promotion's tier and Gift lines, as the product page has always shown them. */
const Benefits: React.FC<{ promotion: PickerPromotion }> = ({ promotion: p }) => {
  const { t } = useTranslation();
  const tiers = [...(p.discount_tiers || [])].sort((a, b) => a.min_units - b.min_units);
  if (!tiers.length && !(p.gift_every && p.gift_quantity)) return null;
  return (
    <ul className="mt-0.5 space-y-0.5 text-ink">
      {tiers.map((tier) => (
        <li key={tier.min_units}>{tierText(tier, t)}</li>
      ))}
      {p.gift_every && p.gift_quantity ? <li>{t('promotions.gift_line', { every: p.gift_every, gift: p.gift_quantity })}</li> : null}
    </ul>
  );
};

/**
 * One card per option and the Customer picks one (a radio group). With a single option there is
 * nothing to pick, so the card is shown without a radio.
 */
const PromotionPicker: React.FC<{
  legend: string;
  /** The radio group's name: one group per product. */
  name: string;
  options: PickerOption[];
  value: string | null;
  onChange: (key: string) => void;
  compact?: boolean;
}> = ({ legend, name, options, value, onChange, compact = false }) => {
  const { t, i18n } = useTranslation();
  const isThai = (i18n.language || 'th').startsWith('th');
  const choosing = options.length > 1;
  const label = (o: PickerOption) => {
    const names = o.promotions.map((p) => promotionName(p, isThai)).join(' + ');
    return o.kind === 'stack' ? t('cart_page.option_stack', { names }) : names;
  };

  return (
    <fieldset className={`space-y-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      <legend className={`mb-1 font-medium text-ink ${compact ? '' : 'text-sm'}`}>{legend}</legend>
      {choosing && !compact && <p className="-mt-1 mb-1 text-xs text-muted">{t('promotions.choose_hint')}</p>}
      {options.map((o) => {
        const picked = choosing && value === o.key;
        const body = (
          <>
            {o.kind === 'stack' && (
              <p className="mb-1 inline-flex items-center gap-1 rounded-md bg-accent-strong/10 px-1.5 py-0.5 text-xs font-medium text-accent-strong">
                <Layers className="h-3.5 w-3.5" aria-hidden /> {t('promotions.stack_heading')}
              </p>
            )}
            {o.promotions.map((p) => (
              <div key={p.id} className="[&+&]:mt-2">
                <p className="flex items-center gap-1.5 font-semibold text-ink">
                  <Tag className="h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                  <span>{promotionName(p, isThai)}</span>
                </p>
                <Benefits promotion={p} />
              </div>
            ))}
            {o.note && <p className="mt-1.5 font-medium text-accent-strong">{o.note}</p>}
          </>
        );
        const card = `relative block rounded-xl border p-3 transition-colors motion-reduce:transition-none ${
          picked ? 'border-accent-strong bg-accent-strong/5 ring-1 ring-accent-strong' : 'border-line bg-paper'
        }`;
        if (!choosing) {
          return (
            <div key={o.key} className={card}>
              {body}
            </div>
          );
        }
        return (
          <label key={o.key} className={`${card} cursor-pointer hover:border-muted has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-strong`}>
            <input
              type="radio"
              name={name}
              value={o.key}
              checked={picked}
              onChange={() => onChange(o.key)}
              aria-label={o.note ? `${label(o)} · ${o.note}` : label(o)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border ${
                picked ? 'border-accent-strong bg-accent-strong text-accent-ink' : 'border-line bg-paper'
              }`}
            >
              {picked && <Check className="h-3.5 w-3.5" />}
            </span>
            <div className="pr-7">{body}</div>
          </label>
        );
      })}
    </fieldset>
  );
};

export default PromotionPicker;
