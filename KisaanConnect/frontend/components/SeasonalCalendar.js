const SEASON_CROPS = {
  Kharif: {
    months: 'June – October',
    crops: ['Rice', 'Cotton', 'Sugarcane', 'Soybean', 'Maize', 'Tur (Arhar)'],
  },
  Rabi: {
    months: 'November – March',
    crops: ['Wheat', 'Mustard', 'Gram (Chana)', 'Peas', 'Barley', 'Onion'],
  },
  Zaid: {
    months: 'April – June',
    crops: ['Watermelon', 'Cucumber', 'Muskmelon', 'Fodder crops', 'Vegetables'],
  },
};

const getCurrentSeason = () => {
  const month = new Date().getMonth() + 1;
  if (month >= 6 && month <= 10) return 'Kharif';
  if (month >= 11 || month <= 3) return 'Rabi';
  return 'Zaid';
};

export default function SeasonalCalendar() {
  const current = getCurrentSeason();

  return (
    <div className="bg-[#EEF2E7] py-16">
      <div className="max-w-6xl mx-auto px-6">
        <span className="text-[11px] tracking-[0.2em] uppercase text-[var(--kc-forest)] font-mono">
          What&apos;s in season
        </span>
        <h2 className="font-serif text-3xl text-[var(--kc-ink)] mt-2 mb-10">The crop calendar</h2>

        <div className="grid md:grid-cols-3 gap-5">
          {Object.entries(SEASON_CROPS).map(([season, data]) => {
            const isCurrent = season === current;
            return (
              <div
                key={season}
                className={`rounded-sm p-6 border ${
                  isCurrent
                    ? 'bg-[var(--kc-ink)] border-[var(--kc-sprout)] text-[var(--kc-mint)]'
                    : 'bg-[var(--kc-mint)] border-[var(--kc-ink)]/10 text-[var(--kc-ink)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-serif text-xl">{season}</h3>
                  {isCurrent && (
                    <span className="text-[10px] uppercase tracking-wide bg-[var(--kc-sprout)] text-[var(--kc-ink)] px-2 py-0.5 rounded-sm font-mono">
                      Now
                    </span>
                  )}
                </div>
                <div className={`text-xs font-mono mb-4 ${isCurrent ? 'text-[var(--kc-mint)]/60' : 'text-[var(--kc-ink)]/50'}`}>
                  {data.months}
                </div>
                <ul className="space-y-1.5">
                  {data.crops.map((c) => (
                    <li key={c} className={`text-sm ${isCurrent ? 'text-[var(--kc-mint)]/85' : 'text-[var(--kc-ink)]/75'}`}>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}