const TRUST_POINTS = [
  {
    title: 'Verified farmers',
    body: 'Every seller is checked before they can list produce.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Secure payments',
    body: 'Every order is processed through encrypted, trusted checkout.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
        <rect x="3" y="10" width="18" height="10" rx="1.5" />
        <path d="M7 10V7a5 5 0 0110 0v3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Fair, direct pricing',
    body: 'Prices checked against real mandi trends — no hidden markups.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Quality checked',
    body: 'Produce is reviewed for freshness before it reaches you.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
        <path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1 3-6z" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function TrustStrip() {
  return (
    <div className="bg-[#EEF2E7] py-10 border-y border-[var(--kc-ink)]/10">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {TRUST_POINTS.map((t) => (
            <div key={t.title} className="flex items-start gap-3">
              <div className="text-[var(--kc-forest)] shrink-0 mt-0.5">{t.icon}</div>
              <div>
                <div className="text-sm font-medium text-[var(--kc-ink)]">{t.title}</div>
                <div className="text-xs text-[var(--kc-ink)]/60 mt-0.5 leading-relaxed">{t.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}