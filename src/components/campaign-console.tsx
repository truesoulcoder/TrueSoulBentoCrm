// src/components/campaign-console.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { Button, ScrollShadow } from "@heroui/react";
import useSWR from 'swr'; // Import useSWR for data fetching
import type { Database } from '@/types/supabase'; // Import Database types

type SystemEventLog = Database['public']['Tables']['system_event_logs']['Row'];

interface CampaignConsoleProps {
  isRunning: boolean;
  isPaused: boolean;
}

// Re-usable fetcher function for useSWR
const fetcher = (url: string) => fetch(url).then(res => res.json());

export const CampaignConsole: React.FC<CampaignConsoleProps> = ({ isRunning, isPaused }) => {
  // Fetch logs from the new API endpoint
  const { data: logs, error, isLoading, mutate } = useSWR<SystemEventLog[]>('/api/system-logs?limit=200', fetcher, {
    refreshInterval: 3000, // Refresh logs every 3 seconds
    revalidateOnFocus: true,
    onError: (err) => console.error("Error fetching system logs:", err),
  });

  // Ref for the scrollable container
  const scrollRef = useRef<HTMLDivElement>(null);
  // Ref to keep track of whether the user has manually scrolled up
  const isScrolledUp = useRef(false);

  // Function to scroll to the bottom of the console
  const scrollToBottom = () => {
    if (scrollRef.current && !isScrolledUp.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // Effect to scroll to bottom whenever logs change, unless user has scrolled up
  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  // Handle manual scrolling by the user
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      // If user is near the bottom (within 100px), disable manual scroll tracking
      // Otherwise, assume they've scrolled up and enable it
      isScrolledUp.current = scrollHeight - scrollTop > clientHeight + 100;
    }
  };

  // Attach scroll event listener
  useEffect(() => {
    const currentScrollRef = scrollRef.current;
    if (currentScrollRef) {
      currentScrollRef.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (currentScrollRef) {
        currentScrollRef.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const getIconForType = (type: string | null | undefined) => {
    switch (type) {
      case "INFO":
        return <Icon icon="lucide:info" className="text-blue-500" />;
      case "SUCCESS":
      case "CAMPAIGN_JOB_COMPLETED": // Specific success event from process-job
        return <Icon icon="lucide:check-circle" className="text-green-500" />;
      case "WARN":
        return <Icon icon="lucide:alert-triangle" className="text-orange-500" />;
      case "ERROR":
      case "LEAD_UPLOAD_FAILURE": // Specific error event from upload
      case "CAMPAIGN_JOB_FAILED": // Specific error event from process-job
      case "ZILLOW_WORKER_SCRAPER_FAILED": // Specific error from scraper worker
        return <Icon icon="lucide:x-circle" className="text-red-500" />;
      case "DEBUG":
        return <Icon icon="lucide:bug" className="text-gray-500" />;
      default:
        return <Icon icon="lucide:circle" className="text-default-500" />;
    }
  };

  const clearLogs = async () => {
    // For a real system, you might want an API endpoint to clear logs.
    // For now, we'll just revalidate SWR cache, which will fetch fresh data (effectively clearing if no new logs).
    // Or you could implement a "soft clear" by hiding old logs in UI state.
    mutate([], { revalidate: true }); // Clear local SWR cache and re-fetch from server
    // For a visual "clear", we could temporarily set logs to an empty array
    // setLogs([{ id: 0, created_at: new Date().toISOString(), message: "Console cleared", event_type: "INFO", level: "INFO" }]);
  };

  const statusColor = isRunning ? (isPaused ? "bg-warning-500" : "bg-success-500") : "bg-default-300";
  const statusText = isRunning ? (isPaused ? "Paused" : "Running") : "Stopped";

  if (isLoading && !logs) {
    return (
      <div className="flex h-full items-center justify-center rounded-medium bg-content2">
        <p className="text-default-500">Loading logs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-medium bg-content2">
        <p className="text-danger-500">Error loading logs: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex h-[240px] flex-col">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${statusColor}`} />
          <span className="text-small">{statusText}</span>
        </div>
        <Button size="sm" variant="flat" onPress={clearLogs}>
          Clear
        </Button>
      </div>

      <ScrollShadow ref={scrollRef} className="h-full rounded-medium bg-content2 p-3 font-mono text-xs">
        {(logs || []).length === 0 ? (
          <div className="text-default-400">No recent activity.</div>
        ) : (
          (logs || []).map((log) => (
            <div key={log.id} className="mb-1 flex items-start gap-2">
              <span className="text-default-400">[{new Date(log.created_at).toLocaleTimeString()}]</span>
              <span className="mt-0.5 flex-shrink-0">{getIconForType(log.level)}</span>
              <span>{log.message}</span>
            </div>
          ))
        )}
      </ScrollShadow>
    </div>
  );
};