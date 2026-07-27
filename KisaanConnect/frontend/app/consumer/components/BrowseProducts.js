'use client';
import { useState, useMemo, useCallback, useRef } from 'react';
import './BrowseProducts.css';
import { useEffect } from 'react';
import { getWishlistIds, addToWishlist, removeFromWishlist } from '../../../lib/wishlistApi';

const FALLBACK_IMAGE = '/images/placeholder-crop.svg';
const INITIAL_FILTERS = { minPrice: '', maxPrice: '', location: '' };

const getPrice = (p) => Number(p.price_per_unit != null ? p.price_per_unit : (p.price || 0));
const getImage = (p) => p.image_url || p.image || FALLBACK_IMAGE;
const getFarmer = (p) => p.farmerName || p.farmer_name || null;

export default function BrowseProducts({ products, onViewProduct, onAddToCart }) {
  const list = products || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [displaySearch, setDisplaySearch] = useState('');
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const debounceRef = useRef(null);
  useEffect(() => {
    getWishlistIds()
      .then((data) => setWishlistIds(new Set(data.crop_ids || [])))
      .catch(() => {});
  }, []);

  const toggleWishlist = async (cropId) => {
    const isSaved = wishlistIds.has(cropId);
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(cropId); else next.add(cropId);
      return next;
    });
    try {
      if (isSaved) await removeFromWishlist(cropId); else await addToWishlist(cropId);
    } catch {
      setWishlistIds((prev) => {
        const revert = new Set(prev);
        if (isSaved) revert.add(cropId); else revert.delete(cropId);
        return revert;
      });
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setDisplaySearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchTerm(val), 300);
  };

  const handleFilterChange = useCallback((e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setDisplaySearch('');
    setSearchTerm('');
    setFilters(INITIAL_FILTERS);
  }, []);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const min = filters.minPrice === '' ? null : Number(filters.minPrice);
    const max = filters.maxPrice === '' ? null : Number(filters.maxPrice);
    const loc = filters.location.toLowerCase();

    return list.filter((p) => {
      const price = getPrice(p);
      const matchesSearch =
        (p.name || '').toLowerCase().includes(term) ||
        (getFarmer(p) || '').toLowerCase().includes(term) ||
        (p.location || '').toLowerCase().includes(term);

      const matchesMin = min === null || price >= min;
      const matchesMax = max === null || price <= max;
      const matchesLoc = !loc || (p.location || '').toLowerCase().includes(loc);

      return matchesSearch && matchesMin && matchesMax && matchesLoc;
    });
  }, [list, searchTerm, filters]);

  return (
    <div className="browse-products">
      <div className="search-filter-container">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search products, farmers, or locations..."
            value={displaySearch}
            onChange={handleSearchChange}
            className="search-input"
            aria-label="Search products"
          />
        </div>

        <div className="filters-container">
          <h3>Filters</h3>

          {[
            { id: 'minPrice', label: 'Min Price (Rs.)', placeholder: 'Min' },
            { id: 'maxPrice', label: 'Max Price (Rs.)', placeholder: 'Max' },
          ].map(({ id, label, placeholder }) => (
            <div className="filter-group" key={id}>
              <label htmlFor={id}>{label}</label>
              <input
                type="number" id={id} name={id}
                value={filters[id]} onChange={handleFilterChange}
                placeholder={placeholder} min="0"
              />
            </div>
          ))}

          <div className="filter-group">
            <label htmlFor="location">Location</label>
            <input
              type="text" id="location" name="location"
              value={filters.location} onChange={handleFilterChange}
              placeholder="Enter location"
            />
          </div>

          <button className="clear-filters-button" onClick={handleClearFilters}>
            Clear Filters
          </button>
        </div>
      </div>

      <div className="products-container">
        <h2>
          Available Products
          <span className="product-count">{' (' + filteredProducts.length + ')'}</span>
        </h2>

        {filteredProducts.length === 0 ? (
          <p className="no-products-message">No products found matching your criteria.</p>
        ) : (
          <div className="products-grid">
            {filteredProducts.map((product) => {
              const price = getPrice(product);
              const farmer = getFarmer(product);
              return (
                <div key={product.id} className="product-card">
                  <div className="product-image-container" style={{ position: "relative" }}>
                    <img
                      src={getImage(product)}
                      alt={product.name}
                      className="product-image"
                      onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
                    />
                    <button
                      onClick={() => toggleWishlist(product.id)}
                      aria-label={wishlistIds.has(product.id) ? "Remove from wishlist" : "Save for later"}
                      style={{ position: "absolute", top: 8, right: 8, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: wishlistIds.has(product.id) ? "#c1622d" : "#999" }}
                    >
                      {wishlistIds.has(product.id) ? "\u2665" : "\u2661"}
                    </button>
                  </div>

                  <div className="product-info">
                    <h3 className="product-name">{product.name}</h3>
                    <p className="product-price">{'Rs. ' + price + ' per ' + product.unit}</p>
                    <p className="product-quantity">{'Available: ' + product.quantity + ' ' + product.unit}</p>
                    {farmer && <p className="product-farmer">{'Farmer: ' + farmer}</p>}
                    {product.location && <p className="product-location">{product.location}</p>}

                    <div className="product-actions">
                      <button className="view-details-button" onClick={() => onViewProduct(product)}>
                        View Details
                      </button>
                      <button
                        className="add-to-cart-button"
                        onClick={() => onAddToCart(product)}
                        disabled={product.quantity <= 0}
                      >
                        {product.quantity > 0 ? 'Add to Cart' : 'Out of Stock'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
