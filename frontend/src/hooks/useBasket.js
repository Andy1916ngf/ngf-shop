import { useState, useEffect } from 'react';

const BASKET_KEY = 'ngf_basket';
const EXPIRY_MS  = 10 * 24 * 60 * 60 * 1000; // 10 days

function load() {
  try {
    const raw = localStorage.getItem(BASKET_KEY);
    if (!raw) return { items: {} };
    const parsed = JSON.parse(raw);
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(BASKET_KEY);
      return { items: {} };
    }
    return parsed;
  } catch {
    return { items: {} };
  }
}

function save(basket) {
  localStorage.setItem(BASKET_KEY, JSON.stringify({
    ...basket,
    expiresAt: Date.now() + EXPIRY_MS,
  }));
}

/**
 * Basket state.
 * items: { [productId]: { quantity: number, selectedVariations: object|null } }
 *
 * Prices are NOT stored here — they are always fetched from the server
 * at checkout time to prevent client-side price tampering.
 */
export function useBasket() {
  const [basket, setBasket] = useState(load);

  // Persist to localStorage on every change
  useEffect(() => {
    if (Object.keys(basket.items).length > 0) {
      save(basket);
    } else {
      localStorage.removeItem(BASKET_KEY);
    }
  }, [basket]);

  const itemCount = Object.values(basket.items).reduce((s, i) => s + i.quantity, 0);

  function addItem(productId, selectedVariations = null) {
    setBasket(prev => ({
      ...prev,
      items: {
        ...prev.items,
        [productId]: {
          quantity:           (prev.items[productId]?.quantity || 0) + 1,
          selectedVariations: selectedVariations ?? prev.items[productId]?.selectedVariations ?? null,
        },
      },
    }));
  }

  function removeItem(productId) {
    setBasket(prev => {
      const existing = prev.items[productId];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const { [productId]: _, ...rest } = prev.items;
        return { ...prev, items: rest };
      }
      return {
        ...prev,
        items: {
          ...prev.items,
          [productId]: { ...existing, quantity: existing.quantity - 1 },
        },
      };
    });
  }

  function clearBasket() {
    setBasket({ items: {} });
    localStorage.removeItem(BASKET_KEY);
  }

  return { basket, itemCount, addItem, removeItem, clearBasket };
}
