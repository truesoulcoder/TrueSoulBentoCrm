import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Zillow Scraper | TrueSoulBento CRM',
  description: 'Property data scraper for Zillow listings',
};

export default function ScraperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="scraper-layout">
      {children}
    </div>
  );
}
