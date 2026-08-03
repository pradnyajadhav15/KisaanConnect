export default function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Farmer lists the harvest',
      body: 'Add crop, quantity, and photos in minutes. No paperwork, no agent fees.',
    },
    {
      n: '02',
      title: 'KisaanConnect sets a fair price',
      body: 'Our price model checks real mandi trends so nobody undersells their crop.',
    },
    {
      n: '03',
      title: 'Consumer orders direct',
      body: 'Buyers order straight from the farmer. Payment and delivery, tracked end to end.',
    },
  ];

  return (
    <div className="bg-[var(--kc-mint)] py-16">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="font-serif text-3xl text-[var(--kc-ink)] mb-10">How KisaanConnect works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.n} className="border-l-4 border-[var(--kc-forest)] pl-5">
              <div className="font-mono text-[var(--kc-forest)] text-sm mb-2">{s.n}</div>
              <h3 className="font-serif text-xl text-[var(--kc-ink)] mb-2">{s.title}</h3>
              <p className="text-[var(--kc-ink)]/70 text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}