'use client';
import { useState } from 'react';

const FAQS = [
  {
    q: 'How fast is delivery?',
    a: 'Most orders reach you within 24-48 hours of the farmer confirming your order, since produce ships straight from the farm without sitting in a warehouse.',
  },
  {
    q: 'Is there a minimum order amount?',
    a: 'No minimum on most listings. Some farmers set a minimum quantity for bulk crops like sugarcane or grain — this will be shown clearly on the product page if it applies.',
  },
  {
    q: 'How is the price decided?',
    a: 'Farmers set their own price, checked against real mandi (market) trends through our price prediction tool, so pricing stays fair for both sides — no middleman markup.',
  },
  {
    q: 'How do farmers get paid?',
    a: 'Payment is released to the farmer once your order is confirmed and processed securely through our payment partner — funds go straight to them, not through a third party.',
  },
  {
    q: 'What if the produce isn\u2019t fresh on arrival?',
    a: 'Every listing is reviewed for quality before going live. If something arrives below the promised quality, contact support from your order page and we\u2019ll help sort a refund or replacement.',
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
    <div className="bg-[#FAF6ED] py-16">
      <div className="max-w-3xl mx-auto px-6">
        <span className="text-[11px] tracking-[0.2em] uppercase text-[#C1622D] font-mono">
          Common questions
        </span>
        <h2 className="font-serif text-3xl text-[#241F1A] mt-2 mb-10">Frequently asked</h2>

        <div className="divide-y divide-[#241F1A]/10 border-t border-b border-[#241F1A]/10">
          {FAQS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={item.q}>
                <button
                  onClick={() => toggle(i)}
                  className="w-full flex items-center justify-between py-4 text-left"
                >
                  <span className="text-sm md:text-base font-medium text-[#241F1A] pr-4">
                    {item.q}
                  </span>
                  <span
                    className={`shrink-0 text-[#2E7D32] font-mono text-lg transition-transform ${isOpen ? 'rotate-45' : ''}`}
                  >
                    +
                  </span>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-40 pb-4' : 'max-h-0'}`}
                >
                  <p className="text-sm text-[#241F1A]/70 leading-relaxed pr-8">
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