// src/components/campaign-console.tsx
"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { Button, ScrollShadow } from "@heroui/react";
import useSWR from 'swr';
import type { Database, Json } from '@/types/supabase';

type SystemEventLog = Database['public']['Tables']['system_event_logs']['Row'];

interface CampaignConsoleProps {
  isRunning: boolean;
  isPaused: boolean;
}

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    return res.text().then(text => { throw new Error(text || res.statusText); });
  }
  return res.json();
});

export const CampaignConsole: React.FC<CampaignConsoleProps> = ({ isRunning, isPaused }) => {
  const { data: logs, error, isLoading, mutate } = useSWR<SystemEventLog[]>('/api/system-logs?limit=200', fetcher, {
    refreshInterval: 3000,
    revalidateOnFocus: true,
    onError: (err) => console.error("Error fetching system logs:", err),
  });

  const getIconForType = (logEntry: SystemEventLog) => {
    const levelFromDetails = (logEntry.details as any)?.level;
    const typeToUse = levelFromDetails || logEntry.event_type;

    switch (typeToUse) {
      case "INFO":
      case "LEAD_UPLOAD_JOB_INIT":
      case "LEAD_UPLOAD_FILE_RECEIVED":
      case "LEAD_UPLOAD_STAGING_COMPLETE":
      case "LEAD_UPLOAD_DB_IMPORT_COMPLETE":
      case "ZILLOW_WORKER_POLL":
      case "ZILLOW_WORKER_SCRAPER_RUN":
      case "ZILLOW_WORKER_SCRIPT_ENHANCEMENT":
      case "ZILLOW_WORKER_SCRIPT_BACKUP":
      case "ZILLOW_WORKER_SCRIPT_ENHANCED":
      case "ZILLOW_WORKER_START":
      case "CAMPAIGN_JOB_START":
      case "CAMPAIGN_JOB_FETCHING_SENDER":
      case "CAMPAIGN_JOB_SENDER_ASSIGNED":
      case "CAMPAIGN_JOB_PDF_GENERATION_START":
      case "CAMPAIGN_JOB_EMAIL_SEND_START":
        return <Icon icon="lucide:info" className="text-blue-500" />;
      case "SUCCESS":
      case "LEAD_UPLOAD_SUCCESS":
      case "CAMPAIGN_JOB_COMPLETED":
      case "ZILLOW_WORKER_JOB_COMPLETED":
        return <Icon icon="lucide:check-circle" className="text-green-500" />;
      case "WARN":
      case "LEAD_UPLOAD_DUPLICATE_FILE":
      case "ZILLOW_WORKER_SCRAPER_WARNING":
      case "ZILLOW_WORKER_CLEANUP_ERROR":
      case "ZILLOW_WORKER_SCRIPT_ENHANCEMENT_FAILED":
      case "CAMPAIGN_JOB_NO_SENDER_AVAILABLE":
        return <Icon icon="lucide:alert-triangle" className="text-orange-500" />;
      case "ERROR":
      case "LEAD_UPLOAD_FAILURE":
      case "UPLOAD_AUTH_ERROR":
      case "UPLOAD_VALIDATION_ERROR":
      case "LEADS_API_RPC_ERROR":
      case "LEADS_API_AUTH_ERROR":
      case "LEADS_API_CACHE_READ_ERROR":
      case "LEADS_API_CACHE_WRITE_ERROR":
      case "LEADS_API_UNEXPECTED_ERROR":
      case "PROCESS_JOB_AUTH_ERROR":
      case "PROCESS_JOB_VALIDATION_ERROR":
      case "CAMPAIGN_JOB_DB_FETCH_ERROR":
      case "CAMPAIGN_JOB_NOT_FOUND":
      case "CAMPAIGN_JOB_MISSING_LEAD_DATA":
      case "CAMPAIGN_JOB_MISSING_STEPS":
      case "CAMPAIGN_JOB_SENDER_FETCH_ERROR":
      case "CAMPAIGN_JOB_PDF_GENERATION_FAILED":
      case "CAMPAIGN_JOB_EMAIL_SEND_FAILED":
      case "CAMPAIGN_JOB_FAILED":
      case "PROCESS_JOB_UNKNOWN_FAILURE":
      case "ZILLOW_WORKER_DB_ERROR":
      case "ZILLOW_WORKER_SCRAPER_FAILED":
      case "ZILLOW_WORKER_JOB_FAILED":
      case "ZILLOW_WORKER_UNEXPECTED_ERROR":
      case "WORKER_LOG_RECEIVE_ERROR":
        return <Icon icon="lucide:x-circle" className="text-red-500" />;
      case "DEBUG":
      case "ZILLOW_WORKER_NO_JOBS":
      case "ZILLOW_WORKER_SCRAPER_OUTPUT":
      case "ZILLOW_WORKER_SCRIPT_ALREADY_ENHANCED":
      case "ZILLOW_SCRAPER_SCREENSHOT_ATTEMPT":
      case "ZILLOW_SCRAPER_SCREENSHOT_SUCCESS":
        return <Icon icon="lucide:bug" className="text-gray-500" />;
      default:
        return <Icon icon="lucide:circle" className="text-default-500" />;
    }
  };

  const clearLogs = async () => {
    mutate([], { revalidate: false });
  };

  const statusColor = isRunning ? (isPaused ? "bg-warning-500" : "bg-success-500") : "bg-default-300";
  const statusText = isRunning ? (isPaused ? "Paused" : "Running") : "Stopped";

  const displayLogs = Array.isArray(logs) ? [...logs].slice(-20).reverse() : [];

  if (isLoading && displayLogs.length === 0) {
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

      <ScrollShadow className="h-full rounded-medium bg-content2 p-3 font-mono text-xs">
        {displayLogs.length === 0 ? (
          <div className="text-default-400">No recent activity.</div>
        ) : (
          displayLogs.map((log) => (
            <div key={log.id} className="mb-1 flex items-start gap-2">
              <span className="text-default-400">[{new Date(log.created_at).toLocaleTimeString()}]</span>
              <span className="mt-0.5 flex-shrink-0">{getIconForType(log)}</span>
              <span>{log.message}</span>
            </div>
          ))
        )}
      </ScrollShadow>
    </div>
  );
};