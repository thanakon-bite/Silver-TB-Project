import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { baht } from '../lib/format';
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

  // The fee is read from the server, never written into the copy, so it always matches checkout.
  const [fee, setFee] = useState<number | null | 'unknown'>(null);
  useEffect(() => {
    api
      .get<{ shipping_fee: number }>('/orders/shipping-fee')
      .then((r) => setFee(Number(r.shipping_fee)))
      .catch(() => setFee('unknown'));
  }, []);

  const feeLine =
    fee === null ? null : fee === 'unknown' ? t('shipping_page.fee_unknown') : fee > 0 ? t('shipping_page.fee_amount', { amount: baht(fee) }) : t('shipping_page.fee_free');

  return (
    <PolicyPage title={t('shipping_policy')} description={t('shipping_page.description')} updated={UPDATED}>
      <PolicySection id="fee" title={t('shipping_page.fee_title')}>
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
