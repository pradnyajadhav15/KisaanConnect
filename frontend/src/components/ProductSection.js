import React from 'react';
// import '../styles/ProductSection.css';


import ProductCard from './ProductCard';

const ProductSection = ({ products }) => {
  return (
    <div className="product-section">
      <h2 className="section-title">Shop our most popular items</h2>
      <div className="product-grid">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
};

export default ProductSection; 