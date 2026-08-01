import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { PwaProvider } from '@/components/pwa/PwaProvider';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0284c7',
};

export const metadata: Metadata = {
  title: 'MyEduRide | The Student Safety Platform',
  description: 'Connect parents, schools, drivers and communities to ensure every child travels safely to and from school.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MyEduRide',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <PwaProvider>
          {children}
        </PwaProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}

