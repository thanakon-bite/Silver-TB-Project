import React from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../component/ui/Feedback';
import ContactSection from '../component/content/ContactSection';

/** Every way to reach the shop. No form: customers come from Facebook and LINE and answer fastest there. */
const Contact: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
      <PageHeader title={t('contact_us')} description={t('contact_page.description')} />
      <ContactSection />
    </div>
  );
};

export default Contact;
