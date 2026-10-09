import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Phone, Mail, ExternalLink } from 'lucide-react';

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const TiktokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 2.23-1.15 4.39-2.9 5.85-1.78 1.48-4.22 2.1-6.49 1.64-2.26-.45-4.28-1.92-5.46-3.95-1.19-2.04-1.39-4.59-.51-6.79.88-2.2 2.7-3.95 4.95-4.7 2.27-.75 4.8-.57 6.88.6v4.22c-1.02-.62-2.27-.85-3.41-.6-1.13.25-2.12.98-2.68 1.98-.56 1-.68 2.22-.32 3.3.36 1.08 1.18 1.95 2.22 2.36 1.05.41 2.26.35 3.26-.16 1-.51 1.71-1.43 1.98-2.52.12-.47.16-.96.15-1.45V.02h-4.32z"/>
  </svg>
);

const About: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
            <span className="text-silver-dark italic">Silver</span>
            <span className="text-orange">Thief</span>
            <span className="text-gray-900 dark:text-gray-100">Bug</span>
          </h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            {t('about_subtitle', 'We provide the best exotic beetles and pet insects for enthusiasts everywhere.')}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden mb-12 border border-gray-100 dark:border-gray-700">
          <div className="p-8 sm:p-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 border-l-4 border-orange pl-4 uppercase tracking-wider">
              {t('connect_with_us', 'Connect With Us')}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <a 
                href="https://www.facebook.com/profile.php?id=61570775870548&locale=th_TH" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex flex-col items-center p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors group"
              >
                <div className="p-4 bg-blue-600 text-white rounded-full mb-4 group-hover:scale-110 transition-transform">
                  <FacebookIcon className="w-8 h-8" />
                </div>
                <span className="font-bold text-gray-900 dark:text-white">Facebook</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  {t('follow_us', 'Follow us')} <ExternalLink className="w-3 h-3" />
                </span>
              </a>

              <a 
                href="https://www.instagram.com/silverthiefbug.official/?utm_source=ig_web_button_share_sheet" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex flex-col items-center p-6 bg-pink-50 dark:bg-pink-900/20 rounded-xl hover:bg-pink-100 dark:hover:bg-pink-900/40 transition-colors group"
              >
                <div className="p-4 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 text-white rounded-full mb-4 group-hover:scale-110 transition-transform">
                  <InstagramIcon className="w-8 h-8" />
                </div>
                <span className="font-bold text-gray-900 dark:text-white">Instagram</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  {t('see_photos', 'See photos')} <ExternalLink className="w-3 h-3" />
                </span>
              </a>

              <a 
                href="https://www.tiktok.com/@silver.thief.bug" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex flex-col items-center p-6 bg-gray-100 dark:bg-gray-800/50 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors group border border-gray-200 dark:border-gray-700"
              >
                <div className="p-4 bg-black dark:bg-white dark:text-black text-white rounded-full mb-4 group-hover:scale-110 transition-transform">
                  <TiktokIcon className="w-8 h-8" />
                </div>
                <span className="font-bold text-gray-900 dark:text-white">TikTok</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  {t('watch_videos', 'Watch videos')} <ExternalLink className="w-3 h-3" />
                </span>
              </a>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 border-l-4 border-orange pl-4 uppercase tracking-wider mt-12">
              {t('our_location', 'Our Location')}
            </h2>
            
            <div className="bg-orange/5 dark:bg-orange/10 p-6 rounded-xl border border-orange/20 flex flex-col md:flex-row gap-6 items-center md:items-start mb-8">
              <div className="p-4 bg-white dark:bg-gray-800 rounded-full shadow-md text-orange">
                <MapPin className="w-8 h-8" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('hq_name', 'Silver Thief Bug HQ')}</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                  {t('address_full', '1 ตำบล ลำนารายณ์ อำเภอชัยบาดาล ลพบุรี 15130')}
                </p>
                <a 
                  href="https://www.google.com/maps/place/1+%E0%B8%95%E0%B8%B3%E0%B8%9A%E0%B8%A5+%E0%B8%A5%E0%B8%B3%E0%B8%99%E0%B8%B2%E0%B8%A3%E0%B8%B2%E0%B8%A2%E0%B8%93%E0%B9%8C+%E0%B8%AD%E0%B8%B3%E0%B9%80%E0%B8%A0%E0%B8%AD%E0%B8%8A%E0%B8%B1%E0%B8%A2%E0%B8%9A%E0%B8%B2%E0%B8%94%E0%B8%B2%E0%B8%A5+%E0%B8%A5%E0%B8%9E%E0%B8%9A%E0%B8%B8%E0%B8%A3%E0%B8%B5+15130/@15.2084415,101.1476859,475m/data=!3m1!1e3!4m6!3m5!1s0x311e4345489d9b99:0x5ca6db51f6e6a2f3!8m2!3d15.2094508!4d101.1492295!16s%2Fg%2F11thqhfmxz?entry=ttu&g_ep=EgoyMDI2MDUxMS4wIKXMDSoASAFQAw%3D%3D" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-orange text-white font-bold rounded-full hover:bg-orange-dark transition-all shadow-md hover:shadow-lg transform hover:-translate-y-1 mb-6"
                >
                  <MapPin className="w-5 h-5" />
                  {t('open_in_google_maps', 'Open in Google Maps')}
                </a>
                
                {/* Embedded Google Map */}
                <iframe 
                  className="w-full h-64 md:h-80 rounded-xl shadow-sm border border-orange/10 dark:border-gray-700" 
                  src="https://maps.google.com/maps?q=15.2094508,101.1492295&hl=th&z=15&output=embed" 
                  title="Silver Thief Bug Farm Map"
                  frameBorder="0" 
                  scrolling="no" 
                  marginHeight={0} 
                  marginWidth={0}>
                </iframe>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-4 text-gray-600 dark:text-gray-300">
                <Phone className="w-6 h-6 text-orange" />
                <span className="font-medium">095 681 2084</span>
              </div>
              <div className="flex items-center gap-4 text-gray-600 dark:text-gray-300">
                <Mail className="w-6 h-6 text-orange" />
                <span className="font-medium">silverthiefbug.official@gmail.com</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
