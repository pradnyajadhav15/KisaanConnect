'use client';
import { useState, useMemo, useCallback, useRef } from 'react';
import './BrowseProducts.css';

const FALLBACK_IMAGE = '/images/placeholder-crop.png';
const INITIAL_FILTERS = { minPrice: '', maxPrice: '', location: '' };

const getPrice = (p) => Number(p.price_per_unit != null ? p.price_per_unit : (p.price || 0));
const getImage = (p) => p.image_url || p.image || FALLBACK_IMAGE;
const getFarmer = (p) => p.farmerName || p.farmer_name || null;

export default function BrowseProducts({ products, onViewProduct, onAddToCart }) {
  const list = products || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [displaySearch, setDisplaySearch] = useState('');
  const debounceRef = useRef(null);

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
                  <div className="product-image-container">
                    <img
                      src={getImage(product)}
                      alt={product.name}
                      className="product-image"
                      onError={(e) => { e.target.src = FALLBACK_IMAGE; }}
                    />
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
