import Link from 'next/link';

const COLUMNS = [
  {
    title: 'Buy',
    links: [
      { href: '/consumer', label: 'Browse produce' },
      { href: '/consumer', label: 'My orders' },
      { href: '/adopt-farm', label: 'Adopt a farm' },
    ],
  },
  {
    title: 'Sell',
    links: [
      { href: '/register', label: 'Become a farmer' },
      { href: '/farmer', label: 'Farmer dashboard' },
      { href: '/farmer', label: 'Price predictor' },
    ],
  },
  {
    title: 'About',
    links: [
      { href: '/ngo', label: 'NGO support' },
      { href: '/about', label: 'Our story' },
      { href: '/contact', label: 'Contact us' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-[var(--kc-ink-deep)] text-[var(--kc-line)]">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <img
              src="/images/logo-icon.png"
              alt=""
              className="h-10 w-auto mb-3"
            />
            <p className="text-[var(--kc-mint)] text-lg mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              KisaanConnect
            </p>
            <p className="text-sm leading-relaxed text-[var(--kc-line)]/60 max-w-xs">
              Fresh produce direct from farmers across Maharashtra. No middlemen,
              fair prices, every rupee traceable.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-[11px] tracking-[0.16em] uppercase text-[var(--kc-sprout)] mb-4">
                {col.title}
              </p>
              {col.links.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="block text-sm mb-2.5 text-[var(--kc-line)]/75 hover:text-[var(--kc-sprout)] transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--kc-line)]/12 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="text-xs text-[var(--kc-line)]/50">
            2026 KisaanConnect. Built for farmers, in Solapur.
          </p>
          <p className="text-xs text-[var(--kc-line)]/50">
            Prices shown are estimates from AGMARKNET mandi data. Verify locally before selling.
          </p>
        </div>
      </div>
    </footer>
  );
}