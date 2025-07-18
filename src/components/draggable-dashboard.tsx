// src/components/draggable-dashboard.tsx
import React from "react";
import { Icon } from "@iconify/react";
import { Card, CardHeader, CardBody, Button } from "@heroui/react";
import { Responsive, WidthProvider } from "react-grid-layout";

// Component Imports
import { CampaignChart } from "./campaign-chart";
import { CampaignConsole } from "./campaign-console";
import { CampaignStatus } from "./campaign-status";
import { CampaignEngineManager } from "./campaign-engine-manager";
import { TemplatePreview } from "./template-preview";
import { CampaignSettings } from "./campaign-settings";
import { LeadsTable } from "./leads-table";
import { LeadsUpload } from "./leads-upload";
import { SendersWidget } from "./senders-widget";
import ZillowScraperWidget from "./ZillowScraperWidget";
import type { DashboardPageData } from "@/app/page";


import "react-grid-layout/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardItem {
  i: string;
  title: string;
  subtitle: string;
  component: React.ReactNode;
}

interface DraggableDashboardProps {
  isRunning: boolean;
  isPaused: boolean;
  currentCampaign: string;
  isEditMode: boolean;
  userRole: string;
  userId: string;
  initialData: DashboardPageData;
}

type LayoutItem = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number };
type Layouts = { [P in "lg" | "md" | "sm"]?: LayoutItem[] };

