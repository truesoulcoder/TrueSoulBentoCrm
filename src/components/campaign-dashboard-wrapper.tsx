// src/components/campaign-dashboard-wrapper.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { DraggableDashboard } from './draggable-dashboard';
import { signOut } from '@/actions/auth';
import type { DashboardPageData } from '@/app/page';

export function CampaignDashboardWrapper({
  userRole,
  userId,
  initialData,
}: {
  userRole: string;
  userId: string;
  initialData: DashboardPageData;
}) {
  const [isEditMode, setIsEditMode] = useState(false);
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const [isRunning, setIsRunning] = useState(initialData.engineState?.status === 'running');
  const [isPaused, setIsPaused] = useState(initialData.engineState?.status === 'paused');
  const [currentCampaign, setCurrentCampaign] = useState("Q2 Investor Outreach");

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const isSuperAdmin = userRole === 'superadmin';

  return (
    <div className="flex h-screen w-full flex-col bg-gray-100 dark:bg-gray-800">
      <header className="flex w-full items-center justify-between border-b border-divider bg-white dark:bg-gray-900 p-4 sticky top-0 z-30">
        <h1 className="text-xl font-bold">True Soul CRM</h1>
        <div className="flex items-center gap-2 md:gap-4">
          {isSuperAdmin && (
            <Button
              variant={isEditMode ? "solid" : "flat"}
              color="primary"
              onPress={() => setIsEditMode(!isEditMode)}
              // FIX: The icon is now always present
              startContent={<Icon icon="lucide:layout" className="w-5 h-5" />}
              // FIX: Removed the isIconOnly prop to allow the button to expand
            >
             {/* FIX: This span correctly hides text on small screens, making the button effectively icon-only */}
             <span className="hidden md:block">{isEditMode ? 'Save Layout' : 'Edit Layout'}</span>
            </Button>
          )}
           <Button
            isIconOnly
            variant="flat"
            aria-label="Toggle Theme"
            onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
           >
            <Icon icon={theme === 'dark' ? 'lucide:sun' : 'lucide:moon'} className="w-5 h-5" />
          </Button>
          <Button
            isIconOnly
            variant="flat"
            aria-label="Sign Out"
            onPress={handleSignOut}
           >
            <Icon icon="lucide:log-out" className="w-5 h-5" />
          </Button>
        </div>
      </header>
      <main className="flex-grow overflow-y-auto p-2 md:p-4">
        <DraggableDashboard
          isRunning={isRunning}
          isPaused={isPaused}
          currentCampaign={currentCampaign}
          isEditMode={isEditMode}
          userRole={userRole}
          userId={userId}
          initialData={initialData}
        />
      </main>
    </div>
  );
}