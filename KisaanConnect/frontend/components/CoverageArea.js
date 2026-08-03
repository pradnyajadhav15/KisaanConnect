const COVERAGE = {
  'Maharashtra': {
    status: 'active',
    districts: ['Solapur', 'Pune', 'Nashik', 'Kolhapur', 'Sangli', 'Ahmednagar', 'Satara'],
  },
  'Karnataka': {
    status: 'active',
    districts: ['Belagavi', 'Vijayapura', 'Kalaburagi'],
  },
  'Telangana': {
    status: 'expanding',
    districts: ['Hyderabad', 'Nizamabad'],
  },
};

export default function CoverageArea() {
  return (
    <div className="bg-[var(--kc-mint)] py-16 border-t border-[var(--kc-ink)]/10">
      <div className="max-w-6xl mx-auto px-6">
        <span className="text-[11px] tracking-[0.2em] uppercase text-[var(--kc-forest)] font-mono">
          Where we deliver
        </span>
        <h2 className="font-serif text-3xl text-[var(--kc-ink)] mt-2 mb-10">Coverage area</h2>

        <div className="grid md:grid-cols-3 gap-8">
          {Object.entries(COVERAGE).map(([state, data]) => (
            <div key={state}>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    data.status === 'active' ? 'bg-[var(--kc-forest)]' : 'bg-[var(--kc-sprout)]'
                  }`}
                />
                <h3 className="font-serif text-lg text-[var(--kc-ink)]">{state}</h3>
                {data.status === 'expanding' && (
                  <span className="text-[10px] uppercase tracking-wide text-[var(--kc-forest)] font-mono">
                    expanding
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {data.districts.map((d) => (
                  <span
                    key={d}
                    className="text-xs px-2.5 py-1 rounded-full bg-[#EEF2E7] text-[var(--kc-ink)]/75"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-[var(--kc-ink)]/50 mt-10">
          Don&apos;t see your district? We&apos;re adding new areas every month — sign up and we&apos;ll notify you when we reach you.
        </p>
      </div>
    </div>
  );
}