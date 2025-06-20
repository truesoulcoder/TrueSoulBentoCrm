// src/components/leads-upload.tsx
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useDropzone } from 'react-dropzone';
import { Button } from '@heroui/react';
import { type RealtimeChannel } from '@supabase/supabase-js';
import { type Database } from '@/types/supabase';
import { Icon } from '@iconify/react';
import FloatingLabelInput from './ui/FloatingLabelInput';

// The status can be a client-side status or a DB status from the 'upload_job_status' enum
type JobStatus = Database['public']['Enums']['upload_job_status'] | 'IDLE' | 'READY' | 'UPLOADING';

interface JobState {
  file: File | null;
  status: JobStatus;
  progress: number; // This reflects backend processing progress
  message: string;
  jobId: string | null;
}

const initialJobState: JobState = {
  file: null,
  status: 'IDLE',
  progress: 0,
  message: '',
  jobId: null,
};

export function LeadsUpload() {
  const [jobState, setJobState] = useState<JobState>(initialJobState);
  const [marketRegion, setMarketRegion] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState(0); // For client-side upload tracking
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // Cleanup subscription on component unmount
    return () => {
      if (channelRef.current) {
        createClient().removeChannel(channelRef.current);
      }
    };
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setJobState({ ...initialJobState, file: acceptedFiles[0], status: 'READY' });
      setUploadProgress(0);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  });

  const handleReset = () => {
    setJobState(initialJobState);
    setMarketRegion('');
    setUploadProgress(0);
    if (channelRef.current) {
      createClient().removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

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
        body: JSON.stringify({ fileName: jobState.file.name }),
      });

      if (!startResponse.ok) {
        const { error } = await startResponse.json();
        throw new Error(error || 'Could not start upload job.');
      }

      const { jobId } = await startResponse.json();
      setJobState(prevState => ({ ...prevState, jobId }));

      // 2. Subscribe to real-time updates for this job
      channelRef.current = supabase.channel(`upload_job:${jobId}`);
      channelRef.current
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'upload_jobs', filter: `job_id=eq.${jobId}` },
          (payload) => {
            const { progress, status, message } = payload.new as Database['public']['Tables']['upload_jobs']['Row'];
            setJobState(prevState => ({
              ...prevState,
              status: status ?? prevState.status,
              progress: progress ?? prevState.progress,
              message: message || prevState.message,
            }));
            if (status === 'COMPLETE' || status === 'FAILED') {
              if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
              }
            }
          }
        )
        .subscribe();

      // 3. Upload the file to Supabase Storage with chunking and progress tracking
      setJobState(prevState => ({ ...prevState, message: 'Uploading file to secure storage...' }));

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated for storage operation.');
      }

      const filePath = `${user.id}/${jobId}/${jobState.file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('lead-uploads')
        .upload(filePath, jobState.file, {
          cacheControl: '3600',
          upsert: true,
          contentType: jobState.file.type,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }
      setUploadProgress(100); // Mark upload as complete since onProgress is not available in this version

      setJobState(prevState => ({ ...prevState, status: 'PROCESSING', message: 'File uploaded. Starting processing...' }));

      // 4. Trigger the backend processing
      const processResponse = await fetch('/api/leads/upload/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, marketRegion }),
      });

      if (!processResponse.ok) {
        const { error } = await processResponse.json();
        throw new Error(error || 'Failed to start processing.');
      }

    } catch (error: any) {
      console.error('Upload process error:', error);
      setJobState(prevState => ({ ...prevState, status: 'FAILED', message: error.message }));
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }
  };

  const isUploadingOrProcessing = jobState.status === 'UPLOADING' || jobState.status === 'PROCESSING';
  const isFinished = jobState.status === 'COMPLETE' || jobState.status === 'FAILED';
  const displayProgress = jobState.status === 'UPLOADING' ? uploadProgress : jobState.progress;

  if (isUploadingOrProcessing || isFinished) {
    const progressColor = jobState.status === 'COMPLETE' ? 'success' : jobState.status === 'FAILED' ? 'danger' : 'primary';
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 space-y-4">
        <div className="text-center">
          <p className={`text-lg font-medium text-${progressColor}-600`}>{jobState.status}</p>
          <p className="text-sm text-default-500 mt-1">{jobState.message}</p>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${displayProgress}%` }}
          ></div>
        </div>
        {isFinished && (
          <Button size="sm" variant="flat" className="mt-4" onPress={handleReset}>Upload Another File</Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-2 space-y-4">
      <FloatingLabelInput
        label="Market Region"
        placeholder="e.g., Dallas / Fort Worth"
        value={marketRegion}
        onChange={(e) => setMarketRegion(e.target.value)}
        required
      />
      <div {...getRootProps()} className={`flex-grow flex items-center justify-center p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary-50' : 'border-default-200 hover:border-default-400'}`}>
        <input {...getInputProps()} />
        <div className="text-center text-default-500">
          <Icon icon="lucide:upload-cloud" className="w-10 h-10 mx-auto mb-2" />
          {jobState.file ? (
            <span>{jobState.file.name}</span>
          ) : (
            <span>Drag & drop or click to select CSV</span>
          )}
        </div>
      </div>
      {jobState.message && jobState.status === 'FAILED' && <p className="text-danger text-xs text-center">{jobState.message}</p>}
      <Button color="primary" onPress={handleUpload} disabled={!jobState.file || !marketRegion || jobState.status === 'UPLOADING' || jobState.status === 'PROCESSING'}>
        Upload and Process
      </Button>
    </div>
  );
}