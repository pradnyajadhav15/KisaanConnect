import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import '../../styles/consumer/Checkout.css';

// --------------------------------------------------
// VALIDATION RULES
// --------------------------------------------------
const validate = (formData) => {
  const errors = {};
  if (!formData.name.trim())    errors.name    = 'Name is required';
  if (!formData.address.trim()) errors.address = 'Address is required';
  if (!formData.city.trim())    errors.city    = 'City is required';
  if (!formData.state.trim())   errors.state   = 'State is required';

  if (!formData.pincode.trim())          errors.pincode = 'PIN code is required';
  else if (!/^\d{6}$/.test(formData.pincode)) errors.pincode = 'PIN code must be 6 digits';

  if (!formData.phone.trim())            errors.phone = 'Phone number is required';
  else if (!/^\d{10}$/.test(formData.phone))  errors.phone = 'Phone number must be 10 digits';

  if (formData.email && !/\S+@\S+\.\S+/.test(formData.email))
    errors.email = 'Invalid email address';

  return errors;
};

const INITIAL_FORM = {
  name: '', address: '', city: '', state: '',
  pincode: '', phone: '', email: '', paymentMethod: 'cod'
};

// Tolerate backend cart field names (unit_price/quantity/crop_id/crop_name)
// as well as a pre-mapped frontend shape (total/productId/name).
const lineTotal = (item) =>
  item.total ?? ((item.unit_price ?? 0) * (item.quantity ?? 0));
const lineKey  = (item, i) => item.productId ?? item.crop_id ?? item.id ?? i;
const lineName = (item) => item.name ?? item.crop_name ?? 'Item';


// --------------------------------------------------
// COMPONENT
// --------------------------------------------------
const Checkout = ({ cartItems = [], onPlaceOrder, onBack }) => {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);

  const totalAmount = useMemo(
    () => cartItems.reduce((sum, item) => sum + lineTotal(item), 0),
    [cartItems]
  );

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  }, []);

  // Allow only digits for phone & pincode
  const handleDigitsOnly = useCallback((e) => {
    const { name, value } = e.target;
    if (/^\d*$/.test(value)) {
      setFormData(prev => ({ ...prev, [name]: value }));
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const newErrors = validate(formData);
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const fullAddress = `${formData.address}, ${formData.city}, ${formData.state} - ${formData.pincode}`;
      // NOTE: backend /consumer/orders currently accepts only shipping_address,
      // cart_id, items. name/phone/email/paymentMethod are passed up here but
      // will NOT be stored unless the backend orders table gains those columns.
      // For a COD pilot, phone is important — add a `phone` column to orders
      // and accept it server-side so farmers can coordinate delivery.
      await onPlaceOrder({
        name:          formData.name,
        shipping_address: fullAddress,   // matches backend field name
        address:       fullAddress,      // kept for any existing frontend use
        phone:         formData.phone,
        email:         formData.email,
        paymentMethod: formData.paymentMethod,
      });
    } finally {
      setLoading(false);
    }
  }, [formData, onPlaceOrder]);

  const fieldError = (name) =>
    errors[name] ? <span className="error-message" role="alert">{errors[name]}</span> : null;

  if (cartItems.length === 0) {
    return (
      <div className="checkout">
        <button className="back-button" onClick={onBack}>&larr; Back to Cart</button>
        <p className="no-products-message">Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="checkout">
      <button className="back-button" onClick={onBack}>&larr; Back to Cart</button>
      <h2>Checkout</h2>

      <div className="checkout-container">

        {/* Order Summary */}
        <div className="order-summary">
          <h3>Order Summary</h3>
          <div className="order-items">
            {cartItems.map((item, i) => (
              <div key={lineKey(item, i)} className="order-item">
                <div className="order-item-info">
                  <span className="order-item-name">{lineName(item)}</span>
                  <span className="order-item-quantity">x{item.quantity}</span>
                </div>
                <span className="order-item-price">₹{lineTotal(item).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="order-total">
            <span className="total-label">Total Amount:</span>
            <span className="total-value">₹{totalAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Checkout Form */}
        <div className="checkout-form-container">
          <h3>Delivery Information</h3>
          <form className="checkout-form" onSubmit={handleSubmit} noValidate>

            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
              <input type="text" id="name" name="name"
                value={formData.name} onChange={handleChange}
                className={errors.name ? 'error' : ''} disabled={loading} />
              {fieldError('name')}
            </div>

            <div className="form-group">
              <label htmlFor="address">Address *</label>
              <textarea id="address" name="address"
                value={formData.address} onChange={handleChange}
                className={errors.address ? 'error' : ''} disabled={loading} />
              {fieldError('address')}
            </div>

            <div className="form-row">
              {[
                { id: 'city',  label: 'City *' },
                { id: 'state', label: 'State *' },
              ].map(({ id, label }) => (
                <div className="form-group" key={id}>
                  <label htmlFor={id}>{label}</label>
                  <input type="text" id={id} name={id}
                    value={formData[id]} onChange={handleChange}
                    className={errors[id] ? 'error' : ''} disabled={loading} />
                  {fieldError(id)}
                </div>
              ))}

              <div className="form-group">
                <label htmlFor="pincode">PIN Code *</label>
                <input type="text" id="pincode" name="pincode"
                  value={formData.pincode} onChange={handleDigitsOnly}
                  maxLength="6" inputMode="numeric"
                  className={errors.pincode ? 'error' : ''} disabled={loading} />
                {fieldError('pincode')}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="phone">Phone Number *</label>
                <input type="tel" id="phone" name="phone"
                  value={formData.phone} onChange={handleDigitsOnly}
                  maxLength="10" inputMode="numeric"
                  className={errors.phone ? 'error' : ''} disabled={loading} />
                {fieldError('phone')}
              </div>

              <div className="form-group">
                <label htmlFor="email">Email (Optional)</label>
                <input type="email" id="email" name="email"
                  value={formData.email} onChange={handleChange}
                  className={errors.email ? 'error' : ''} disabled={loading} />
                {fieldError('email')}
              </div>
            </div>

            <div className="form-group">
              <label>Payment Method *</label>
              <div className="payment-options">
                <div className="payment-option">
                  <input type="radio" id="cod" name="paymentMethod"
                    value="cod" checked={formData.paymentMethod === 'cod'}
                    onChange={handleChange} disabled={loading} />
                  <label htmlFor="cod">Cash on Delivery</label>
                </div>
              </div>
            </div>

            <button type="submit" className="place-order-button" disabled={loading}>
              {loading ? 'Placing Order...' : `Place Order — ₹${totalAmount.toFixed(2)}`}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
};

Checkout.propTypes = {
  cartItems:    PropTypes.array.isRequired,
  onPlaceOrder: PropTypes.func.isRequired,
  onBack:       PropTypes.func.isRequired,
};

export default Checkout;