"use client";

import { useState, useEffect } from 'react';
import { Button, Input, Progress, ScrollShadow } from '@heroui/react';
import { Icon } from '@iconify/react';
import { runZillowScraper } from '../actions/zillowScraper';

interface ZillowScraperWidgetProps {
  className?: string;
}

export default function ZillowScraperWidget({ className }: ZillowScraperWidgetProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [zillowUrl, setZillowUrl] = useState<string>('');
  const [userAgent, setUserAgent] = useState<string>('');
  const [isInProgress, setIsInProgress] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  // Get the current user agent on component load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUserAgent(window.navigator.userAgent);
    }
  }, []);

  const captureUserAgent = () => {
    if (typeof window !== 'undefined') {
      setUserAgent(window.navigator.userAgent);
      setMessage('User agent captured successfully');
      setStatus('success');
      
      // Reset message after 3 seconds
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 3000);
    }
  };

  const runScraper = async () => {
    try {
      if (!zillowUrl) {
        setStatus('error');
        setMessage('Please enter a Zillow search URL');
        return;
      }

      setStatus('loading');
      setMessage('Starting Zillow property scraper...');
      setIsInProgress(true);

      // Call the server action instead of fetch
      const result = await runZillowScraper(zillowUrl, userAgent);

      if (result.success) {
        setStatus('success');
        setMessage(result.message || 'Scraper started successfully. Processing in the background.');
        setLastRun(new Date());
        
        // Reset to idle after showing success for a few seconds
        setTimeout(() => {
          setStatus('idle');
        }, 5000);
      } else {
        throw new Error(result.error || 'Failed to start scraper');
      }
    } catch (error) {
      console.error('Error running scraper:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
      setIsInProgress(false);
    }
  };

  return (
    <div className={`flex flex-col gap-4 p-2 ${className}`}>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">
          Zillow Search URL
          <Input 
            value={zillowUrl}
            onChange={(e) => setZillowUrl(e.target.value)}
            placeholder="https://www.zillow.com/fort-worth-tx/..."
            variant="bordered"
            size="sm"
            className="mt-1"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">
          User Agent
          <div className="flex gap-2 mt-1">
            <Input 
              value={userAgent}
              onChange={(e) => setUserAgent(e.target.value)}
              variant="bordered"
              size="sm"
              className="flex-1"
              disabled
            />
            <Button 
              size="sm" 
              color="primary" 
              variant="flat"
              onClick={captureUserAgent}
            >
              <Icon icon="ph:camera" width="20" />
            </Button>
          </div>
        </label>
      </div>
      
      {status === 'loading' && (
        <div className="my-2">
          <Progress
            size="sm"
            isIndeterminate
            aria-label="Loading..."
            color="primary"
            className="my-2"
          />
          <p className="text-sm text-blue-600">{message}</p>
        </div>
      )}
      
      {status === 'success' && (
        <div className="my-2">
          <p className="text-sm text-green-600">{message}</p>
        </div>
      )}
      
      {status === 'error' && (
        <div className="my-2">
          <p className="text-sm text-red-600">{message}</p>
        </div>
      )}
      
      <div className="mt-2 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500">Last Run:</span> 
          <span>{lastRun ? lastRun.toLocaleString() : 'Never'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Status:</span>
          <span className={isInProgress ? 'text-amber-600' : 'text-green-600'}>
            {isInProgress ? 'In Progress' : 'Ready'}
          </span>
        </div>
      </div>
      
      <Button 
        onClick={runScraper} 
        disabled={status === 'loading' || isInProgress}
        color="primary"
        className="mt-2"
      >
        {status === 'loading' ? (
          <>
            <Icon icon="svg-spinners:180-ring" className="mr-2" />
            Running...
          </>
        ) : (
          <>
            <Icon icon="material-symbols:home-search-outline" className="mr-2" width="20" />
            Start Zillow Scraper
          </>
        )}
      </Button>
    </div>
  );
}
