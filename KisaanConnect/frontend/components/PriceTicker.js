'use client';
import { useEffect, useState } from 'react';
import { getMarketRatesSnapshot } from '../lib/pricePredictionService';

const FALLBACK_RATES = [
  { crop: 'Wheat', price: 24, unit: 'kg' },
  { crop: 'Onion', price: 32, unit: 'kg' },
  { crop: 'Tomato', price: 28, unit: 'kg' },
  { crop: 'Rice', price: 41, unit: 'kg' },
  { crop: 'Potato', price: 18, unit: 'kg' },
];

export default function PriceTicker() {
  const [rates, setRates] = useState(FALLBACK_RATES);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMarketRatesSnapshot()
      .then((data) => {
        if (!cancelled && data.length > 0) {
          setRates(data);
          setIsLive(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const loop = [...rates, ...rates];

  return (
    <div className="bg-[var(--kc-ink)] border-b border-[var(--kc-sprout)]/25 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 pt-3.5 pb-1 flex items-center gap-2">
        <span className="text-[10px] tracking-[0.2em] uppercase text-[var(--kc-sprout)]/80">
          {isLive ? "Today's Predicted Mandi Rates" : 'Sample Mandi Rates'}
        </span>
        {isLive && (
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--kc-sprout)] animate-pulse" />
        )}
      </div>
      <div className="relative py-3">
        <div className="flex gap-10 animate-[ticker_28s_linear_infinite] whitespace-nowrap w-max">
          {loop.map((r, i) => (
            <div key={i} className="flex items-baseline gap-2 text-sm">
              <span className="text-[var(--kc-line)]/90">{r.crop}</span>
              <span className="text-[var(--kc-sprout)]">
                ₹{r.price}
                <span className="text-[var(--kc-line)]/50">/{r.unit}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}