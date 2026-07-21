import { getMarketplace } from '../../lib/apiClient';

export const metadata = {
  title: 'Browse Fresh Produce - KisaanConnect',
  description: 'Browse fresh crops directly from farmers near you. No middlemen, fair prices.',
};

export const revalidate = 60;

export default async function MarketplacePage() {
  let products = [];
  let error = null;

  try {
    products = await getMarketplace();
  } catch (err) {
    error = 'Could not load products right now.';
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1>Fresh Produce Marketplace</h1>
      <p>Buy directly from farmers. No middlemen, fair prices.</p>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginTop: 24 }}>
        {products.map((p) => (
          <div key={p.id} style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 16 }}>
            {p.image_url && (
              <img
                src={p.image_url}
                alt={p.name}
                style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }}
              />
            )}
            <h3 style={{ margin: '4px 0' }}>{p.name}</h3>
            <p style={{ margin: '4px 0', color: '#555' }}>{p.location}</p>
            <p style={{ margin: '4px 0', fontWeight: 700, color: '#2e7d32' }}>
              {'Rs. ' + p.price_per_unit + ' / ' + p.unit}
            </p>
          </div>
        ))}
      </div>

      {products.length === 0 && !error && <p>No products available right now.</p>}
    </div>
  );
}
