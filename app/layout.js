import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata = {
  title: 'WealthOffice — Escritório de Ativos Alternativos',
  description: 'Controle profissional de precatórios, imóveis, private equity e crédito estruturado. Plataforma segura para investidores qualificados.',
  keywords: 'precatórios, imóveis, private equity, ativos alternativos, wealth office, investimentos',
  authors: [{ name: 'WealthOffice' }],
  openGraph: {
    title: 'WealthOffice — Escritório de Ativos Alternativos',
    description: 'Gerencie precatórios, imóveis e ativos alternativos em um único lugar seguro.',
    url: 'https://wealthoffice.com.br',
    siteName: 'WealthOffice',
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WealthOffice — Escritório de Ativos Alternativos',
    description: 'Gerencie precatórios, imóveis e ativos alternativos em um único lugar seguro.',
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#08090C',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
