'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listPlots, adoptPlot, verifyAdoption } from '../../lib/communityService';

export default function AdoptFarmPage() {
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [done, setDone] = useState(null);

  const load = () =>
    listPlots()
      .then((d) => setPlots(d.plots || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const adopt = async (plot) => {
    setBusyId(plot.id);
    setError('');
    try {
      const order = await adoptPlot(plot.id);

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'KisaanConnect',
        description: 'Adopting ' + plot.title,
        order_id: order.razorpay_order_id,
        theme: { color: '#167208' },
        handler: async (r) => {
          try {
            await verifyAdoption({
              adoption_id: order.adoption_id,
              razorpay_order_id: r.razorpay_order_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
            });
            setDone(plot.title);
            load();
          } catch (e) {
            setError(e.message);
          }
        },
        modal: { ondismiss: () => setBusyId(null) },
      });

      rzp.open();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen">
      <section className="bg-[var(--kc-ink)] px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <span className="text-[11px] tracking-[0.18em] uppercase text-[var(--kc-sprout)]">
            Adopt a Farm
          </span>
          <h1 className="text-[var(--kc-mint)] max-w-2xl mt-3 mb-4">
            Sponsor a plot. Follow it to harvest.
          </h1>
          <p className="text-[var(--kc-line)]/80 max-w-xl leading-relaxed">
            Pay a farmer up front for a season, receive their produce when it is
            ready, and see updates from the field along the way.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {[
            ['01', 'Choose a plot', 'Pick a farmer and crop. You see the area, expected yield and season dates before paying.'],
            ['02', 'Pay for the season', 'The farmer gets working capital up front instead of borrowing against the harvest.'],
            ['03', 'Follow and receive', 'Get updates from the field, then your share of the produce at harvest.'],
          ].map(([n, t, d]) => (
            <div key={n} className="border-l-2 border-[var(--kc-forest)] pl-4">
              <span className="text-xs text-[var(--kc-forest)]">{n}</span>
              <p className="text-[var(--kc-ink)] mt-1 mb-1">{t}</p>
              <p className="text-sm text-[var(--kc-ink-muted)] leading-relaxed">{d}</p>
            </div>
          ))}
        </div>

        {done && (
          <div className="mb-8 rounded-xl border border-[var(--kc-forest)] bg-[var(--kc-card)] px-5 py-4">
            <p className="text-[var(--kc-forest)] font-medium">Adoption confirmed.</p>
            <p className="text-sm text-[var(--kc-ink-muted)] mt-1">
              You have adopted {done}. The farmer will post updates as the season progresses.
            </p>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
        {loading && <p className="loading-message">Loading available plots...</p>}

        {!loading && plots.length === 0 && (
          <div className="card p-10 text-center">
            <p className="text-[var(--kc-ink)] mb-2">No plots listed yet</p>
            <p className="text-sm text-[var(--kc-ink-muted)] mb-5">
              Farmers can list a plot for adoption from their dashboard.
            </p>
            <Link
              href="/farmer"
              className="inline-block rounded-lg bg-[var(--kc-forest)] px-5 py-2.5 text-sm text-[var(--kc-mint)]"
            >
              Go to farmer dashboard
            </Link>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-3">
          {plots.map((p) => {
            const full = p.slots_available <= 0;
            return (
              <div key={p.id} className="card overflow-hidden flex flex-col">
                <div className="h-40 bg-[var(--kc-sprout-soft)] overflow-hidden">
                  {p.image_url && (
                    <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="text-[var(--kc-ink)] mb-1">{p.title}</h3>
                  <p className="text-xs text-[var(--kc-forest)] mb-3">
                    {p.crop_type} &middot; {p.location}
                  </p>
                  <p className="text-sm text-[var(--kc-ink-muted)] leading-relaxed flex-1">
                    {p.description}
                  </p>

                  <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-xs">
                    <dt className="text-[var(--kc-ink-muted)]">Farmer</dt>
                    <dd className="text-[var(--kc-ink)] text-right">{p.farmer_name}</dd>
                    <dt className="text-[var(--kc-ink-muted)]">Area</dt>
                    <dd className="text-[var(--kc-ink)] text-right">{p.area_guntha} guntha</dd>
                    {p.expected_yield_kg && (
                      <>
                        <dt className="text-[var(--kc-ink-muted)]">Expected yield</dt>
                        <dd className="text-[var(--kc-ink)] text-right">{p.expected_yield_kg} kg</dd>
                      </>
                    )}
                    <dt className="text-[var(--kc-ink-muted)]">Slots left</dt>
                    <dd className="text-[var(--kc-ink)] text-right">
                      {p.slots_available} of {p.slots_total}
                    </dd>
                  </dl>

                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-[var(--kc-forest)] font-semibold">
                      Rs. {Number(p.price_per_season).toLocaleString('en-IN')}
                      <span className="text-xs font-normal text-[var(--kc-ink-muted)]"> / season</span>
                    </span>
                    <button
                      onClick={() => adopt(p)}
                      disabled={full || busyId === p.id}
                      className="rounded-lg bg-[var(--kc-forest)] px-4 py-2 text-sm text-[var(--kc-mint)] hover:bg-[var(--kc-forest-dark)] disabled:opacity-40"
                    >
                      {full ? 'Full' : busyId === p.id ? 'Opening...' : 'Adopt'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}