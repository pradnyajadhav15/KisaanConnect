'use client';

import { useEffect, useState } from 'react';
import { listNgos, createDonation, verifyDonation } from '../../lib/communityService';

const PRESETS = [100, 250, 500, 1000, 2500];

export default function NgoPage() {
  const [ngos, setNgos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState(500);
  const [anon, setAnon] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    listNgos()
      .then((d) => setNgos(d.ngos || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const refresh = () => listNgos().then((d) => setNgos(d.ngos || [])).catch(() => {});

  const donate = async () => {
    setBusy(true);
    setError('');
    try {
      const order = await createDonation({
        ngo_id: selected.id,
        amount: Number(amount),
        is_anonymous: anon,
        message: message || null,
      });

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'KisaanConnect',
        description: 'Donation to ' + order.ngo_name,
        order_id: order.razorpay_order_id,
        theme: { color: '#167208' },
        handler: async (r) => {
          try {
            await verifyDonation({
              donation_id: order.donation_id,
              razorpay_order_id: r.razorpay_order_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
            });
            setDone({ ngo: order.ngo_name, amount: Number(amount) });
            setSelected(null);
            setMessage('');
            refresh();
          } catch (e) {
            setError(e.message);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });

      rzp.open();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <section className="bg-[var(--kc-ink)] px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <span className="text-[11px] tracking-[0.18em] uppercase text-[var(--kc-sprout)]">
            NGO Support
          </span>
          <h1 className="text-[var(--kc-mint)] max-w-2xl mt-3 mb-4">
            Back the people who back farmers
          </h1>
          <p className="text-[var(--kc-line)]/80 max-w-xl leading-relaxed">
            These organisations work on debt relief, water, seed sovereignty and
            education across rural Maharashtra. Every rupee goes to them directly.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8 rounded-xl border border-[var(--kc-line)] bg-[var(--kc-sprout-soft)] px-4 py-3 text-sm text-[var(--kc-ink)]">
          Demo partners shown. Payments run in test mode while partnership
          agreements are being finalised.
        </div>

        {done && (
          <div className="mb-8 rounded-xl border border-[var(--kc-forest)] bg-[var(--kc-card)] px-5 py-4">
            <p className="text-[var(--kc-forest)] font-medium">Thank you.</p>
            <p className="text-sm text-[var(--kc-ink-muted)] mt-1">
              Your donation of Rs. {done.amount} to {done.ngo} was received.
            </p>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
        {loading && <p className="loading-message">Loading organisations...</p>}

        <div className="grid gap-5 md:grid-cols-2">
          {ngos.map((n) => (
            <div key={n.id} className="card p-6 flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-[var(--kc-ink)]">{n.name}</h3>
                {n.is_verified && (
                  <span className="shrink-0 rounded-full bg-[var(--kc-sprout-soft)] px-2.5 py-1 text-[11px] text-[var(--kc-forest)]">
                    Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--kc-forest)] mb-3">
                {n.focus_area} &middot; {n.location}
              </p>
              <p className="text-sm text-[var(--kc-ink-muted)] leading-relaxed flex-1">
                {n.description}
              </p>
              <div className="mt-5 flex items-center justify-between">
                <span className="text-xs text-[var(--kc-ink-muted)]">
                  Rs. {Number(n.total_raised).toLocaleString('en-IN')} raised
                  {n.donor_count > 0 && ` from ${n.donor_count} donors`}
                </span>
                <button
                  onClick={() => { setSelected(n); setDone(null); }}
                  className="rounded-lg bg-[var(--kc-forest)] px-4 py-2 text-sm text-[var(--kc-mint)] hover:bg-[var(--kc-forest-dark)]"
                >
                  Donate
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[var(--kc-card)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[var(--kc-ink)] mb-1">Donate to {selected.name}</h3>
            <p className="text-xs text-[var(--kc-ink-muted)] mb-5">{selected.focus_area}</p>

            <div className="flex flex-wrap gap-2 mb-4">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(p)}
                  className={
                    'rounded-lg px-3.5 py-2 text-sm border ' +
                    (Number(amount) === p
                      ? 'border-[var(--kc-forest)] bg-[var(--kc-sprout-soft)] text-[var(--kc-forest)]'
                      : 'border-[var(--kc-line)] text-[var(--kc-ink-muted)]')
                  }
                >
                  Rs. {p}
                </button>
              ))}
            </div>

            <label>Amount (Rs.)</label>
            <input
              type="number"
              min="10"
              max="100000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            <div style={{ marginTop: '1rem' }}>
              <label>Message (optional)</label>
              <textarea
                rows={2}
                value={message}
                maxLength={500}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="A note for the team"
              />
            </div>

            <label className="flex items-center gap-2 mt-3 text-sm text-[var(--kc-ink-muted)]">
              <input
                type="checkbox"
                checked={anon}
                onChange={(e) => setAnon(e.target.checked)}
                style={{ width: 'auto' }}
              />
              Donate anonymously
            </label>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 rounded-lg border border-[var(--kc-line)] py-2.5 text-sm text-[var(--kc-ink-muted)]"
              >
                Cancel
              </button>
              <button
                onClick={donate}
                disabled={busy || Number(amount) < 10}
                className="flex-1 rounded-lg bg-[var(--kc-forest)] py-2.5 text-sm text-[var(--kc-mint)] disabled:opacity-50"
              >
                {busy ? 'Opening...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}