import ZillowScraperWidget from '@/components/ZillowScraperWidget';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Zillow Property Scraper | True Soul CRM',
  description: 'Run and manage the Zillow property scraper tool',
};

export default function ScraperPage() {
  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <ZillowScraperWidget />
        </div>
      </div>
    </div>
  );
}
