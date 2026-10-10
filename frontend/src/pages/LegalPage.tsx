import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PolicyList, PolicyPage, PolicySection } from '../component/content/PolicyPage';
import { textLink } from '../component/ui/buttonStyles';

const UPDATED = '2026-10-10';

interface Section {
  id: string;
  title: string;
  text?: string[];
  items?: string[];
  /** A page holding the detail of this section, e.g. the shipping policy. */
  link?: { to: string; label: string };
}

/**
 * Terms of Service and the Privacy Policy, written in the locale files (`terms_page`, `privacy_page`).
 * Both are drafts until the seller is named; App only routes to them when PUBLISHED says so.
 * They should be read by someone qualified in Thai law before going live. The terms state the reservation
 * ("at least 30 minutes"): change it with ORDER_RESERVATION_MINUTES on the server.
 */
const LegalPage: React.FC<{ doc: 'terms' | 'privacy' }> = ({ doc }) => {
  const { t } = useTranslation();
  const key = doc === 'terms' ? 'terms_page' : 'privacy_page';
  const sections = t(`${key}.sections`, { returnObjects: true }) as unknown as Section[];

  return (
    <PolicyPage title={t(doc === 'terms' ? 'terms_of_service' : 'privacy_policy')} description={t(`${key}.description`)} updated={UPDATED}>
      {sections.map((s) => (
        <PolicySection key={s.id} id={s.id} title={s.title}>
          {s.text?.map((p) => <p key={p}>{p}</p>)}
          {s.items && <PolicyList items={s.items} />}
          {s.link && (
            <p>
              <Link to={s.link.to} className={textLink}>
                {s.link.label}
              </Link>
            </p>
          )}
        </PolicySection>
      ))}
    </PolicyPage>
  );
};

export default LegalPage;
