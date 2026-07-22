'use client';
import { useRouter } from 'next/navigation';

export default function Hero() {
  const router = useRouter();

  return (
    <div
      style={{
        backgroundImage: 'url(/images/hero.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minHeight: 420,
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      <div style={{ position: 'relative', zIndex: 1, padding: '0 40px', color: '#fff' }}>
        <h1 style={{ fontSize: 40, marginBottom: 12 }}>
          Bharat Ke Kheton Se,<br />Seedha Aapke Ghar Tak!
        </h1>
        <p style={{ fontSize: 18, marginBottom: 24 }}>
          Fresh produce directly from farmers - no middlemen, fair prices.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => router.push('/consumer')}
            style={{ padding: '10px 24px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 15 }}
          >
            Shop Now
          </button>
          <button
            onClick={() => router.push('/register')}
            style={{ padding: '10px 24px', background: '#fff', color: '#2e7d32', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 15 }}
          >
            Join as Farmer
          </button>
        </div>
      </div>
    </div>
  );
}