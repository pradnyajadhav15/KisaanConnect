'use client';

export default function ProductCard({ product }) {
  const { name, price, unit, image } = product;

  return (
    <div className="group cursor-pointer overflow-hidden rounded-xl border border-[var(--kc-line)] bg-[var(--kc-card)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--kc-forest)] hover:shadow-[0_10px_28px_rgba(0,48,58,0.10)]">
      <div className="overflow-hidden bg-[var(--kc-sprout-soft)]">
        <img
          src={image || '/images/placeholder-crop.svg'}
          alt={name}
          className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            if (!e.currentTarget.dataset.fallback) {
              e.currentTarget.dataset.fallback = '1';
              e.currentTarget.src = '/images/placeholder-crop.svg';
            }
          }}
        />
      </div>
      <div className="p-3.5">
        <h3 className="mb-1.5 text-base text-[var(--kc-ink)]">{name}</h3>
        <p className="m-0 font-semibold text-[var(--kc-forest)]">
          Rs. {price} <span className="font-normal text-[var(--kc-ink-muted)]">/ {unit}</span>
        </p>
      </div>
    </div>
  );
}