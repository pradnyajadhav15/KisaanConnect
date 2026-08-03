'use client';
import { useState } from 'react';
import { subscribe } from '../lib/newsletterApi';

export default function NewsletterSignup() {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | already | error
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!value.trim()) return;

    setStatus('loading');
    setError('');

    const isEmail = value.includes('@');
    const payload = isEmail
      ? { email: value.trim() }
      : { whatsapp_number: value.trim() };

    try {
      const res = await subscribe(payload);
      setStatus(res.status === 'already_subscribed' ? 'already' : 'success');
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Something went wrong.');
    }
  };

  return (
    <div className="bg-[var(--kc-ink)] py-16">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <span className="text-[11px] tracking-[0.2em] uppercase text-[var(--kc-sprout)] font-mono">
          Stay in the loop
        </span>
        <h2 className="font-serif text-3xl text-[var(--kc-mint)] mt-2 mb-3">
          Get price alerts & new harvest updates
        </h2>
        <p className="text-[var(--kc-mint)]/70 text-sm mb-8 max-w-md mx-auto">
          Drop your email or WhatsApp number — we&apos;ll let you know when prices move or fresh crops land near you.
        </p>

        {status === 'success' || status === 'already' ? (
          <div className="bg-[var(--kc-forest)]/20 border border-[var(--kc-forest)] text-[var(--kc-sprout)] text-sm py-3 px-4 rounded-sm max-w-md mx-auto">
            {status === 'already'
              ? "You're already on the list \u2014 we've got you covered."
              : "You're in! We'll be in touch."}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Email or WhatsApp number"
              className="flex-1 px-4 py-2.5 rounded-sm bg-[var(--kc-mint)] text-[var(--kc-ink)] text-sm placeholder:text-[var(--kc-ink)]/40 outline-none"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="bg-[var(--kc-forest)] text-white text-sm font-medium px-6 py-2.5 rounded-sm hover:bg-[#256428] transition disabled:opacity-60 whitespace-nowrap"
            >
              {status === 'loading' ? 'Joining…' : 'Notify me'}
            </button>
          </form>
        )}

        {status === 'error' && (
          <p className="text-xs text-[var(--kc-sprout)] mt-3">{error}</p>
        )}
      </div>
    </div>
  );
}