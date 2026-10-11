import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { baht, tierLabel } from '../lib/format';
import type { ShippingRule } from '../lib/types';
import { PolicyList, PolicyPage, PolicySection } from '../component/content/PolicyPage';
import { textLink } from '../component/ui/buttonStyles';

const UPDATED = '2026-10-10';

/**
 * The one place that explains the Shipping Fee, Shipping Days, the Live Arrival Guarantee and Refunds
 * (CONTEXT.md). Other pages summarise in a line and link here.
 */
const ShippingPolicy: React.FC = () => {
  const { t } = useTranslation();
  const list = (key: string) => t(key, { returnObjects: true }) as unknown as string[];

  // The Shipping Rule is read from the server, never written into the copy, so it always matches checkout.
  const [rule, setRule] = useState<ShippingRule | null | 'unknown'>(null);
  useEffect(() => {
    api
      .get<ShippingRule>('/rules/shipping')
      .then(setRule)
      .catch(() => setRule('unknown'));
  }, []);

  // No tiers set up: one flat fee for every order.
  const flat = rule && rule !== 'unknown' && rule.tiers.length === 0 ? Number(rule.fallback_fee || 0) : null;
  const feeLine =
    rule === null
      ? null
      : rule === 'unknown'
        ? t('shipping_page.fee_unknown')
        : flat === null
          ? null
          : flat > 0
            ? t('shipping_page.fee_amount', { amount: baht(flat) })
            : t('shipping_page.fee_free');
  const tiers = rule && rule !== 'unknown' && rule.tiers.length > 0 ? rule : null;

  return (
    <PolicyPage title={t('shipping_policy')} description={t('shipping_page.description')} updated={UPDATED}>
      <PolicySection id="fee" title={t('shipping_page.fee_title')}>
        {tiers && (
          <div className="space-y-3">
            <p>{t('shipping_page.fee_tiers_intro')}</p>
            <table className="w-full max-w-sm text-left">
              <tbody>
                {tiers.tiers.map((tier) => (
                  <tr key={tier.min_units} className="border-b border-line">
                    <td className="py-2 pr-4">{tierLabel(tier, t)}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-ink">{baht(tier.fee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tiers.free_threshold !== null && <p>{t('shipping_page.fee_free_over', { amount: baht(tiers.free_threshold) })}</p>}
          </div>
        )}
        <p aria-live="polite">{feeLine ?? ' '}</p>
      </PolicySection>

      <PolicySection id="when" title={t('shipping_page.when_title')}>
        <PolicyList items={list('shipping_page.when')} />
      </PolicySection>

      <PolicySection id="guarantee" title={t('shipping_page.guarantee_title')}>
        <p>{t('shipping_page.guarantee_intro')}</p>
        <h3 className="pt-2 font-semibold text-ink">{t('shipping_page.claim_title')}</h3>
        <PolicyList items={list('shipping_page.claim')} />
        <h3 className="pt-2 font-semibold text-ink">{t('shipping_page.not_covered_title')}</h3>
        <PolicyList items={list('shipping_page.not_covered')} />
      </PolicySection>

      <PolicySection id="refund" title={t('shipping_page.refund_title')}>
        <PolicyList items={list('shipping_page.refund')} />
      </PolicySection>

      <p className="text-[0.9375rem] text-ink">
        {t('shipping_page.help')}{' '}
        <Link to="/contact" className={textLink}>
          {t('checkout_page.contact_shop')}
        </Link>
      </p>
    </PolicyPage>
  );
};

export default ShippingPolicy;
