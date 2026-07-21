export default function ProductCard({ product }) {
  const name = product.name;
  const price = product.price;
  const unit = product.unit;
  const image = product.image;

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
      <img
        src={image || '/images/placeholder-crop.png'}
        alt={name}
        style={{ width: '100%', height: 160, objectFit: 'cover' }}
        loading="lazy"
      />
      <div style={{ padding: 12 }}>
        <h3 style={{ margin: '0 0 6px 0', fontSize: 16 }}>{name}</h3>
        <p style={{ margin: 0, color: '#2e7d32', fontWeight: 700 }}>
          {'Rs. ' + price + ' / ' + unit}
        </p>
      </div>
    </div>
  );
}