export const DraggableDashboard: React.FC<DraggableDashboardProps> = ({
  isRunning,
  isPaused,
  currentCampaign,
  isEditMode,
  userRole,
  userId,
  initialData,
}) => {
  const allDashboardItems: DashboardItem[] = [
    { i: "leads", title: "Campaign Leads", subtitle: "Manage your campaign leads", component: <LeadsTable initialLeads={initialData.leads} initialMarketRegions={initialData.marketRegions} userRole={userRole} userId={userId} /> },
    { i: "engine-manager", title: "Engine Control", subtitle: "Manage campaign state", component: <CampaignEngineManager initialCampaigns={initialData.campaigns} initialEngineState={initialData.engineState} /> },
    { i: "status", title: "Campaign Status", subtitle: "Current performance", component: <CampaignStatus isRunning={isRunning} isPaused={isPaused} /> },
    { i: "chart", title: "Performance Metrics", subtitle: "Last 7 days", component: <CampaignChart /> },
    { i: "console", title: "Console Log", subtitle: "Real-time campaign updates", component: <CampaignConsole isRunning={isRunning} isPaused={isPaused} /> },
    { i: "template", title: "Template Preview", subtitle: "Current email template", component: <TemplatePreview /> },
    { i: "leads-upload", title: "Leads Uploader", subtitle: "Upload new leads via CSV", component: <LeadsUpload /> },
    { i: "senders", title: "Email Senders", subtitle: "Manage authenticated senders", component: <SendersWidget /> },
    { i: "zillow-scraper", title: "Zillow Scraper", subtitle: "Queue a new scraper job", component: <ZillowScraperWidget /> },
    { i: "settings", title: "Campaign Settings", subtitle: "Configure campaign parameters", component: <CampaignSettings currentCampaign={currentCampaign} /> },
  ];

  const dashboardItems = userRole === 'superadmin' 
    ? allDashboardItems 
    : allDashboardItems.filter(item => item.i === 'leads');

  const defaultLayouts: Layouts = {
    lg: [
      { i: "leads", x: 0, y: 0, w: 4, h: 4, minW: 3, minH: 4 },
      { i: "engine-manager", x: 0, y: 4, w: 1, h: 2, minW: 1, minH: 2 },
      { i: "status", x: 1, y: 4, w: 1, h: 2, minW: 1, minH: 2 },
      { i: "chart", x: 2, y: 4, w: 2, h: 2, minW: 2, minH: 2 },
      { i: "console", x: 0, y: 6, w: 2, h: 2, minW: 2, minH: 2 },
      { i: "template", x: 2, y: 6, w: 2, h: 2, minW: 2, minH: 2 },
      { i: "leads-upload", x: 0, y: 8, w: 1, h: 2, minW: 1, minH: 2 },
      { i: "senders", x: 1, y: 8, w: 1, h: 2, minW: 1, minH: 2 },
      { i: "zillow-scraper", x: 2, y: 8, w: 1, h: 2, minW: 1, minH: 2 },
      { i: "settings", x: 3, y: 8, w: 1, h: 2, minW: 1, minH: 2 },
    ],
    md: [
        { i: "leads", x: 0, y: 0, w: 3, h: 4, minW: 3, minH: 4 },
        { i: "chart", x: 0, y: 4, w: 2, h: 2, minW: 2, minH: 2 },
        { i: "engine-manager", x: 2, y: 4, w: 1, h: 2, minW: 1, minH: 2 },
        { i: "console", x: 0, y: 6, w: 2, h: 2, minW: 2, minH: 2 },
        { i: "status", x: 2, y: 6, w: 1, h: 2, minW: 1, minH: 2 },
        { i: "template", x: 0, y: 8, w: 3, h: 2, minW: 2, minH: 2 },
        { i: "leads-upload", x: 0, y: 10, w: 1, h: 2, minW: 1, minH: 2 },
        { i: "senders", x: 1, y: 10, w: 1, h: 2, minW: 1, minH: 2 },
        { i: "zillow-scraper", x: 2, y: 10, w: 1, h: 2, minW: 1, minH: 2 },
        { i: "settings", x: 0, y: 12, w: 3, h: 2, minW: 1, minH: 2 },
    ],
    sm: [
        { i: "leads", x: 0, y: 0, w: 1, h: 4 },
        { i: "engine-manager", x: 0, y: 4, w: 1, h: 2 },
        { i: "status", x: 0, y: 6, w: 1, h: 2 },
        { i: "chart", x: 0, y: 8, w: 1, h: 2 },
        { i: "console", x: 0, y: 10, w: 1, h: 2 },
        { i: "leads-upload", x: 0, y: 12, w: 1, h: 2 },
        { i: "senders", x: 0, y: 14, w: 1, h: 2 },
        { i: "zillow-scraper", x: 0, y: 16, w: 1, h: 2 },
        { i: "template", x: 0, y: 18, w: 1, h: 2 },
        { i: "settings", x: 0, y: 20, w: 1, h: 2 },
    ],
  };

  const getFromLS = (key: string): Layouts | null => {
    if (typeof window !== "undefined") {
      try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
      } catch (e) { console.error(e); }
    }
    return null;
  };

  const saveToLS = (key: string, value: any) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) { console.error(e); }
    }
  };

  const [layouts, setLayouts] = React.useState<Layouts>({});

  // FIX: This effect synchronizes the layout from localStorage with the current dashboard items
  // It prevents crashes when new widgets are added or when local storage data is corrupted.
  React.useEffect(() => {
    const savedLayouts = getFromLS("layouts") || defaultLayouts;
    const synchronizedLayouts: Layouts = {};

    Object.keys(defaultLayouts).forEach(breakpoint => {
        const bpKey = breakpoint as keyof Layouts;
        const savedBreakpointLayout = savedLayouts[bpKey];
        const defaultBreakpointLayout = defaultLayouts[bpKey]!;
        
        // FIX: Check if the saved layout for the breakpoint is actually an array.
        // If not, fallback to the default layout for this breakpoint to prevent a crash.
        if (!Array.isArray(savedBreakpointLayout)) {
            synchronizedLayouts[bpKey] = defaultBreakpointLayout;
            return;
        }

        const currentItemKeys = new Set(dashboardItems.map(item => item.i));
        
        let newLayout = savedBreakpointLayout.filter((layoutItem: LayoutItem) => currentItemKeys.has(layoutItem.i));

        const newLayoutKeys = new Set(newLayout.map(item => item.i));
        defaultBreakpointLayout.forEach((defaultItem: LayoutItem) => {
            if (!newLayoutKeys.has(defaultItem.i)) {
                newLayout.push(defaultItem);
            }
        });
        
        synchronizedLayouts[bpKey] = newLayout;
    });

    setLayouts(synchronizedLayouts);
  }, []);


  const handleLayoutChange = (_: any, allLayouts: Layouts) => {
    if (isEditMode) {
      setLayouts(allLayouts);
      saveToLS("layouts", allLayouts);
    }
  };

  const resetLayout = () => {
    if (typeof window !== "undefined") {
        localStorage.removeItem("dashboard-layouts");
    }
    setLayouts(defaultLayouts);
  };

  return (
    <div className="relative">
      {isEditMode && userRole === 'superadmin' && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-content2 p-3">
          <div className="flex items-center gap-2">
            <Icon icon="lucide:move" className="text-primary" />
            <span className="text-small font-medium">Drag cards to rearrange your dashboard layout</span>
          </div>
          <Button size="sm" variant="flat" color="danger" onPress={resetLayout}>Reset Layout</Button>
        </div>
      )}

      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 4, md: 3, sm: 1, xs: 1, xxs: 1 }}
        rowHeight={150}
        isDraggable={isEditMode && userRole === 'superadmin'}
        isResizable={isEditMode && userRole === 'superadmin'}
        onLayoutChange={handleLayoutChange}
        margin={[16, 16]}
        measureBeforeMount={false}
        useCSSTransforms={true}
      >
        {dashboardItems.map((item) => (
          <div key={item.i}>
            <Card className="h-full transition-all duration-200">
              {isEditMode && userRole === 'superadmin' && (
                <div className="absolute left-0 right-0 top-0 z-10 flex h-full w-full cursor-move items-center justify-center rounded-lg bg-foreground/5 opacity-0 transition-opacity hover:opacity-100">
                  <div className="rounded-lg bg-foreground/80 p-2 text-background">
                    <Icon icon="lucide:move" width={24} height={24} />
                  </div>
                </div>
              )}
              <CardHeader className="flex gap-3 px-5 pb-0 pt-5">
                <div className="flex flex-col">
                  <p className="text-md font-semibold">{item.title}</p>
                  <p className="text-small text-default-500">{item.subtitle}</p>
                </div>
              </CardHeader>
              <CardBody>{item.component}</CardBody>
            </Card>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
};