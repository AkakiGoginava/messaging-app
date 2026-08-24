import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { AppProviders } from '@/components/providers';

import './globals.css';

// Inter is the typeface the approved auth frames are drawn in.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Messaging App',
  description: 'Stage 1 messaging application.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="bg-app-bg text-fg flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
