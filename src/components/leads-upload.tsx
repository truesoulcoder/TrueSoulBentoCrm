// src/components/leads-upload.tsx
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useDropzone } from 'react-dropzone';
import { Button, Progress } from '@heroui/react';
import { v4 as uuidv4 } from 'uuid';
import { type RealtimeChannel } from '@supabase/supabase-js';
import { type Database } from '@/types/supabase';
import { Icon } from '@iconify/react';
import FloatingLabelInput from './ui/FloatingLabelInput'; // Import the custom floating label input

type JobStatus = Database['public']['Enums']['upload_job_status'];
interface UploadJobState {
  jobId: string | null;
  status: JobStatus | 'INITIAL';
  progress: number;
  message: string;
}

export function LeadsUpload() {
  const [file, setFile] = useState<File | null>(null);
  // FIX: Change state to handle a typed-in region name instead of a selected ID
  const [marketRegionName, setMarketRegionName] = useState<string>('');
  const [error, setError] = useState<string>('');

  const [jobState, setJobState] = useState<JobState>({
    file: null,
    status: 'IDLE',
    progress: 0,
    message: '',
    jobId: null,
  });
  const [marketRegion, setMarketRegion] = useState('');
  const channelRef = useRef<RealtimeChannel | null>(null);

  // New state to track upload-specific progress
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setJobState({ ...jobState, file, status: 'READY' });
      setUploadProgress(0);
    }
  };

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  });

  const handleReset = () => {
    setFile(null);
    // FIX: Reset the market region name
    setMarketRegionName('');
    setError('');
    setJobState({ file: null, status: 'IDLE', progress: 0, message: '', jobId: null });
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current).then(status => console.log(`Unsubscribed from channel: ${status}`));
      channelRef.current = null;
    }
  };

  const handleUpload = async () => {
    if (!jobState.file || !marketRegionName) {
      setJobState(prevState => ({ ...prevState, message: 'Please select a file and enter a market region.' }));
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
        const errorData = await startResponse.json();
        throw new Error(errorData.error || 'Could not start upload job.');
      }

      const { jobId } = await startResponse.json();
      setJobState(prevState => ({ ...prevState, jobId }));

      // 2. Subscribe to real-time updates for this job *before* starting the upload
      channelRef.current = supabase.channel(`upload_job:${jobId}`);
      channelRef.current
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'upload_jobs', filter: `job_id=eq.${jobId}` },
          (payload) => {
            const { progress, status, message } = payload.new as Database['public']['Tables']['upload_jobs']['Row'];
            setJobState(prevState => ({
              ...prevState,
              status: status ?? prevState.status,
              progress: progress ?? prevState.progress,
              message: message || prevState.message
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

      // 3. Upload the file to Supabase Storage with chunking
      setJobState(prevState => ({ ...prevState, message: 'Uploading file to secure storage...' }));
      const filePath = `${jobId}/${jobState.file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('lead-uploads')
        .upload(filePath, jobState.file, {
          cacheControl: '3600',
          upsert: true,
          contentType: jobState.file.type,
          onProgress: (progress) => {
            setUploadProgress(progress);
          }
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      setJobState(prevState => ({ ...prevState, status: 'PROCESSING', message: 'File uploaded. Starting processing...' }));

      // 4. Trigger the backend processing
      const processResponse = await fetch('/api/leads/upload/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, marketRegion: marketRegionName }),
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json();
        throw new Error(errorData.error || 'Failed to start processing.');
      }

      // Backend is now processing. Real-time channel will handle UI updates.

    } catch (error: any) {
      console.error('Upload process error:', error);
      setJobState(prevState => ({ ...prevState, status: 'FAILED', message: error.message }));
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }
  };

  const isUploading = jobState.status === 'UPLOADING' || (jobState.status === 'PROCESSING' && !!jobState.jobId);
  const isFinished = jobState.status === 'COMPLETE' || jobState.status === 'FAILED';

  if (isUploading || isFinished) {
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
            style={{ width: `${jobState.status === 'UPLOADING' ? uploadProgress : jobState.progress}%` }}
          ></div>
        </div>
        {isFinished && (
          <Button size="sm" variant="flat" className="mt-4" onPress={handleReset}>Upload Another File</Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-2 space-y-4">
      {/* FIX: Replaced Select with FloatingLabelInput */}
      <FloatingLabelInput
        label="Market Region"
        placeholder="e.g., Dallas / Fort Worth"
        value={marketRegionName}
        onChange={(e) => setMarketRegionName(e.target.value)}
        required
      />
      <div {...getRootProps()} className={`flex-grow flex items-center justify-center p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary-50' : 'border-default-200 hover:border-default-400'}`}>
        <input {...getInputProps()} />
        <div className="text-center text-default-500">
          <Icon icon="lucide:upload-cloud" className="w-10 h-10 mx-auto mb-2" />
          {file ? (
            <span>{file.name}</span>
          ) : (
            <span>Drag & drop or click to select CSV</span>
          )}
        </div>
      </div>
      {error && <p className="text-danger text-xs text-center">{error}</p>}
      {/* FIX: Update disabled logic */}
      <Button color="primary" onPress={handleUpload} disabled={!file || !marketRegionName}>
        Upload and Process
      </Button>
    </div>
  );
}