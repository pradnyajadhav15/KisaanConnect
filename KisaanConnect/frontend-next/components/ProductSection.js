import ProductCard from './ProductCard';

export default function ProductSection({ products }) {
  const list = products || [];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ marginBottom: 20 }}>Shop our most popular items</h2>
      {list.length === 0 ? (
        <p>No products available right now.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {list.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
