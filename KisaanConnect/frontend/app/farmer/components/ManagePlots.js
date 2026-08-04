'use client';

import { useEffect, useState } from 'react';
import { createPlot, myPlots, postPlotUpdate } from '../../../lib/communityService';

const EMPTY = {
  title: '', description: '', crop_type: '', location: '',
  area_guntha: '', price_per_season: '', expected_yield_kg: '',
  season_start: '', season_end: '', slots_total: 1, image_url: '',
};

export default function ManagePlots() {
  const [plots, setPlots] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [updateFor, setUpdateFor] = useState(null);
  const [update, setUpdate] = useState({ title: '', body: '' });

  const load = () => myPlots().then((d) => setPlots(d.plots || [])).catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    setError(''); setOk(''); setBusy(true);
    try {
      await createPlot({
        title: form.title,
        description: form.description || null,
        crop_type: form.crop_type,
        location: form.location,
        area_guntha: Number(form.area_guntha),
        price_per_season: Number(form.price_per_season),
        expected_yield_kg: form.expected_yield_kg ? Number(form.expected_yield_kg) : null,
        season_start: form.season_start || null,
        season_end: form.season_end || null,
        slots_total: Number(form.slots_total) || 1,
        image_url: form.image_url || null,
      });
      setOk('Plot listed. It is now visible on the Adopt a Farm page.');
      setForm(EMPTY);
      setShowForm(false);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendUpdate = async () => {
    setError(''); setBusy(true);
    try {
      await postPlotUpdate(updateFor.id, { title: update.title, body: update.body || null });
      setOk('Update posted for ' + updateFor.title);
      setUpdate({ title: '', body: '' });
      setUpdateFor(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const valid = form.title && form.crop_type && form.location &&
                Number(form.area_guntha) > 0 && Number(form.price_per_season) > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[var(--kc-ink)]">Plots for adoption</h2>
          <p className="text-sm text-[var(--kc-ink-muted)] mt-1">
            List a plot and consumers can sponsor a full season up front.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setOk(''); }}
          className="rounded-lg bg-[var(--kc-forest)] px-4 py-2 text-sm text-[var(--kc-mint)] shrink-0"
        >
          {showForm ? 'Close' : 'List a plot'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {ok && (
        <div className="mb-5 rounded-lg border border-[var(--kc-forest)] bg-[var(--kc-sprout-soft)] px-4 py-3 text-sm text-[var(--kc-forest)]">
          {ok}
        </div>
      )}

      {showForm && (
        <div className="card p-6 mb-8">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label>Title</label>
              <input value={form.title} onChange={set('title')} placeholder="Half-acre Kesar mango block" />
            </div>
            <div>
              <label>Crop</label>
              <input value={form.crop_type} onChange={set('crop_type')} placeholder="Mango" />
            </div>
            <div>
              <label>Location</label>
              <input value={form.location} onChange={set('location')} placeholder="Kini, Akkalkot" />
            </div>
            <div>
              <label>Area (guntha)</label>
              <input type="number" value={form.area_guntha} onChange={set('area_guntha')} />
            </div>
            <div>
              <label>Price per season (Rs.)</label>
              <input type="number" value={form.price_per_season} onChange={set('price_per_season')} />
            </div>
            <div>
              <label>Expected yield (kg)</label>
              <input type="number" value={form.expected_yield_kg} onChange={set('expected_yield_kg')} />
            </div>
            <div>
              <label>Season start</label>
              <input type="date" value={form.season_start} onChange={set('season_start')} />
            </div>
            <div>
              <label>Season end</label>
              <input type="date" value={form.season_end} onChange={set('season_end')} />
            </div>
            <div>
              <label>Slots available</label>
              <input type="number" min="1" value={form.slots_total} onChange={set('slots_total')} />
            </div>
            <div>
              <label>Image URL</label>
              <input value={form.image_url} onChange={set('image_url')} placeholder="https://..." />
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label>Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={set('description')}
              placeholder="What will the sponsor receive, and when?"
            />
          </div>

          <button
            onClick={submit}
            disabled={!valid || busy}
            className="mt-5 rounded-lg bg-[var(--kc-forest)] px-5 py-2.5 text-sm text-[var(--kc-mint)] disabled:opacity-40"
          >
            {busy ? 'Listing...' : 'List this plot'}
          </button>
        </div>
      )}

      {plots.length === 0 ? (
        <p className="loading-message">You have not listed any plots yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {plots.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[var(--kc-ink)]">{p.title}</h3>
                  <p className="text-xs text-[var(--kc-forest)] mt-1">
                    {p.crop_type} &middot; {p.location}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--kc-sprout-soft)] px-2.5 py-1 text-[11px] text-[var(--kc-forest)]">
                  {p.slots_taken} / {p.slots_total} adopted
                </span>
              </div>
              <p className="mt-3 text-sm text-[var(--kc-ink-muted)]">
                Rs. {Number(p.price_per_season).toLocaleString('en-IN')} per season
                &middot; {p.area_guntha} guntha
              </p>
              <button
                onClick={() => { setUpdateFor(p); setOk(''); }}
                className="mt-4 rounded-lg border border-[var(--kc-line)] px-3.5 py-2 text-sm text-[var(--kc-ink-muted)] hover:border-[var(--kc-forest)] hover:text-[var(--kc-forest)]"
              >
                Post an update
              </button>
            </div>
          ))}
        </div>
      )}

      {updateFor && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setUpdateFor(null)}
        >
          <div className="w-full max-w-md rounded-2xl bg-[var(--kc-card)] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[var(--kc-ink)] mb-1">Update on {updateFor.title}</h3>
            <p className="text-xs text-[var(--kc-ink-muted)] mb-5">
              Everyone who adopted this plot will see it.
            </p>

            <label>Title</label>
            <input
              value={update.title}
              onChange={(e) => setUpdate({ ...update, title: e.target.value })}
              placeholder="Flowering has started"
            />

            <div style={{ marginTop: '1rem' }}>
              <label>Details</label>
              <textarea
                rows={4}
                value={update.body}
                onChange={(e) => setUpdate({ ...update, body: e.target.value })}
                placeholder="What is happening in the field this week?"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setUpdateFor(null)}
                className="flex-1 rounded-lg border border-[var(--kc-line)] py-2.5 text-sm text-[var(--kc-ink-muted)]"
              >
                Cancel
              </button>
              <button
                onClick={sendUpdate}
                disabled={!update.title || busy}
                className="flex-1 rounded-lg bg-[var(--kc-forest)] py-2.5 text-sm text-[var(--kc-mint)] disabled:opacity-40"
              >
                {busy ? 'Posting...' : 'Post update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}