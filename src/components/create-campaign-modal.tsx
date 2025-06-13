// src/components/create-campaign-modal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Select, SelectItem, Slider } from "@heroui/react";
import toast from 'react-hot-toast';
import { useSupabase } from '@/lib/supabase/client'; // Assuming a client hook/provider might exist, else use createClient

type MarketRegion = {
  id: string;
  name: string;
};

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void; // Callback to re-fetch campaigns list
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [marketRegionId, setMarketRegionId] = useState<string>('');
  const [dailyLimit, setDailyLimit] = useState<number>(100);
  const [timeWindowHours, setTimeWindowHours] = useState<number>(8);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = useSupabase(); // Or create a client instance

  const { data: marketRegions } = useSWR<MarketRegion[]>('/api/market-regions', fetcher);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setMarketRegionId('');
      setDailyLimit(100);
      setTimeWindowHours(8);
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!name || !marketRegionId) {
      setError('Campaign Name and Market Region are required.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const toastId = toast.loading('Creating campaign...');

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Authentication required.");

        const response = await fetch('/api/campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                market_region_id: marketRegionId,
                daily_limit: dailyLimit,
                time_window_hours: timeWindowHours,
                user_id: user.id, // Associate campaign with the current user
                status: 'draft'
            })
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Failed to create campaign.');
        }

        toast.success('Campaign created successfully!', { id: toastId });
        onSuccess(); // Trigger data re-fetch in the parent component
        onClose();

    } catch (err: any) {
        toast.error(err.message, { id: toastId });
        setError(err.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        <ModalHeader>Create New Campaign</ModalHeader>
        <ModalBody className="space-y-6">
          <Input
            label="Campaign Name"
            placeholder="e.g., Q3 Dallas Outreach"
            value={name}
            onValueChange={setName}
            isRequired
          />
          <Select
            label="Market Region"
            placeholder="Select a target market"
            selectedKeys={marketRegionId ? [marketRegionId] : []}
            onChange={(e) => setMarketRegionId(e.target.value)}
            isRequired
          >
            {(marketRegions || []).map((region) => (
              <SelectItem key={region.id} value={region.id}>
                {region.name}
              </SelectItem>
            ))}
          </Select>
          <Slider
            label={`Daily Send Limit: ${dailyLimit}`}
            value={dailyLimit}
            onChange={(val) => setDailyLimit(val as number)}
            minValue={10}
            maxValue={500}
            step={10}
          />
          <Slider
            label={`Time Window: ${timeWindowHours} hours`}
            value={timeWindowHours}
            onChange={(val) => setTimeWindowHours(val as number)}
            minValue={1}
            maxValue={24}
            step={1}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSubmit} isLoading={isSubmitting}>
            Create Campaign
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};