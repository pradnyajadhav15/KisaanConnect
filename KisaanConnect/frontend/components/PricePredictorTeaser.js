'use client';
import { useEffect, useState } from 'react';
import { predictCropPrice, getPriceOptions, getVarieties } from '../lib/pricePredictionService';

export default function PricePredictorTeaser() {
  const [options, setOptions] = useState({ states: [], commodities: [] });
  const [varieties, setVarieties] = useState([]);
  const [form, setForm] = useState({ state: '', commodity: '', variety: '', quantity: 100 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getPriceOptions()
      .then((opts) => {
        setOptions(opts);
        setForm((f) => ({
          ...f,
          state: opts.states[0] || '',
          commodity: opts.commodities[0] || '',
        }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.commodity) return;
    getVarieties(form.commodity)
      .then((d) => {
        setVarieties(d.varieties || []);
        setForm((f) => ({ ...f, variety: (d.varieties && d.varieties[0]) || '' }));
      })
      .catch(() => setVarieties([]));
  }, [form.commodity]);

  const handleChange = (field) => (e) => {
    const value = field === 'quantity' ? Number(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await predictCropPrice(form);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Could not get a prediction right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#241F1A] py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div>
            <span className="text-[11px] tracking-[0.2em] uppercase text-[#E8A33D] font-mono">
              Try it yourself
            </span>
            <h2 className="font-serif text-3xl text-[#FAF6ED] mt-2 mb-4">
              What&apos;s your crop worth right now?
            </h2>
            <p className="text-[#FAF6ED]/70 text-sm leading-relaxed max-w-md">
              Pick your state and commodity — our model checks real AGMARKNET
              mandi prices and gives you a fair estimate before you decide when to sell.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-[#FAF6ED] rounded-sm p-6 shadow-lg">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-[#241F1A]/60 mb-1">State</label>
                <select
                  value={form.state}
                  onChange={handleChange('state')}
                  className="w-full border border-[#241F1A]/20 rounded-sm px-3 py-2 text-sm bg-white"
                >
                  {options.states.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#241F1A]/60 mb-1">Commodity</label>
                <select
                  value={form.commodity}
                  onChange={handleChange('commodity')}
                  className="w-full border border-[#241F1A]/20 rounded-sm px-3 py-2 text-sm bg-white"
                >
                  {options.commodities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#241F1A]/60 mb-1">Variety</label>
                <select
                  value={form.variety}
                  onChange={handleChange('variety')}
                  className="w-full border border-[#241F1A]/20 rounded-sm px-3 py-2 text-sm bg-white"
                >
                  {varieties.length === 0 && <option value="">Standard</option>}
                  {varieties.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#241F1A]/60 mb-1">Quantity (kg)</label>
                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={handleChange('quantity')}
                  className="w-full border border-[#241F1A]/20 rounded-sm px-3 py-2 text-sm bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2E7D32] text-white text-sm font-medium py-2.5 rounded-sm hover:bg-[#256428] transition disabled:opacity-60"
            >
              {loading ? 'Checking mandi trends…' : 'Get price estimate'}
            </button>

            {error && <p className="text-xs text-[#C1622D] mt-3">{error}</p>}

            {result && (
              <div className="mt-4 pt-4 border-t border-[#241F1A]/10">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-[#241F1A]/60">Estimated price</span>
                  <span className="font-mono text-2xl text-[#2E7D32] font-semibold">
                    ₹{result.price_per_kg}/kg
                  </span>
                </div>
                <div className="text-xs text-[#241F1A]/50 mt-1">
                  Range: ₹{result.min_price_per_kg} – ₹{result.max_price_per_kg} · confidence: {result.confidence}
                </div>
                <div className="text-xs text-[#241F1A]/50 mt-1">
                  Estimated value for {form.quantity}kg: ₹{result.factors.estimated_total_value}
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}