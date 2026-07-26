export default function StatsBar() {
  const stats = [
    { label: 'Farmers onboard', value: '2,400+' },
    { label: 'Districts covered', value: '38' },
    { label: 'Orders delivered', value: '18,600+' },
    { label: 'Avg. price gain for farmers', value: '22%' },
  ];

  return (
    <div className="bg-[#241F1A] text-[#FAF6ED]">
      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((s) => (
          <div key={s.label} className="text-center md:text-left">
            <div className="text-2xl md:text-3xl font-serif font-semibold text-[#E8A33D]">
              {s.value}
            </div>
            <div className="text-xs md:text-sm text-[#FAF6ED]/70 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}