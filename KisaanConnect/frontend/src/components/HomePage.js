import React, { useState, useEffect } from 'react';
import '../styles/HomePage.css';
import Hero from './Hero';
import ProductSection from './ProductSection';

import strawberryImg from '../assets/images/strawberry.jpg';
import radishImg      from '../assets/images/radish.jpg';
import appleImg       from '../assets/images/apple.jpg';
import carrotImg      from '../assets/images/carrot.jpg';

const FALLBACK_PRODUCTS = [
  { id: 1, name: 'Strawberry', price: 170, unit: 'kg', image: strawberryImg },
  { id: 2, name: 'Radish',     price:  75, unit: 'kg', image: radishImg     },
  { id: 3, name: 'Apple',      price: 125, unit: 'kg', image: appleImg      },
  { id: 4, name: 'Carrot',     price:  90, unit: 'kg', image: carrotImg     },
];

const HomePage = () => {
  const [products, setProducts] = useState(FALLBACK_PRODUCTS);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // Replace with real API when ready:
        // const data = await consumerApi.getMarketplace();
        // setProducts(data?.slice(0, 4) || FALLBACK_PRODUCTS);
        setProducts(FALLBACK_PRODUCTS);
      } catch {
        setProducts(FALLBACK_PRODUCTS);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  return (
    <div className="home-page">
      <Hero />
      {!loading && <ProductSection products={products} />}
    </div>
  );
};

export default HomePage;