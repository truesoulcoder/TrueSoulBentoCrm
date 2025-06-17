// src/components/leads-upload.tsx
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useDropzone } from 'react-dropzone';
import { Button, Input, Progress, Select, SelectItem } from '@heroui/react'; // Added Select and SelectItem
import { v4 as uuidv4 } from 'uuid';
import { type RealtimeChannel } from '@supabase/supabase-js';
import { type Database } from '@/types/supabase';
import { Icon } from '@iconify/react';
import useSWR from 'swr'; // Import useSWR

type JobStatus = Database['public']['Enums']['upload_job_status'];
interface UploadJobState {
  jobId: string | null;
  status: JobStatus | 'INITIAL';
  progress: number;
  message: string;
}

type MarketRegion = {
  id: string;
  name: string;
};

// Fetcher for market regions
const fetcher = (url: string) => fetch(url).then(res => res.json());

export function LeadsUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [marketRegionId, setMarketRegionId] = useState<string>(''); // Changed to ID
  const [error, setError] = useState<string>('');

  const [jobState, setJobState] = useState<UploadJobState>({
    jobId: null,
    status: 'INITIAL',
    progress: 0,
    message: '',
  });

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch market regions for the dropdown
  const { data: marketRegions, isLoading: isLoadingRegions } = useSWR<MarketRegion[]>('/api/market-regions', fetcher);

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
    setMarketRegionId(''); // Reset market region ID
    setError('');
    setJobState({ jobId: null, status: 'INITIAL', progress: 0, message: '' });
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current).then(status => console.log(`Unsubscribed from channel: ${status}`));
      channelRef.current = null;
    }
  };

  const handleUpload = async () => {
    // Find the market region name from its ID
    const selectedRegion = marketRegions?.find(r => r.id === marketRegionId);
    if (!file || !selectedRegion?.name) {
      setError('Please select a file and a market region.');
      return;
    }
    setError('');
    const newJobId = uuidv4();
    setJobState({ jobId: newJobId, status: 'PENDING', progress: 0, message: 'Preparing upload...' });

    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
    }
    
    channelRef.current = supabase.channel(`upload_job:${newJobId}`);
    channelRef.current
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'upload_jobs', filter: `job_id=eq.${newJobId}` },
        (payload) => {
          const { progress, status, message } = payload.new as Database['public']['Tables']['upload_jobs']['Row'];
          setJobState(prevState => ({ ...prevState, progress: progress ?? prevState.progress, status: status ?? prevState.status, message: message || prevState.message }));
          if (status === 'COMPLETE' || status === 'FAILED') {
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('market_region', selectedRegion.name); // Send the name
          formData.append('job_id', newJobId);
          setJobState(prevState => ({ ...prevState, progress: 10, message: 'Uploading file...' }));
          
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) throw new Error("Not authenticated. Please log in.");
            return fetch('/api/leads/upload', {
              method: 'POST',
              headers: { Authorization: `Bearer ${session.access_token}` },
              body: formData,
            });
          })
          .then(async (response) => {
            if (!response.ok) {
              const errorBody = await response.json().catch(() => ({ message: 'An unknown server error occurred.' }));
              throw new Error(errorBody.message || 'The server could not process the upload.');
            }
            // The actual progress updates will come via the realtime channel
            // This just confirms the initial API call was accepted
            // setJobState(prevState => ({ ...prevState, progress: 20, status: 'PROCESSING', message: 'Upload accepted, processing on server...' }));
            return response.json();
          })
          .catch(err => {
            setError(err.message);
            setJobState(prevState => ({ ...prevState, progress: 0, status: 'FAILED', message: err.message }));
            if (channelRef.current) supabase.removeChannel(channelRef.current);
          });
        } else if (err) {
          setError(`Realtime connection error: ${err.message}. Please try again.`);
          setJobState(prevState => ({ ...prevState, progress: 0, status: 'FAILED' }));
        }
      });
  };

  const isUploading = jobState.status === 'PROCESSING' || (jobState.status === 'PENDING' && !!jobState.jobId);
  const isFinished = jobState.status === 'COMPLETE' || jobState.status === 'FAILED';
  
  if (isUploading || isFinished) {
    const progressColor = jobState.status === 'COMPLETE' ? 'success' : jobState.status === 'FAILED' ? 'danger' : 'primary';
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 space-y-4">
        <div className="text-center">
          <p className={`text-lg font-medium text-${progressColor}-600`}>{jobState.status}</p>
          <p className="text-sm text-default-500 mt-1">{jobState.message}</p>
        </div>
        <Progress
            aria-label="Uploading..."
            size="lg"
            value={jobState.progress}
            color={progressColor}
            showValueLabel={true}
            className="w-full"
        />
        {isFinished && (
            <Button size="sm" variant="flat" className="mt-4" onPress={handleReset}>Upload Another File</Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-2 space-y-4">
      <Select
        label="Market Region"
        placeholder="Select a target market"
        selectedKeys={marketRegionId ? [marketRegionId] : []}
        onChange={(e) => setMarketRegionId(e.target.value)}
        isLoading={isLoadingRegions}
        isDisabled={isLoadingRegions}
        isRequired
      >
        {(marketRegions || []).map((region) => (
          <SelectItem key={region.id} textValue={region.name}>
            {region.name}
          </SelectItem>
        ))}
      </Select>
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
      <Button color="primary" onPress={handleUpload} disabled={!file || !marketRegionId}>
        Upload and Process
      </Button>
    </div>
  );
}