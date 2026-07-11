import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import '../../styles/farmer/ManageListings.css';

const FALLBACK_IMAGE = '/images/placeholder-crop.png';
const UNITS = ['kg', 'g', 'quintal', 'ton', 'piece', 'dozen'];

const INITIAL_EDIT = {
  id: null, name: '', quantity: '', unit: 'kg',
  price_per_unit: '', location: '', description: '', image: ''
};

const ManageListings = ({ crops = [], onEditCrop, onDeleteCrop }) => {
  const [editingId,    setEditingId]    = useState(null);
  const [editForm,     setEditForm]     = useState(INITIAL_EDIT);
  const [editError,    setEditError]    = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // cropId to confirm

  // --------------------------------------------------
  // EDIT HANDLERS
  // --------------------------------------------------
  const handleEditClick = useCallback((crop) => {
    setEditingId(crop.id);
    setEditForm({
      id:             crop.id,
      name:           crop.name          || '',
      quantity:       crop.quantity      || '',
      unit:           crop.unit          || 'kg',
      price_per_unit: crop.price_per_unit ?? crop.price ?? '',
      location:       crop.location      || '',
      description:    crop.description   || '',
      image:          crop.image         || '',
    });
    setEditError('');
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditError('');
  }, []);

  const handleEditChange = useCallback((e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
    if (editError) setEditError('');
  }, [editError]);

  const handleEditSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!editForm.name.trim())                return setEditError('Crop name is required');
    if (Number(editForm.quantity) <= 0)       return setEditError('Quantity must be greater than 0');
    if (Number(editForm.price_per_unit) <= 0) return setEditError('Price must be greater than 0');
    if (!editForm.location.trim())            return setEditError('Location is required');

    try {
      await onEditCrop({
        ...editForm,
        quantity:       Number(editForm.quantity),
        price_per_unit: Number(editForm.price_per_unit),
      });
      setEditingId(null);
    } catch {
      setEditError('Failed to update crop. Please try again.');
    }
  }, [editForm, onEditCrop]);

  // --------------------------------------------------
  // DELETE HANDLERS
  // --------------------------------------------------
  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmDelete) return;
    try {
      await onDeleteCrop(confirmDelete);
    } catch {
      // error handled in parent
    } finally {
      setConfirmDelete(null);
    }
  }, [confirmDelete, onDeleteCrop]);

  return (
    <div className="manage-listings">
      <h2>Manage Your Crop Listings</h2>

      {/* Inline delete confirmation */}
      {confirmDelete && (
        <div className="confirm-dialog" role="alertdialog">
          <p>Are you sure you want to delete this crop?</p>
          <button className="delete-button"  onClick={handleDeleteConfirm}>Yes, Delete</button>
          <button className="cancel-button"  onClick={() => setConfirmDelete(null)}>Cancel</button>
        </div>
      )}

      {crops.length === 0 ? (
        <p className="no-crops-message">You haven't added any crops yet.</p>
      ) : (
        <div className="crop-list">
          {crops.map(crop => (
            <div key={crop.id} className="crop-item">

              {editingId === crop.id ? (
                /* ── EDIT FORM ── */
                <form className="edit-form" onSubmit={handleEditSubmit} noValidate>
                  {editError && <p className="form-error" role="alert">{editError}</p>}

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor={`name-${crop.id}`}>Crop Name *</label>
                      <input type="text" id={`name-${crop.id}`} name="name"
                        value={editForm.name} onChange={handleEditChange} required />
                    </div>

                    <div className="form-group">
                      <label htmlFor={`qty-${crop.id}`}>Quantity *</label>
                      <input type="number" id={`qty-${crop.id}`} name="quantity"
                        value={editForm.quantity} onChange={handleEditChange} min="1" required />
                    </div>

                    <div className="form-group">
                      <label htmlFor={`unit-${crop.id}`}>Unit</label>
                      <select id={`unit-${crop.id}`} name="unit"
                        value={editForm.unit} onChange={handleEditChange}>
                        {UNITS.map(u => (
                          <option key={u} value={u}>
                            {u.charAt(0).toUpperCase() + u.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor={`price-${crop.id}`}>Price (₹ per {editForm.unit}) *</label>
                      <input type="number" id={`price-${crop.id}`} name="price_per_unit"
                        value={editForm.price_per_unit} onChange={handleEditChange} min="1" required />
                    </div>

                    <div className="form-group">
                      <label htmlFor={`loc-${crop.id}`}>Location *</label>
                      <input type="text" id={`loc-${crop.id}`} name="location"
                        value={editForm.location} onChange={handleEditChange} required />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor={`desc-${crop.id}`}>Description</label>
                    <textarea id={`desc-${crop.id}`} name="description"
                      value={editForm.description} onChange={handleEditChange}
                      rows={3} placeholder="Describe your crop (optional)" />
                  </div>

                  <div className="edit-form-buttons">
                    <button type="submit"  className="save-button">Save</button>
                    <button type="button"  className="cancel-button" onClick={handleCancelEdit}>Cancel</button>
                  </div>
                </form>

              ) : (
                /* ── DISPLAY VIEW ── */
                <>
                  <div className="crop-image">
                    <img
                      src={crop.image || FALLBACK_IMAGE}
                      alt={crop.name}
                      onError={e => { e.target.src = FALLBACK_IMAGE; }}
                    />
                  </div>

                  <div className="crop-details">
                    <h3>{crop.name}</h3>
                    <p><strong>Quantity:</strong> {crop.quantity} {crop.unit}</p>
                    <p><strong>Price:</strong> ₹{crop.price_per_unit ?? crop.price} per {crop.unit}</p>
                    <p><strong>Location:</strong> 📍 {crop.location}</p>
                    {crop.description && (
                      <p className="crop-description"><strong>Description:</strong> {crop.description}</p>
                    )}
                  </div>

                  <div className="crop-actions">
                    <button className="edit-button"
                      onClick={() => handleEditClick(crop)}>Edit</button>
                    <button className="delete-button"
                      onClick={() => setConfirmDelete(crop.id)}>Delete</button>
                  </div>
                </>
              )}

            </div>
          ))}
        </div>
      )}
    </div>
  );
};

ManageListings.propTypes = {
  crops:        PropTypes.array.isRequired,
  onEditCrop:   PropTypes.func.isRequired,
  onDeleteCrop: PropTypes.func.isRequired,
};

export default ManageListings;