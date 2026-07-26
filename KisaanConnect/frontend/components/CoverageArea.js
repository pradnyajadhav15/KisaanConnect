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
    <div className="bg-[#FAF6ED] py-16 border-t border-[#241F1A]/10">
      <div className="max-w-6xl mx-auto px-6">
        <span className="text-[11px] tracking-[0.2em] uppercase text-[#C1622D] font-mono">
          Where we deliver
        </span>
        <h2 className="font-serif text-3xl text-[#241F1A] mt-2 mb-10">Coverage area</h2>

        <div className="grid md:grid-cols-3 gap-8">
          {Object.entries(COVERAGE).map(([state, data]) => (
            <div key={state}>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    data.status === 'active' ? 'bg-[#2E7D32]' : 'bg-[#E8A33D]'
                  }`}
                />
                <h3 className="font-serif text-lg text-[#241F1A]">{state}</h3>
                {data.status === 'expanding' && (
                  <span className="text-[10px] uppercase tracking-wide text-[#C1622D] font-mono">
                    expanding
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {data.districts.map((d) => (
                  <span
                    key={d}
                    className="text-xs px-2.5 py-1 rounded-full bg-[#EEF2E7] text-[#241F1A]/75"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-[#241F1A]/50 mt-10">
          Don&apos;t see your district? We&apos;re adding new areas every month — sign up and we&apos;ll notify you when we reach you.
        </p>
      </div>
    </div>
  );
}