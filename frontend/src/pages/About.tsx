import React from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../component/ui/Feedback';
import ContactSection from '../component/content/ContactSection';

const About: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
      <PageHeader title="Silver Thief Bug" description={t('about_subtitle', 'We provide the best exotic beetles and pet insects for enthusiasts everywhere.')} />
      <ContactSection />
    </div>
  );
};

export default About;
