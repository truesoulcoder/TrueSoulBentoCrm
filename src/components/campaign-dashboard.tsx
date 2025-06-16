// src/components/campaign-dashboard.tsx
'use client'

import type { Database } from '@/types/supabase';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useState, useEffect } from 'react'
import { LeadsTable } from './leads-table'
import { CampaignSettings } from './campaign-settings'
import { TemplatePreview } from './template-preview'
import { EmailSelector } from './email-selector'
import { CampaignConsole } from './campaign-console'
import { type LeadWithProperties } from './campaign-dashboard-wrapper';

// Define types based on Supabase schema
type Campaign = Database['public']['Tables']['campaigns']['Row'];

export function CampaignDashboard({ leads, userRole }: { leads: LeadWithProperties[], userRole: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 15; // You can adjust the number of items per page

  const isSuperAdmin = userRole === 'superadmin';

  async function fetchCampaigns(pageNum: number) {
    if (pageNum === 1) {
        setCampaigns([]);
    }
    setIsLoading(true);
    try {
        const response = await fetch(`/api/campaigns?page=${pageNum}&limit=${limit}`);
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to fetch campaigns');
        }
        const { campaigns: newCampaigns, count } = await response.json();
        
        setCampaigns(prev => [...prev, ...newCampaigns]);
        setTotalCount(count);
        setPage(pageNum);

        if (!selectedCampaign && pageNum === 1 && newCampaigns.length > 0) {
            setSelectedCampaign(newCampaigns[0]);
        }
    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsLoading(false);
    }
  }

  useEffect(() => {
    // Only superadmins should fetch the list of all campaigns
    if (isSuperAdmin) {
      fetchCampaigns(1);
    } else {
      setIsLoading(false);
    }
  }, [isSuperAdmin]);

  const handleLoadMore = () => {
    if (campaigns.length < totalCount) {
        fetchCampaigns(page + 1);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const campaignIsRunning = selectedCampaign?.status === 'active';
  const campaignIsPaused = selectedCampaign?.status === 'paused';

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setCampaigns(items => {
        const oldIndex = items.findIndex(item => item.id === active.id)
        const newIndex = items.findIndex(item => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  if (error) {
      return <div className="flex h-screen items-center justify-center text-red-500">Error: {error}</div>
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        {isSuperAdmin && (
          <aside className="w-1/4 bg-white p-4 dark:bg-gray-800 flex flex-col">
            <h2 className="text-xl font-bold mb-4">Campaigns</h2>
            <div className="flex-grow overflow-y-auto pr-2">
              <SortableContext
                items={campaigns.map(c => String(c.id))}
                strategy={verticalListSortingStrategy}
              >
                {campaigns.map(campaign => (
                  <div 
                    key={campaign.id} 
                    onClick={() => setSelectedCampaign(campaign)}
                    className={`p-2 my-1 cursor-pointer rounded transition-colors ${selectedCampaign?.id === campaign.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                  >
                      {campaign.name}
                  </div>
                ))}
              </SortableContext>
              {isLoading && <p className="text-center p-4">Loading...</p>}
              {!isLoading && campaigns.length < totalCount && (
                  <button onClick={handleLoadMore} className="mt-4 w-full text-center py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded">
                      Load More
                  </button>
              )}
            </div>
          </aside>
        )}

        <main className="flex-1 p-6 overflow-y-auto h-full">
            {isSuperAdmin ? (
              <>
                {selectedCampaign ? (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                      <LeadsTable
                        leads={leads.filter(
                          (l: LeadWithProperties) => l.campaign_id === selectedCampaign.id
                        )}
                      />
                    </div>
                    <div>
                      <CampaignSettings currentCampaign={selectedCampaign.name} />
                      <TemplatePreview />
                      <EmailSelector />
                    </div>
                    <div className="lg:col-span-3">
                      <CampaignConsole isRunning={campaignIsRunning} isPaused={campaignIsPaused} />
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-gray-500">
                      {isLoading ? 'Loading campaigns...' : 'Select a campaign to view details'}
                    </p>
                  </div>
                )}
              </>
            ) : (
              // Non-admin view: Just the leads table
              <div className="h-full">
                <LeadsTable leads={leads} />
              </div>
            )}
        </main>
      </div>
    </DndContext>
  )
}