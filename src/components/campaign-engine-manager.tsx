// src/components/campaign-engine-manager.tsx
'use client';

import React, { useState, useCallback } from 'react';
import useSWR from 'swr';
import { Card, CardHeader, CardBody, Button, Select, SelectItem, Progress, Chip } from "@heroui/react";
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';

// Re-usable fetcher for useSWR
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    // For 4xx/5xx errors, parse the JSON body for a more specific message
    return res.json().then(errorBody => {
      throw new Error(errorBody.error || 'An error occurred while fetching data.');
    });
  }
  return res.json();
});


// Type for the engine's state
type EngineState = {
  status: 'running' | 'paused' | 'stopped';
  updated_at: string;
};

// Type for a market region
type MarketRegion = {
  id: string;
  name: string;
};

// Type for a campaign
type Campaign = {
  id: string;
  name: string;
};

export const CampaignEngineManager: React.FC = () => {
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all necessary data using SWR for automatic re-fetching and caching
  const { data: engineState, mutate: mutateEngineState } = useSWR<EngineState>('/api/engine/control', fetcher, { refreshInterval: 5000 });
  const { data: campaigns } = useSWR<Campaign[]>('/api/campaigns', fetcher);
  const { data: marketRegions, error: marketRegionsError } = useSWR<MarketRegion[]>('/api/market-regions', fetcher);

  const handleStateChange = useCallback(async (status: 'running' | 'paused' | 'stopped') => {
    setIsSubmitting(true);
    const toastId = toast.loading(`Requesting to ${status} engine...`);

    const body: { status: string; campaign_id?: string } = { status };

    // A campaign_id is required to resume from pause to adjust schedules
    if (status === 'running' && engineState?.status === 'paused') {
      if (!selectedCampaign) {
        toast.error('Please select the campaign you wish to resume.', { id: toastId });
        setIsSubmitting(false);
        return;
      }
      body.campaign_id = selectedCampaign;
    }

    try {
      const res = await fetch('/api/engine/control', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // Assuming this is called from an authorized user session,
          // for service-to-service, an API key might be better.
        },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to change engine state.');

      toast.success(`Engine state successfully set to ${status}.`, { id: toastId });
      mutateEngineState();
    } catch (error: any) {
      console.error('Failed to change engine state:', error);
      toast.error(error.message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedCampaign, engineState, mutateEngineState]);

  const handleScheduleCampaign = useCallback(async () => {
    if (!selectedCampaign || !selectedRegion) {
      toast.error('Please select a campaign and a market region to schedule.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(`Scheduling jobs for campaign...`);

    try {
      const res = await fetch('/api/engine/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: selectedCampaign,
          market_region_id: selectedRegion,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to schedule campaign jobs.');

      toast.success(result.message || 'Campaign scheduled successfully!', { id: toastId, duration: 5000 });

    } catch (error: any) {
      console.error('Failed to schedule campaign:', error);
      toast.error(error.message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedCampaign, selectedRegion]);

  const getStatusChip = () => {
    if (!engineState) return <Chip color="default" variant="flat">Loading...</Chip>;
    switch (engineState.status) {
      case 'running':
        return <Chip color="success" variant="shadow">Running</Chip>;
      case 'paused':
        return <Chip color="warning" variant="shadow">Paused</Chip>;
      case 'stopped':
        return <Chip color="danger" variant="shadow">Stopped</Chip>;
      default:
        return <Chip color="default" variant="flat">Unknown</Chip>;
    }
  };

  return (
    <div className="flex flex-col h-full p-2 space-y-4">
        {!engineState && <Progress isIndeterminate size="sm" aria-label="Loading engine status..." />}
        <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Master Control</h3>
            {getStatusChip()}
        </div>
        
        <Select
            label="Select Campaign"
            placeholder="Choose a campaign"
            selectedKeys={selectedCampaign ? [selectedCampaign] : []}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            aria-label="Select Campaign"
            disabled={isSubmitting}
        >
            {(campaigns || []).map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                </SelectItem>
            ))}
        </Select>

        <Select
            label="Select Market Region"
            placeholder="Choose a region to target"
            selectedKeys={selectedRegion ? [selectedRegion] : []}
            onChange={(e) => setSelectedRegion(e.target.value)}
            aria-label="Select Market Region"
            disabled={isSubmitting || !!marketRegionsError}
        >
            {(marketRegions || []).map((region) => (
                <SelectItem key={region.id} value={region.id}>
                    {region.name}
                </SelectItem>
            ))}
        </Select>

        <div className="pt-2 border-t border-divider">
            <Button
                fullWidth
                color="secondary"
                variant="solid"
                onPress={handleScheduleCampaign}
                isDisabled={isSubmitting || !selectedCampaign || !selectedRegion}
                startContent={!isSubmitting && <Icon icon="lucide:calendar-plus" />}
            >
                Schedule Campaign Jobs
            </Button>
        </div>

        <div className="pt-2 border-t border-divider grid grid-cols-2 gap-2">
             <Button 
                color="primary"
                onPress={() => handleStateChange('running')}
                isDisabled={isSubmitting || engineState?.status === 'running'}
                startContent={!isSubmitting && <Icon icon="lucide:play" />}
            >
                {engineState?.status === 'paused' ? 'Resume' : 'Start'}
            </Button>
            <Button 
                color="warning"
                variant="flat"
                onPress={() => handleStateChange('paused')}
                isDisabled={isSubmitting || engineState?.status !== 'running'}
                startContent={!isSubmitting && <Icon icon="lucide:pause" />}
            >
                Pause
            </Button>
        </div>
         <Button 
            color="danger"
            variant="flat"
            fullWidth
            onPress={() => handleStateChange('stopped')}
            isDisabled={isSubmitting || engineState?.status === 'stopped'}
            startContent={!isSubmitting && <Icon icon="lucide:square" />}
        >
            Stop Engine
        </Button>
    </div>
  );
};