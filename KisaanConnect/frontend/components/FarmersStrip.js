const FARMERS = [
  { name: 'Ramesh Patil', region: 'Solapur, MH', crop: 'Sugarcane', years: 12, initials: 'RP', color: '#167208' },
  { name: 'Sunita Deshmukh', region: 'Nashik, MH', crop: 'Onion', years: 8, initials: 'SD', color: '#00303A' },
  { name: 'Vitthal Jadhav', region: 'Akkalkot, MH', crop: 'Grapes', years: 15, initials: 'VJ', color: '#0F5205' },
  { name: 'Kavita Shinde', region: 'Kolhapur, MH', crop: 'Vegetables', years: 6, initials: 'KS', color: '#164A55' },
  { name: 'Baban Kale', region: 'Sangli, MH', crop: 'Turmeric', years: 20, initials: 'BK', color: '#167208' },
];

export default function FarmersStrip() {
  return (
    <div className="bg-[var(--kc-mint)] py-16 border-t border-[var(--kc-line)]">
      <div className="max-w-6xl mx-auto px-6">
        <span className="text-[11px] tracking-[0.2em] uppercase text-[var(--kc-forest)]">
          The people behind the produce
        </span>
        <h2 className="text-[var(--kc-ink)] mt-2 mb-10">Meet the farmers</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
          {FARMERS.map((f) => (
            <div
              key={f.name}
              className="text-center group cursor-pointer rounded-xl px-3 py-5 transition-all duration-300 hover:bg-[var(--kc-card)] hover:shadow-[0_8px_24px_rgba(0,48,58,0.08)] hover:-translate-y-1"
            >
              <div
                className="w-16 h-16 md:w-20 md:h-20 rounded-full mx-auto flex items-center justify-center text-[var(--kc-mint)] text-xl md:text-2xl mb-3 transition-transform duration-300 group-hover:scale-105"
                style={{ backgroundColor: f.color, fontFamily: 'var(--font-display)' }}
              >
                {f.initials}
              </div>
              <div className="text-sm font-medium text-[var(--kc-ink)]">{f.name}</div>
              <div className="text-xs text-[var(--kc-ink-muted)] mt-0.5">{f.region}</div>
              <div className="text-xs text-[var(--kc-forest)] mt-1">
                {f.crop} · {f.years}yr
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}