import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Shield, Truck, Star, ExternalLink } from 'lucide-react';

const BEETLE_FACTS = [
  {
    emoji: '🦋',
    titleKey: 'metamorphosis',
    bodyKey: 'metamorphosis_desc',
  },
  {
    emoji: '🌍',
    titleKey: 'global_diversity',
    bodyKey: 'global_diversity_desc',
  },
  {
    emoji: '🍂',
    titleKey: 'diet_habitat',
    bodyKey: 'diet_habitat_desc',
  },
  {
    emoji: '🏆',
    titleKey: 'trophy_horns',
    bodyKey: 'trophy_horns_desc',
  },
];

const SOCIAL_LINKS = [
  { 
    label: 'Facebook', 
    url: 'https://www.facebook.com/profile.php?id=61570775870548&locale=th_TH', 
    descriptionKey: 'fb_main_desc',
    Icon: ({ className }: { className?: string }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    colorClass: 'bg-blue-600',
    hoverClass: 'hover:border-blue-500/30',
    textHoverClass: 'group-hover:text-blue-600',
    textColor: 'text-blue-600'
  },
  { 
    label: 'Instagram', 
    url: 'https://www.instagram.com/silverthiefbug.official/?utm_source=ig_web_button_share_sheet', 
    descriptionKey: 'Follow our official Instagram for photos',
    Icon: ({ className }: { className?: string }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
      </svg>
    ),
    colorClass: 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500',
    hoverClass: 'hover:border-pink-500/30',
    textHoverClass: 'group-hover:text-pink-600',
    textColor: 'text-pink-600'
  },
  { 
    label: 'TikTok', 
    url: 'https://www.tiktok.com/@silver.thief.bug', 
    descriptionKey: 'Watch our exotic beetles in action',
    Icon: ({ className }: { className?: string }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 2.23-1.15 4.39-2.9 5.85-1.78 1.48-4.22 2.1-6.49 1.64-2.26-.45-4.28-1.92-5.46-3.95-1.19-2.04-1.39-4.59-.51-6.79.88-2.2 2.7-3.95 4.95-4.7 2.27-.75 4.8-.57 6.88.6v4.22c-1.02-.62-2.27-.85-3.41-.6-1.13.25-2.12.98-2.68 1.98-.56 1-.68 2.22-.32 3.3.36 1.08 1.18 1.95 2.22 2.36 1.05.41 2.26.35 3.26-.16 1-.51 1.71-1.43 1.98-2.52.12-.47.16-.96.15-1.45V.02h-4.32z"/>
      </svg>
    ),
    colorClass: 'bg-black dark:bg-white',
    hoverClass: 'hover:border-gray-500/30',
    textHoverClass: 'group-hover:text-gray-600 dark:group-hover:text-gray-300',
    textColor: 'text-gray-900 dark:text-white'
  },
];

const FEATURES = [
  { icon: Shield, titleKey: 'health_guarantee', descriptionKey: 'health_guarantee_desc' },
  { icon: Truck, titleKey: 'express_shipping', descriptionKey: 'express_shipping_desc' },
  { icon: Star, titleKey: 'expert_bred', descriptionKey: 'expert_bred_desc' },
];

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

const Home: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-gray-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#FF922B22_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_#C0C0C022_0%,_transparent_60%)]" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl"
          >
            <span className="inline-block px-4 py-1.5 bg-orange/10 border border-orange/30 rounded-full text-orange text-sm font-semibold mb-6 tracking-wider uppercase">{t('hero_subtitle')}</span>
            <h1 className="text-6xl sm:text-7xl font-extrabold leading-tight mb-6">
              <span className="text-silver-metallic italic">Silver</span>
              <span className="text-orange">Thief</span>
              <span className="text-white"> Bug</span>
            </h1>
            <p className="text-xl text-gray-300 leading-relaxed max-w-2xl mb-10">
              {t('hero_desc_long')}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/products"
                className="flex items-center gap-2 px-8 py-4 bg-orange-gradient text-white font-bold rounded-full shadow-lg shadow-orange/30 hover:scale-105 transition-transform"
              >{t('explore_collection')}<ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="https://www.facebook.com/profile.php?id=61570775870548&locale=th_TH"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-8 py-4 border-2 border-white/20 text-white font-bold rounded-full hover:bg-white/10 transition-colors"
              >{t('follow_facebook')}<ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </motion.div>

          {/* Floating badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:flex flex-col items-center"
          >
            <div className="text-8xl mb-4 animate-bounce" style={{ animationDuration: '3s' }}>🪲</div>
            <div className="bg-orange/10 border border-orange/30 rounded-2xl px-6 py-4 text-center backdrop-blur-sm">
              <p className="text-4xl font-black text-orange">500+</p>
              <p className="text-gray-300 text-sm mt-1">{t('stock_label')}</p>
            </div>
          </motion.div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" className="w-full fill-white">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" />
          </svg>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map(({ icon: Icon, titleKey, descriptionKey }) => (
              <motion.div key={titleKey} {...fadeUp} className="flex gap-4 items-start p-6 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-orange/30 hover:shadow-md transition-all">
                <div className="p-3 bg-orange/10 rounded-xl flex-shrink-0">
                  <Icon className="w-6 h-6 text-orange" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">{t(titleKey)}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{t(descriptionKey)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Beetle Knowledge */}
      <section className="py-20 bg-silver-light dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="text-center mb-14">
            <span className="text-orange font-semibold uppercase tracking-wider text-sm">{t('beetle_encyclopedia')}</span>
            <h2 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 mt-2">{t('know_your_beetle')}</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-3 max-w-xl mx-auto">
              {t('understanding_beetle')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {BEETLE_FACTS.map((fact, idx) => (
              <motion.div
                key={idx}
                {...fadeUp}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700"
              >
                <div className="text-4xl mb-4">{fact.emoji}</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t(fact.titleKey)}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">{t(fact.bodyKey)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Links */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="text-center mb-14">
            <span className="text-orange font-semibold uppercase tracking-wider text-sm">{t('community')}</span>
            <h2 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 mt-2">{t('join_community')}</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-3">{t('community_desc')}</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SOCIAL_LINKS.map((link, idx) => (
              <motion.a
                key={idx}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                {...fadeUp}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                className={`group flex flex-col items-start p-6 rounded-2xl border-2 border-gray-100 dark:border-gray-700 ${link.hoverClass} hover:shadow-lg transition-all bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-800 dark:to-gray-900`}
              >
                <div className={`p-3 ${link.colorClass} text-white dark:text-black rounded-xl mb-4`}>
                  <link.Icon className="w-6 h-6 text-white dark:text-gray-900" />
                </div>
                <h3 className={`font-bold text-gray-900 dark:text-gray-100 mb-1 transition-colors ${link.textHoverClass}`}>
                  {link.label}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed flex-1">{t(link.descriptionKey)}</p>
                <div className={`flex items-center gap-1 mt-4 ${link.textColor} text-sm font-semibold`}>
                  {t('visit')} <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20 bg-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#FF922B15_0%,_transparent_70%)]" />
        <div className="relative z-10 max-w-4xl mx-auto text-center px-4">
          <motion.div {...fadeUp}>
            <div className="text-6xl mb-6">🪲</div>
            <h2 className="text-4xl font-extrabold text-white mb-4">{t('ready_to_start')}</h2>
            <p className="text-gray-400 dark:text-gray-500 text-lg mb-8 max-w-xl mx-auto">
              {t('ready_to_start_desc')}
            </p>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-10 py-4 bg-orange-gradient text-white font-bold rounded-full shadow-xl shadow-orange/30 hover:scale-105 transition-transform"
            >{t('shop_now')}<ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;
