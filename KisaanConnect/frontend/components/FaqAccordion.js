'use client';
import { useState } from 'react';

const FAQS = [
  {
    q: 'How does delivery work?',
    a: 'The farmer accepts your order and arranges delivery. You can follow it on your orders page as it moves from pending to accepted to delivered.',
  },
  {
    q: 'Is there a minimum order amount?',
    a: 'No minimum on most listings. Some farmers set a minimum quantity for bulk crops like sugarcane or grain — this will be shown clearly on the product page if it applies.',
  },
  {
    q: 'How is the price decided?',
    a: 'Farmers set their own price. Before they do, they can check our price forecast, built from real AGMARKNET mandi prices, to see what the crop is selling for nearby.',
  },
  {
    q: 'How do payments work?',
    a: 'Buyers pay online through Razorpay, and each payment is verified on our server before the order is confirmed. Automatic payouts to farmers are planned but not built yet in this demo.',
  },
  {
    q: 'What if the produce isn\u2019t fresh on arrival?',
    a: 'Rate and review it from your order. Only verified buyers can review, so other buyers see which farmers deliver good produce. Refunds aren\u2019t built into this demo yet.',
  },
  {
    q: 'Can I sell on KisaanConnect if I\u2019m a small farmer?',
    a: 'Yes \u2014 there\u2019s no farm-size requirement. Sign up, list your crop with quantity and photos, and you\u2019re ready to sell directly to buyers.',
  },
];

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState(0);

  const toggle = (i) => setOpenIndex(openIndex === i ? -1 : i);

  return (
    <div className="bg-[var(--kc-mint)] py-16">
      <div className="max-w-3xl mx-auto px-6">
        <span className="text-[11px] tracking-[0.2em] uppercase text-[var(--kc-forest)] font-mono">
          Common questions
        </span>
        <h2 className="font-serif text-3xl text-[var(--kc-ink)] mt-2 mb-10">Frequently asked</h2>

        <div className="divide-y divide-[var(--kc-ink)]/10 border-t border-b border-[var(--kc-ink)]/10">
          {FAQS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={item.q}>
                <button
                  onClick={() => toggle(i)}
                  className="w-full flex items-center justify-between py-4 text-left"
                >
                  <span className="text-sm md:text-base font-medium text-[var(--kc-ink)] pr-4">
                    {item.q}
                  </span>
                  <span
                    className={`shrink-0 text-[var(--kc-forest)] font-mono text-lg transition-transform ${isOpen ? 'rotate-45' : ''}`}
                  >
                    +
                  </span>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-40 pb-4' : 'max-h-0'}`}
                >
                  <p className="text-sm text-[var(--kc-ink)]/70 leading-relaxed pr-8">
                    {item.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}