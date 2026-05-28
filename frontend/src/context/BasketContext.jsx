import { createContext, useContext } from 'react';
import { useBasket } from '../hooks/useBasket';

const BasketCtx = createContext(null);

/**
 * Wrap the app in BasketProvider (in main.jsx) so Header, Catalog,
 * Product, and Basket all share the same basket state instance.
 * Without this, each component calling useBasket() gets its own
 * isolated state — the header badge would never update.
 */
export function BasketProvider({ children }) {
  const basket = useBasket();
  return <BasketCtx.Provider value={basket}>{children}</BasketCtx.Provider>;
}

export function useBasketCtx() {
  const ctx = useContext(BasketCtx);
  if (!ctx) throw new Error('useBasketCtx must be used inside <BasketProvider>');
  return ctx;
}
