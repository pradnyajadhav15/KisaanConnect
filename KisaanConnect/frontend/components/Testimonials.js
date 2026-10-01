// Who KisaanConnect is built for. These describe the features, not real users or quotes.
export default function Testimonials() {
  const uses = [
    {
      who: 'Farmers selling direct',
      what: 'List produce with photos, set your own price, and sell to buyers without a chain of middlemen taking a cut.',
    },
    {
      who: 'Families buying fresh',
      what: 'Buy vegetables and fruit straight from the farm, see whose farm they came from, and review what you bought.',
    },
    {
      who: 'Farmers deciding when to sell',
      what: 'Check next week’s forecast next to last week’s mandi rate, built from real AGMARKNET prices, before going to market.',
    },
  ];

  return (
    <div className="bg-[#EEF2E7] py-16">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="font-serif text-3xl text-[var(--kc-ink)] mb-10">Built for the field and the kitchen</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {uses.map((u) => (
            <div
              key={u.who}
              className="bg-[var(--kc-mint)] p-6 rounded-sm shadow-sm border-t-4 border-[var(--kc-sprout)]"
            >
              <div className="text-sm font-semibold text-[var(--kc-ink)] mb-2">{u.who}</div>
              <p className="text-[var(--kc-ink)]/80 text-sm leading-relaxed">{u.what}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
