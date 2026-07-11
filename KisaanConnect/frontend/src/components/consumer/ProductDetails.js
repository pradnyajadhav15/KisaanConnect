import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import '../../styles/consumer/ProductDetails.css';

const FALLBACK_IMAGE = '/images/placeholder-crop.png';

const ProductDetails = ({ product, onAddToCart, onBack }) => {
  const [quantity, setQuantity] = useState(1);

  const maxQty     = product.quantity ?? 0;
  const inStock    = maxQty > 0;
  const totalPrice = useMemo(() => (product.price * quantity).toFixed(2), [product.price, quantity]);

  const clampQty = (val) => Math.min(Math.max(1, val), maxQty);

  const handleQuantityChange = useCallback((e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) setQuantity(clampQty(val));
  }, [maxQty]);

  const handleIncrement = useCallback(() => setQuantity(q => clampQty(q + 1)), [maxQty]);
  const handleDecrement = useCallback(() => setQuantity(q => clampQty(q - 1)), []);

  const handleAddToCart = useCallback(() => {
    if (!inStock) return;
    onAddToCart(product, quantity);
  }, [product, quantity, inStock, onAddToCart]);

  return (
    <div className="product-details">
      <button className="back-button" onClick={onBack}>
        &larr; Back to Products
      </button>

      <div className="product-details-container">

        {/* Image */}
        <div className="product-image-large">
          <img
            src={product.image || FALLBACK_IMAGE}
            alt={product.name}
            onError={e => { e.target.src = FALLBACK_IMAGE; }}
          />
        </div>

        {/* Info */}
        <div className="product-details-info">
          <h2 className="product-title">{product.name}</h2>
          <p className="product-price">₹{product.price} per {product.unit}</p>

          <p className="product-availability">
            <span className="availability-label">Availability: </span>
            <span className={`availability-value ${inStock ? 'in-stock' : 'out-of-stock'}`}>
              {inStock ? `${maxQty} ${product.unit} available` : 'Out of Stock'}
            </span>
          </p>

          {product.description && (
            <div className="product-description">
              <h3>Description</h3>
              <p>{product.description}</p>
            </div>
          )}

          <div className="farmer-info">
            <h3>Farmer Information</h3>
            {product.farmerName && <p><strong>Name:</strong> {product.farmerName}</p>}
            {product.location   && <p><strong>Location:</strong> 📍 {product.location}</p>}
          </div>

          {/* Quantity selector */}
          {inStock && (
            <div className="quantity-selector">
              <h3>Quantity</h3>
              <div className="quantity-input-group">
                <button
                  className="quantity-button"
                  onClick={handleDecrement}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                >−</button>

                <input
                  type="number"
                  value={quantity}
                  onChange={handleQuantityChange}
                  min="1"
                  max={maxQty}
                  className="quantity-input"
                  aria-label="Quantity"
                />

                <button
                  className="quantity-button"
                  onClick={handleIncrement}
                  disabled={quantity >= maxQty}
                  aria-label="Increase quantity"
                >+</button>
              </div>
            </div>
          )}

          <div className="total-price">
            <h3>Total Price</h3>
            <p className="total-amount">₹{totalPrice}</p>
          </div>

          <button
            className="add-to-cart-large"
            onClick={handleAddToCart}
            disabled={!inStock}
          >
            {inStock ? 'Add to Cart' : 'Out of Stock'}
          </button>
        </div>

      </div>
    </div>
  );
};

ProductDetails.propTypes = {
  product:    PropTypes.object.isRequired,
  onAddToCart: PropTypes.func.isRequired,
  onBack:      PropTypes.func.isRequired,
};

export default ProductDetails;