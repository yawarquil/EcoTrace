import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'EcoTrace - Personal Carbon Footprint Tracker',
  description:
    'Track personal carbon impact, build habits, and get AI-assisted climate coaching.',
  applicationName: 'EcoTrace',
  keywords: [
    'carbon footprint tracker',
    'climate tech',
    'sustainability',
    'Gemini AI',
    'habit tracker',
  ],
  openGraph: {
    title: 'EcoTrace - Personal Carbon Footprint Tracker',
    description:
      'A climate-tech dashboard for carbon logging, insights, goals, rewards, maps, and AI coaching.',
    siteName: 'EcoTrace',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EcoTrace - Personal Carbon Footprint Tracker',
    description:
      'Carbon logging, insights, goals, rewards, maps, and AI-assisted climate coaching.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#081814',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
