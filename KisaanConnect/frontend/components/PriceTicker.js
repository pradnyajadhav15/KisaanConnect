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
      .catch(() => {
        // silently keep FALLBACK_RATES
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loop = [...rates, ...rates];

  return (
    <div className="bg-[#1a1611] border-y-4 border-[#E8A33D] overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 pt-3 pb-1 flex items-center gap-2">
        <span className="text-[10px] tracking-[0.2em] uppercase text-[#E8A33D]/80 font-mono">
          {isLive ? "Today's Predicted Mandi Rates" : 'Sample Mandi Rates'}
        </span>
        {isLive && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#7FCF88] animate-pulse" />
        )}
      </div>
      <div className="relative py-3">
        <div className="flex gap-10 animate-[ticker_28s_linear_infinite] whitespace-nowrap w-max">
          {loop.map((r, i) => (
            <div key={i} className="flex items-baseline gap-2 font-mono text-sm">
              <span className="text-[#FAF6ED]/90">{r.crop}</span>
              <span className="text-[#7FCF88]">
                ₹{r.price}
                <span className="text-[#FAF6ED]/50">/{r.unit}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}