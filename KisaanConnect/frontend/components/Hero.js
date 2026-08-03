'use client';
import { useRouter } from 'next/navigation';

export default function Hero() {
  const router = useRouter();

  return (
    <section className="relative overflow-hidden bg-[var(--kc-ink)]">
      <div
        className="absolute inset-0 opacity-70 bg-cover bg-center"
        style={{ backgroundImage: 'url(/images/hero.jpg)' }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(100deg, rgba(0,35,43,0.96) 0%, rgba(0,35,43,0.88) 35%, rgba(0,48,58,0.45) 70%, rgba(0,48,58,0.2) 100%)',
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 md:py-28">
        <span className="inline-block text-[11px] tracking-[0.18em] uppercase text-[var(--kc-sprout)] mb-5">
          Farm to Family
        </span>

        <h1 className="max-w-3xl mb-5" style={{ color: 'var(--kc-mint)', textShadow: '0 2px 20px rgba(0,35,43,0.85)' }}>
          Bharat Ke Kheton Se,
          <br />
          <span className="text-[var(--kc-sprout)]">Seedha Aapke Ghar Tak!</span>
        </h1>

        <p className="text-base md:text-lg text-[var(--kc-line)] max-w-xl mb-9 leading-relaxed">
          Fresh produce directly from farmers. No middlemen, fair prices, and
          every rupee traceable back to the person who grew it.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => router.push('/consumer')}
            className="px-7 py-3 rounded-lg bg-[var(--kc-sprout)] text-[var(--kc-ink)] font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Shop Now
          </button>
          <button
            onClick={() => router.push('/register')}
            className="px-7 py-3 rounded-lg border border-[var(--kc-line)]/40 text-[var(--kc-line)] text-sm hover:border-[var(--kc-sprout)] hover:text-[var(--kc-sprout)] transition-colors"
          >
            Join as Farmer
          </button>
        </div>
      </div>
    </section>
  );
}