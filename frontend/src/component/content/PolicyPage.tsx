import React from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../ui/Feedback';

/**
 * The layout every policy page shares (shipping, FAQ, terms, privacy): one title, sections of prose
 * at reading width, and the date the text last changed.
 */
export const PolicyPage: React.FC<{ title: string; description?: string; updated: string; children: React.ReactNode }> = ({
  title,
  description,
  updated,
  children,
}) => {
  const { t, i18n } = useTranslation();
  // Midnight local time: a bare ISO date parses as UTC and would show the previous day west of Greenwich.
  const date = new Date(`${updated}T00:00:00`).toLocaleDateString((i18n.language || 'th').startsWith('th') ? 'th-TH' : 'en-GB', { dateStyle: 'long' });
  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
      <PageHeader title={title} description={description} />
      <div className="mt-8 space-y-10">{children}</div>
      <p className="mt-12 border-t border-line pt-4 text-xs text-muted">{t('policy.updated', { date })}</p>
    </div>
  );
};

/** One titled section of a policy. Paragraphs and lists inside it get the reading rhythm. */
export const PolicySection: React.FC<{ title: string; id?: string; children: React.ReactNode }> = ({ title, id, children }) => (
  <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="scroll-mt-24">
    <h2 id={id ? `${id}-title` : undefined} className="font-display text-xl font-bold text-ink">
      {title}
    </h2>
    <div className="mt-3 space-y-3 text-[0.9375rem] leading-relaxed text-ink [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:marker:text-muted">
      {children}
    </div>
  </section>
);

/** A list of sentences stored as an array in the locale file. */
export const PolicyList: React.FC<{ items: string[] }> = ({ items }) => (
  <ul>
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
);
