import './globals.css';
import './globals-legacy.css';
import Navbar from '../components/Navbar';
import Script from 'next/script';

export const metadata = {
  title: 'KisaanConnect - Farmer to Consumer Marketplace',
  description: 'Buy fresh produce directly from farmers, no middlemen. KisaanConnect connects farmers and consumers directly.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><Navbar />{children}<Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" /></body>
    </html>
  );
}




