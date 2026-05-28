import { createContext, useContext } from 'react';
import { useLang } from '../hooks/useLang';

const LangCtx = createContext(null);

/**
 * Wrap the app in LangProvider so Header, Footer, and all pages
 * share the same language state. Toggling language in the Header
 * updates the string in every component instantly.
 */
export function LangProvider({ children }) {
  const lang = useLang();
  return <LangCtx.Provider value={lang}>{children}</LangCtx.Provider>;
}

export function useLangCtx() {
  const ctx = useContext(LangCtx);
  if (!ctx) throw new Error('useLangCtx must be used inside <LangProvider>');
  return ctx;
}
