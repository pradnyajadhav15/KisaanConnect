import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import '../../styles/farmer/AddCropForm.css';
import * as aiApi from '../../services/api/aiApi';

const INITIAL_FORM = {
  name: '', quantity: '', unit: 'kg',
  price: '', location: '', description: '', image_url: ''
};

const AddCropForm = ({ onAddCrop }) => {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [genLoading, setGenLoading] = useState(false);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  }, [error]);

  // --------------------------------------------------
  // AI: generate a description from the crop name (+ a few hints)
  // --------------------------------------------------
  const handleGenerateDescription = useCallback(async () => {
    if (!formData.name.trim()) {
      return setError('Enter the crop name first, then generate a description.');
    }
    setError('');
    setGenLoading(true);
    try {
      const hints = [
        formData.quantity ? `${formData.quantity} ${formData.unit} available` : '',
        formData.location ? `from ${formData.location}` : '',
        formData.description ? `Notes: ${formData.description}` : '',
      ].filter(Boolean).join(', ');

      const res = await aiApi.describeCrop(formData.name.trim(), hints);
      if (res?.description) {
        setFormData(prev => ({ ...prev, description: res.description }));
      } else {
        setError('Could not generate a description. Please try again.');
      }
    } catch {
      setError('AI description failed. Please try again.');
    } finally {
      setGenLoading(false);
    }
  }, [formData]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim())          return setError('Crop name is required');
    if (!formData.quantity)             return setError('Quantity is required');
    if (Number(formData.quantity) <= 0) return setError('Quantity must be greater than 0');
    if (!formData.price)                return setError('Price is required');
    if (Number(formData.price) <= 0)    return setError('Price must be greater than 0');
    if (!formData.location.trim())      return setError('Location is required');
    if (formData.image_url && !/^https?:\/\/.+/i.test(formData.image_url.trim()))
      return setError('Image URL must start with http:// or https://');

    setLoading(true);
    try {
      await onAddCrop({
        name:           formData.name.trim(),
        quantity:       Number(formData.quantity),
        unit:           formData.unit,
        price_per_unit: Number(formData.price),
        location:       formData.location.trim(),
        description:    formData.description.trim(),
        // Backend column is image_url (a string URL), NOT a base64 blob.
        // For real file upload later: upload to free storage (Supabase/
        // Cloudinary), then put the returned URL here.
        image_url:      formData.image_url.trim() || null,
        available:      true,
      });

      setFormData(INITIAL_FORM);
    } catch (err) {
      setError(err?.message || 'Failed to add crop. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [formData, onAddCrop]);

  return (
    <div className="add-crop-form">
      <h2>Add New Crop Listing</h2>

      {error && <div className="form-error" role="alert">{error}</div>}

      <form onSubmit={handleSubmit} noValidate>

        <div className="form-group">
          <label htmlFor="name">Crop Name *</label>
          <input type="text" id="name" name="name"
            value={formData.name} onChange={handleChange}
            placeholder="Enter crop name" disabled={loading} required />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="quantity">Quantity *</label>
            <input type="number" id="quantity" name="quantity"
              value={formData.quantity} onChange={handleChange}
              placeholder="Enter quantity" min="1"
              disabled={loading} required />
          </div>

          <div className="form-group">
            <label htmlFor="unit">Unit</label>
            <select id="unit" name="unit"
              value={formData.unit} onChange={handleChange} disabled={loading}>
              <option value="kg">Kilogram (kg)</option>
              <option value="g">Gram (g)</option>
              <option value="quintal">Quintal</option>
              <option value="ton">Ton</option>
              <option value="piece">Piece</option>
              <option value="dozen">Dozen</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="price">Price (₹ per {formData.unit}) *</label>
          <input type="number" id="price" name="price"
            value={formData.price} onChange={handleChange}
            placeholder="Enter price per unit" min="1"
            disabled={loading} required />
        </div>

        <div className="form-group">
          <label htmlFor="location">Location *</label>
          <input type="text" id="location" name="location"
            value={formData.location} onChange={handleChange}
            placeholder="Enter your location" disabled={loading} required />
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <label htmlFor="description" style={{ margin: 0 }}>Description</label>
            <button
              type="button"
              onClick={handleGenerateDescription}
              disabled={loading || genLoading}
              style={{
                fontSize: 13, padding: '4px 10px', borderRadius: 6,
                border: '1px solid #2e7d32', background: '#fff',
                color: '#2e7d32', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {genLoading ? 'Generating…' : '✨ Generate with AI'}
            </button>
          </div>
          <textarea id="description" name="description"
            value={formData.description} onChange={handleChange}
            placeholder="Describe your crop (optional) — or click ✨ Generate with AI"
            rows={3} disabled={loading} />
        </div>

        <div className="form-group">
          <label htmlFor="image_url">Image URL <small>(optional)</small></label>
          <input type="url" id="image_url" name="image_url"
            value={formData.image_url} onChange={handleChange}
            placeholder="https://… (link to a photo of your crop)"
            disabled={loading} />
          {formData.image_url && /^https?:\/\/.+/i.test(formData.image_url) && (
            <div className="image-preview">
              <img src={formData.image_url} alt="Crop preview"
                onError={e => { e.target.style.display = 'none'; }} />
            </div>
          )}
        </div>

        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? 'Adding Crop...' : 'Add Crop'}
        </button>

      </form>
    </div>
  );
};

AddCropForm.propTypes = {
  onAddCrop: PropTypes.func.isRequired,
};

export default AddCropForm;