import { useState } from 'react';
import sv from '../i18n/sv.json';
import en from '../i18n/en.json';

const LANG_KEY = 'ngf_lang';
const strings  = { sv, en };

/**
 * Returns: { lang, t, toggleLang }
 * lang:       'sv' | 'en'
 * t:          translation object for the active language
 * toggleLang: switches between SV and EN
 */
export function useLang() {
  const [lang, setLang] = useState(
    () => localStorage.getItem(LANG_KEY) || 'sv'
  );

  function toggleLang() {
    const next = lang === 'sv' ? 'en' : 'sv';
    setLang(next);
    localStorage.setItem(LANG_KEY, next);
    document.documentElement.lang = next === 'en' ? 'en-GB' : 'sv-SE';
  }

  return { lang, t: strings[lang], toggleLang };
}
