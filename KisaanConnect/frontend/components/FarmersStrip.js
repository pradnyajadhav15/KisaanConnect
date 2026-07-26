const FARMERS = [
  { name: 'Ramesh Patil', region: 'Solapur, MH', crop: 'Sugarcane', years: 12, initials: 'RP', color: '#2E7D32' },
  { name: 'Sunita Deshmukh', region: 'Nashik, MH', crop: 'Onion', years: 8, initials: 'SD', color: '#C1622D' },
  { name: 'Vitthal Jadhav', region: 'Akkalkot, MH', crop: 'Grapes', years: 15, initials: 'VJ', color: '#E8A33D' },
  { name: 'Kavita Shinde', region: 'Kolhapur, MH', crop: 'Vegetables', years: 6, initials: 'KS', color: '#2E7D32' },
  { name: 'Baban Kale', region: 'Sangli, MH', crop: 'Turmeric', years: 20, initials: 'BK', color: '#C1622D' },
];

export default function FarmersStrip() {
  return (
    <div className="bg-[#FAF6ED] py-16 border-t border-[#241F1A]/10">
      <div className="max-w-6xl mx-auto px-6">
        <span className="text-[11px] tracking-[0.2em] uppercase text-[#C1622D] font-mono">
          The people behind the produce
        </span>
        <h2 className="font-serif text-3xl text-[#241F1A] mt-2 mb-10">Meet the farmers</h2>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
          {FARMERS.map((f) => (
            <div key={f.name} className="text-center">
              <div
                className="w-16 h-16 md:w-20 md:h-20 rounded-full mx-auto flex items-center justify-center text-white font-serif text-xl md:text-2xl mb-3"
                style={{ backgroundColor: f.color }}
              >
                {f.initials}
              </div>
              <div className="text-sm font-medium text-[#241F1A]">{f.name}</div>
              <div className="text-xs text-[#241F1A]/60 mt-0.5">{f.region}</div>
              <div className="text-xs text-[#2E7D32] font-mono mt-1">
                {f.crop} · {f.years}yr
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}