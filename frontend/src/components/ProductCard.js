import React, { memo } from 'react';
import PropTypes from 'prop-types';
import '../styles/ProductCard.css';

const FALLBACK_IMAGE = '/images/placeholder-crop.png';

const ProductCard = memo(({ product }) => {
  const { name, price, unit, image } = product;

  return (
    <div className="product-card">
      <div className="product-image-container">
        <img
          src={image || FALLBACK_IMAGE}
          alt={name}
          className="product-image"
          onError={e => { e.target.src = FALLBACK_IMAGE; }}
          loading="lazy"
        />
      </div>
      <div className="product-info">
        <h3 className="product-name">{name}</h3>
        <p className="product-price">₹{price} / {unit}</p>
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';

ProductCard.propTypes = {
  product: PropTypes.shape({
    name:  PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    unit:  PropTypes.string.isRequired,
    image: PropTypes.string,
  }).isRequired,
};

export default ProductCard;