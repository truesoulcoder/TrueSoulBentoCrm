// src/components/campaign-engine-manager.tsx
'use client';

import React, { useState, useCallback } from 'react';
import useSWR from 'swr';
import { Button, Select, SelectItem, Chip, useDisclosure } from "@heroui/react";
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { CreateCampaignModal } from './create-campaign-modal';
import type { Database } from '@/types/supabase';

// Re-usable fetcher for useSWR
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    return res.json().then(errorBody => {
      throw new Error(errorBody.error || 'An error occurred while fetching data.');
    });
  }
  return res.json();
});

// Type definitions
type EngineState = Database['public']['Tables']['engine_state']['Row'];
type Campaign = Database['public']['Tables']['campaigns']['Row'];

// FIX: Define a type for the actual API response shape
type CampaignsApiResponse = {
  campaigns: Campaign[];
  count: number | null;
};

interface CampaignEngineManagerProps {
  initialCampaigns: Campaign[];
  initialEngineState: EngineState | null;
}

export const CampaignEngineManager: React.FC<CampaignEngineManagerProps> = ({ initialCampaigns, initialEngineState }) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isOpen, onOpen, onClose } = useDisclosure();

  const { data: engineState, mutate: mutateEngineState } = useSWR<EngineState | null>('/api/engine/control', fetcher, { 
    refreshInterval: 5000,
    fallbackData: initialEngineState,
  });
  
  // FIX: Use the correct API response type and provide a matching fallbackData structure.
  const { data: campaignsResponse, mutate: mutateCampaigns } = useSWR<CampaignsApiResponse>('/api/campaigns', fetcher, {
      fallbackData: { campaigns: initialCampaigns, count: initialCampaigns.length },
  });

  // FIX: Safely access the nested 'campaigns' array from the response object.
  const campaigns = campaignsResponse?.campaigns;

  const selectedCampaign = campaigns?.find(c => c.id === selectedCampaignId);

  const handleStateChange = useCallback(async (status: 'running' | 'paused' | 'stopped') => {
    setIsSubmitting(true);
    const toastId = toast.loading(`Requesting to ${status} engine...`);
    const body: { status: string; campaign_id?: string } = { status };

    if (status === 'running' && engineState?.status === 'paused') {
      body.campaign_id = selectedCampaignId;
    }

    try {
      const res = await fetch('/api/engine/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  }, [selectedCampaignId, engineState, mutateEngineState]);

  const handleScheduleCampaign = useCallback(async () => {
    if (!selectedCampaign) {
      toast.error('Please select a campaign to schedule.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(`Scheduling jobs for "${selectedCampaign.name}"...`);

    try {
      const res = await fetch('/api/engine/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: selectedCampaign.id }),
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
  }, [selectedCampaign]);

  const getStatusChip = () => {
    if (!engineState) return <Chip color="default" variant="flat">Loading...</Chip>;
    switch (engineState.status) {
      case 'running': return <Chip color="success" variant="shadow">Running</Chip>;
      case 'paused': return <Chip color="warning" variant="shadow">Paused</Chip>;
      case 'stopped': return <Chip color="danger" variant="shadow">Stopped</Chip>;
      default: return <Chip color="default" variant="flat">Unknown</Chip>;
    }
  };

  return (
    <>
      <div className="flex flex-col h-full p-2 space-y-4">
          <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Master Control</h3>
              {getStatusChip()}
          </div>

          <div className="flex items-center gap-2">
            <Select
                label="Select Campaign"
                placeholder="Choose a campaign"
                selectedKeys={selectedCampaignId ? [selectedCampaignId] : []}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                aria-label="Select Campaign"
                disabled={isSubmitting}
                className="flex-grow"
            >
                {(campaigns || []).map((campaign) => (
                    <SelectItem key={campaign.id} textValue={campaign.name}>
                        {campaign.name}
                    </SelectItem>
                ))}
            </Select>
            <Button isIconOnly variant="flat" onPress={onOpen} aria-label="Create new campaign">
                <Icon icon="lucide:plus" />
            </Button>
          </div>
          
          <div className="pt-2 border-t border-divider">
              <Button
                  fullWidth
                  color="secondary"
                  variant="solid"
                  onPress={handleScheduleCampaign}
                  isDisabled={isSubmitting || !selectedCampaignId}
                  startContent={!isSubmitting && <Icon icon="lucide:calendar-plus" />}
              >
                  Schedule Selected Campaign
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
      
      <CreateCampaignModal 
        isOpen={isOpen}
        onClose={onClose}
        onSuccess={() => {
          mutateCampaigns();
          onClose();
        }}
        dailyLimit={100} 
        timeWindowHours={8}
      />
    </>
  );
};