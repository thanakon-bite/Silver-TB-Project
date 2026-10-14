import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

// t() returns string (never null) — matches the returnNull option below
declare module 'i18next' {
  interface CustomTypeOptions {
    returnNull: false;
  }
}

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'th',
    supportedLngs: ['th', 'en'],
    load: 'languageOnly', // en-US reads the en strings; there are no regional files
    returnNull: false,
    debug: false,
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    }
  });

// Screen readers and the browser's hyphenation and fonts follow the language on screen.
const syncHtmlLang = (lng: string) => document.documentElement.setAttribute('lang', lng.startsWith('en') ? 'en' : 'th');
i18n.on('languageChanged', syncHtmlLang);
if (i18n.language) syncHtmlLang(i18n.language);

export default i18n;
