import './globals.css';
import './globals-legacy.css';
import Navbar from '../components/Navbar';
import Script from 'next/script';
import { Fraunces, Plus_Jakarta_Sans, Noto_Sans_Devanagari } from 'next/font/google';

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const body = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const devanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-deva',
  display: 'swap',
});

export const metadata = {
  title: 'KisaanConnect - Farmer to Consumer Marketplace',
  description: 'Buy fresh produce directly from farmers, no middlemen. KisaanConnect connects farmers and consumers directly.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${devanagari.variable}`}>
      <body>
        <Navbar />
        {children}
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}