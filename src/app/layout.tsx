import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bolívar App | Control Financiero y Multidivisa VES',
  description: 'Control de finanzas personales para Venezuela con soporte nativo de Bolívares (VES), Dólares, Binance USDT, presupuestos y metas de ahorro.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className="dark" lang="es">
      <head>
        <meta name="shell-type" content="web_dashboard" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#090a0d] font-sans text-[#ededf0] antialiased min-h-screen selection:bg-neutral-800 selection:text-white">
        {children}
      </body>
    </html>
  );
}

