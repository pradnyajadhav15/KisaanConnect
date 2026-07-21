'use client';
import { useMemo, useCallback } from 'react';
import './ShoppingCart.css';

const FALLBACK_IMAGE = '/images/placeholder-crop.png';

export default function ShoppingCart({ cartItems, onUpdateQuantity, onRemoveItem, onCheckout }) {
  const items = cartItems || [];

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + (item.total || 0), 0),
    [items]
  );

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const handleQuantityChange = useCallback((productId, e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0) onUpdateQuantity(productId, val);
  }, [onUpdateQuantity]);

  const handleIncrement = useCallback((productId, qty) => {
    onUpdateQuantity(productId, qty + 1);
  }, [onUpdateQuantity]);

  const handleDecrement = useCallback((productId, qty) => {
    if (qty > 1) onUpdateQuantity(productId, qty - 1);
  }, [onUpdateQuantity]);

  return (
    <div className="shopping-cart">
      <h2>
        Your Shopping Cart
        {totalItems > 0 && (
          <span className="cart-item-count">{' (' + totalItems + ' item' + (totalItems !== 1 ? 's' : '') + ')'}</span>
        )}
      </h2>

      {items.length === 0 ? (
        <div className="empty-cart">
          <p>Your cart is empty.</p>
          <p>Add some products to your cart to see them here.</p>
        </div>
      ) : (
        <>
          <div className="cart-items">
            <table className="cart-table">
              <thead>
                <tr><th>Product</th><th>Price</th><th>Quantity</th><th>Total</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.productId} className="cart-item">
                    <td className="product-cell">
                      <div className="cart-product-info">
                        <img
                          src={item.image || FALLBACK_IMAGE}
                          alt={item.name}
                          className="cart-product-image"
                          onError={(e) => { e.target.src = FALLBACK_IMAGE; }}
                        />
                        <span className="cart-product-name">{item.name}</span>
                      </div>
                    </td>
                    <td className="price-cell">{'Rs. ' + item.price + ' / ' + item.unit}</td>
                    <td className="quantity-cell">
                      <div className="cart-quantity-controls">
                        <button
                          className="quantity-button"
                          onClick={() => handleDecrement(item.productId, item.quantity)}
                          disabled={item.quantity <= 1}
                          aria-label="Decrease quantity"
                        >-</button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.productId, e)}
                          min="1"
                          className="cart-quantity-input"
                          aria-label={'Quantity for ' + item.name}
                        />
                        <button
                          className="quantity-button"
                          onClick={() => handleIncrement(item.productId, item.quantity)}
                          aria-label="Increase quantity"
                        >+</button>
                      </div>
                    </td>
                    <td className="total-cell">{'Rs. ' + (item.total || 0).toFixed(2)}</td>
                    <td className="actions-cell">
                      <button
                        className="remove-button"
                        onClick={() => onRemoveItem(item.productId)}
                        aria-label={'Remove ' + item.name + ' from cart'}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cart-summary">
            <div className="cart-total">
              <span className="total-label">Total Amount:</span>
              <span className="total-value">{'Rs. ' + totalAmount.toFixed(2)}</span>
            </div>
            <button className="checkout-button" onClick={onCheckout}>
              Proceed to Checkout
            </button>
          </div>
        </>
      )}
    </div>
  );
}
