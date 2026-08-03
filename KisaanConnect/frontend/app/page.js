import Hero from '../components/Hero';
import StatsBar from '../components/StatsBar';
import PriceTicker from '../components/PriceTicker';
import HowItWorks from '../components/HowItWorks';
import SeasonalCalendar from '../components/SeasonalCalendar';
import FarmersStrip from '../components/FarmersStrip';
import CoverageArea from '../components/CoverageArea';
import PricePredictorTeaser from '../components/PricePredictorTeaser';
import TrustStrip from '../components/TrustStrip';
import ProductSection from '../components/ProductSection';
import FaqAccordion from '../components/FaqAccordion';
import NewsletterSignup from '../components/NewsletterSignup';
import Testimonials from '../components/Testimonials';
import Reveal from '../components/Reveal';

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
      <Reveal><HowItWorks /></Reveal>
      <Reveal><SeasonalCalendar /></Reveal>
      <Reveal><FarmersStrip /></Reveal>
      <Reveal><CoverageArea /></Reveal>
      <Reveal><PricePredictorTeaser /></Reveal>
      <Reveal><TrustStrip /></Reveal>
      <Reveal><ProductSection products={FALLBACK_PRODUCTS} /></Reveal>
      <Reveal><FaqAccordion /></Reveal>
      <Reveal><NewsletterSignup /></Reveal>
      <Reveal><Testimonials /></Reveal>
    </div>
  );
}