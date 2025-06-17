import ZillowScraperWidget from '@/components/ZillowScraperWidget';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Zillow Property Scraper | TrueSoul Bento CRM',
  description: 'Run and manage the Zillow property scraper tool',
};

export default function ScraperPage() {
  return (
    <div className="container mx-auto py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Property Scraper</h1>
        <p className="text-muted-foreground mt-2">
          Use this tool to capture property details from your saved Zillow search.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <ZillowScraperWidget />
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <h3 className="font-medium text-lg mb-2">How it works</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Configure your Zillow search URL in the <code className="bg-gray-100 p-1 rounded">.env.local</code> file</li>
              <li>Set <code className="bg-gray-100 p-1 rounded">EXPORT_COOKIES=true</code> and run once to save your session</li>
              <li>Set <code className="bg-gray-100 p-1 rounded">EXPORT_COOKIES=false</code> for automated runs</li>
              <li>Click "Start Zillow Scraper" to begin the scraping process</li>
              <li>The script will run in the background and capture all properties from your search</li>
              <li>Screenshots will be saved to <code className="bg-gray-100 p-1 rounded">public/scraped</code> folder</li>
            </ol>
          </div>
          
          <div className="rounded-lg border p-4">
            <h3 className="font-medium text-lg mb-2">Scraped Files</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Screenshots are named after property addresses and saved in the public folder.
              You can view them here once they're generated.
            </p>
            
            {/* This would be replaced with actual scraped files listing */}
            <div className="text-sm text-gray-500 italic">
              No scraped files found. Run the scraper to generate property screenshots.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
