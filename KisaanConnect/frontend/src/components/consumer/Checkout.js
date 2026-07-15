import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import '../../styles/consumer/Checkout.css';
import * as paymentApi from '../../services/api/paymentApi';

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

const lineTotal = (item) =>
  item.total ?? ((item.unit_price ?? 0) * (item.quantity ?? 0));
const lineKey  = (item, i) => item.productId ?? item.crop_id ?? item.id ?? i;
const lineName = (item) => item.name ?? item.crop_name ?? 'Item';


const Checkout = ({ cartItems = [], onPlaceOrder, onBack }) => {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const totalAmount = useMemo(
    () => cartItems.reduce((sum, item) => sum + lineTotal(item), 0),
    [cartItems]
  );

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  }, []);

  const handleDigitsOnly = useCallback((e) => {
    const { name, value } = e.target;
    if (/^\d*$/.test(value)) {
      setFormData(prev => ({ ...prev, [name]: value }));
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  }, []);

  const handleRazorpayPayment = useCallback(async (orderId) => {
    try {
      const paymentOrder = await paymentApi.createPaymentOrder(orderId);

      const options = {
        key: paymentOrder.key_id,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: 'KisaanConnect',
        description: 'Order #' + orderId,
        order_id: paymentOrder.razorpay_order_id,
        handler: async function (response) {
          try {
            await paymentApi.verifyPayment({
              order_id: orderId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            window.location.reload();
          } catch (err) {
            setPaymentError('Payment verification failed. Please contact support with your payment ID.');
          }
        },
        prefill: {
          name: formData.name,
          contact: formData.phone,
          email: formData.email,
        },
        theme: {
          color: '#2e7d32',
        },
        modal: {
          ondismiss: function () {
            setPaymentError('Payment cancelled. Your order is saved but unpaid - you can retry from My Orders.');
            setLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setPaymentError((err && err.message) || 'Could not start payment. Please try again.');
      setLoading(false);
    }
  }, [formData]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const newErrors = validate(formData);
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setPaymentError('');
    try {
      const fullAddress = formData.address + ', ' + formData.city + ', ' + formData.state + ' - ' + formData.pincode;

      const result = await onPlaceOrder({
        name:          formData.name,
        shipping_address: fullAddress,
        address:       fullAddress,
        phone:         formData.phone,
        email:         formData.email,
        paymentMethod: formData.paymentMethod,
      });

      if (formData.paymentMethod === 'online' && result && result.order_id) {
        await handleRazorpayPayment(result.order_id);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
    }
  }, [formData, onPlaceOrder, handleRazorpayPayment]);

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

      {paymentError && <div className="form-error" role="alert">{paymentError}</div>}

      <div className="checkout-container">

        <div className="order-summary">
          <h3>Order Summary</h3>
          <div className="order-items">
            {cartItems.map((item, i) => (
              <div key={lineKey(item, i)} className="order-item">
                <div className="order-item-info">
                  <span className="order-item-name">{lineName(item)}</span>
                  <span className="order-item-quantity">{'x' + item.quantity}</span>
                </div>
                <span className="order-item-price">{'Rs. ' + lineTotal(item).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="order-total">
            <span className="total-label">Total Amount:</span>
            <span className="total-value">{'Rs. ' + totalAmount.toFixed(2)}</span>
          </div>
        </div>

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
                <div className="payment-option">
                  <input type="radio" id="online" name="paymentMethod"
                    value="online" checked={formData.paymentMethod === 'online'}
                    onChange={handleChange} disabled={loading} />
                  <label htmlFor="online">Pay Online (UPI / Card / Netbanking)</label>
                </div>
              </div>
            </div>

            <button type="submit" className="place-order-button" disabled={loading}>
              {loading
                ? (formData.paymentMethod === 'online' ? 'Opening payment...' : 'Placing Order...')
                : ('Place Order - Rs. ' + totalAmount.toFixed(2))}
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
