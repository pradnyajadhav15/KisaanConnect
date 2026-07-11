import React, { memo } from 'react';
import PropTypes from 'prop-types';
import '../styles/ProductSection.css';
import ProductCard from './ProductCard';

const ProductSection = memo(({ products = [] }) => {
  return (
    <div className="product-section">
      <h2 className="section-title">Shop our most popular items</h2>

      {products.length === 0 ? (
        <p className="no-products-message">No products available right now.</p>
      ) : (
        <div className="product-grid">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
});

ProductSection.displayName = 'ProductSection';

ProductSection.propTypes = {
  products: PropTypes.array.isRequired,
};

export default ProductSection;