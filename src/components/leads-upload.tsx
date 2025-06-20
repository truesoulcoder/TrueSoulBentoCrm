// src/components/leads-upload.tsx
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button, Spinner } from "@heroui/react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import toast from "react-hot-toast";

interface LeadsUploadProps {
  onUploadComplete?: () => void;
}

interface JobState {
  file: File | null;
  status: string;
  progress: number;
  message: string;
}

const initialJobState: JobState = {
  file: null,
  status: 'IDLE',
  progress: 0,
  message: '',
};

export function LeadsUpload({ onUploadComplete }: LeadsUploadProps) {
  const [jobState, setJobState] = useState<JobState>(initialJobState);
  const [marketRegion, setMarketRegion] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // Cleanup subscription on component unmount
    return () => {
      if (channelRef.current) {
        createClient().removeChannel(channelRef.current);
      }
    };
  }, []);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setJobState({ ...initialJobState, file: e.target.files[0], status: 'READY' });
      setUploadProgress(0);
    }
  }, []);

  const handleUpload = async () => {
    if (!jobState.file || !marketRegion) {
      setJobState(prevState => ({ ...prevState, message: 'Please select a file and enter a market region.', status: 'FAILED' }));
      return;
    }

    const supabase = createClient();
    setJobState(prevState => ({ ...prevState, status: 'UPLOADING', message: 'Requesting upload job...' }));

    try {
      // 1. Start the job, get a job ID from the backend
      const startResponse = await fetch('/api/leads/upload/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketRegion }),
      });

      if (!startResponse.ok) {
        const { error } = await startResponse.json();
        throw new Error(error || 'Failed to start upload.');
      }

      // Simulate upload and processing logic for this stub implementation
      setTimeout(() => {
        setJobState(prevState => ({
          ...prevState,
          status: 'COMPLETE',
          message: 'Upload and processing complete!',
        }));
        if (onUploadComplete) onUploadComplete();
      }, 2000);

    } catch (error: any) {
      console.error('Upload process error:', error);
      setJobState(prevState => ({ ...prevState, status: 'FAILED', message: error.message }));
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }
  };

  const handleReset = () => {
    setJobState(initialJobState);
    setMarketRegion('');
    setUploadProgress(0);
    if (channelRef.current) {
      createClient().removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  const isUploadingOrProcessing = jobState.status === 'UPLOADING' || jobState.status === 'PROCESSING';
  const isFinished = jobState.status === 'COMPLETE' || jobState.status === 'FAILED';

  return (
    <div className="flex flex-col gap-4 p-4">
      <label className="font-medium">Market Region</label>
      <input
        type="text"
        className="border rounded px-2 py-1"
        value={marketRegion}
        onChange={e => setMarketRegion(e.target.value)}
        placeholder="e.g., Dallas / Fort Worth"
        required
      />

      <label className="font-medium">CSV File</label>
      <input
        type="file"
        accept=".csv"
        onChange={onFileChange}
        disabled={isUploadingOrProcessing}
      />

      {jobState.message && (
        <div className={`text-sm ${jobState.status === 'FAILED' ? 'text-red-600' : 'text-gray-600'}`}>
          {jobState.message}
        </div>
      )}

      <Button
        color="primary"
        onClick={handleUpload}
        disabled={!jobState.file || !marketRegion || isUploadingOrProcessing}
      >
        {isUploadingOrProcessing ? <Spinner /> : "Upload and Process"}
      </Button>

      {isFinished && (
        <Button size="sm" variant="flat" className="mt-2" onClick={handleReset}>
          Upload Another File
        </Button>
      )}
    </div>
  );
}