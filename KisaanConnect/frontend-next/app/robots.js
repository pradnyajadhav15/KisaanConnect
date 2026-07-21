export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/farmer', '/consumer', '/admin'],
    },
    sitemap: 'https://kisaanconnect.example.com/sitemap.xml',
  };
}
