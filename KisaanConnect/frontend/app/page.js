import Hero from '../components/Hero';
import StatsBar from '../components/StatsBar';
import PriceTicker from '../components/PriceTicker';
import HowItWorks from '../components/HowItWorks';
import PricePredictorTeaser from '../components/PricePredictorTeaser';
import ProductSection from '../components/ProductSection';
import Testimonials from '../components/Testimonials';

export const metadata = {
  title: 'KisaanConnect - Fresh Produce Direct from Farmers',
  description: 'Buy fresh produce directly from farmers, no middlemen, fair prices. Join KisaanConnect today.',
};

const FALLBACK_PRODUCTS = [
  { id: 1, name: 'Strawberry', price: 170, unit: 'kg', image: '/images/strawberry.jpg' },
  { id: 2, name: 'Radish', price: 75, unit: 'kg', image: '/images/radish.jpg' },
  { id: 3, name: 'Apple', price: 125, unit: 'kg', image: '/images/apple.jpg' },
  { id: 4, name: 'Carrot', price: 90, unit: 'kg', image: '/images/carrot.jpg' },
];

export default function HomePage() {
  return (
    <div>
      <Hero />
      <StatsBar />
      <PriceTicker />
      <HowItWorks />
      <PricePredictorTeaser />
      <ProductSection products={FALLBACK_PRODUCTS} />
      <Testimonials />
    </div>
  );
}