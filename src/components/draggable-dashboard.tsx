// src/components/draggable-dashboard.tsx
import React from "react";
import { Icon } from "@iconify/react";
import { Card, CardHeader, CardBody, Button } from "@heroui/react";
import { Responsive, WidthProvider } from "react-grid-layout";
import { CampaignChart } from "./campaign-chart";
import { CampaignConsole } from "./campaign-console";
import { CampaignStatus } from "./campaign-status";
import { CampaignEngineManager } from "./campaign-engine-manager";
import { TemplatePreview } from "./template-preview";
import { CampaignSettings } from "./campaign-settings";
import { LeadsTable } from "./leads-table";
import { LeadsUpload } from "./leads-upload";
import ZillowScraperWidget from "./ZillowScraperWidget";
import { SendersWidget } from "./senders-widget"; // Import the new SendersWidget

import "react-grid-layout/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardItem {
  i: string;
  title: string;
  subtitle: string;
  component: React.ReactNode;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
}

interface DraggableDashboardProps {
  isRunning: boolean;
  isPaused: boolean;
  currentCampaign: string;
  isEditMode: boolean;
  userRole: string;
  userId: string; // FIX: Add userId prop here
}

type LayoutItem = { i: string; x: number; y: number; w: number; h: number };
type Layouts = Record<string, LayoutItem[]>;

export const DraggableDashboard: React.FC<DraggableDashboardProps> = ({
  isRunning,
  isPaused,
  currentCampaign,
  isEditMode,
  userRole,
  userId, // Destructure userId here
}) => {
  const allDashboardItems: DashboardItem[] = [
    {
      i: "leads",
      title: "Campaign Leads",
      subtitle: "Manage your campaign leads",
      component: <LeadsTable userRole={userRole} userId={userId} />, // Pass userRole and userId
      defaultSize: { w: 4, h: 4 }, 
      minSize: { w: 4, h: 3 },
    },
    {
      i: "status",
      title: "Campaign Status",
      subtitle: "Current performance",
      component: <CampaignStatus isRunning={isRunning} isPaused={isPaused} />,
      defaultSize: { w: 1, h: 2 },
      minSize: { w: 1, h: 2 },
    },
    {
      i: "chart",
      title: "Performance Metrics",
      subtitle: "Last 7 days",
      component: <CampaignChart />,
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
    },
    {
      i: "engine-manager",
      title: "Engine Control",
      subtitle: "Manage campaign state",
      component: <CampaignEngineManager />,
      defaultSize: { w: 1, h: 2 },
      minSize: { w: 1, h: 2 },
    },
    {
      i: "console",
      title: "Campaign Console",
      subtitle: "View campaign logs & status",
      component: (
        <CampaignConsole isRunning={isRunning} isPaused={isPaused} />
      ),
      defaultSize: { w: 6, h: 3 },
      minSize: { w: 2, h: 3 },
    },
    {
      i: "leads-upload",
      title: "Leads Uploader",
      subtitle: "Upload new leads via CSV",
      component: <LeadsUpload />,
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
    },
    {
      i: "template",
      title: "Template Preview",
      subtitle: "Current email template",
      component: <TemplatePreview />,
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 1, h: 2 },
    },
    {
      i: "settings",
      title: "Campaign Settings",
      subtitle: "Configure campaign parameters",
      component: <CampaignSettings currentCampaign={currentCampaign} />,
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
    },
    {
      i: "zillowScraper",
      title: "Zillow Property Scraper",
      subtitle: "Capture property details from Zillow",
      component: <ZillowScraperWidget />,
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 3, h: 4 },
    },
    {
      i: "senders", // New Senders Widget
      title: "Email Senders",
      subtitle: "Manage your sending accounts",
      component: <SendersWidget />,
      defaultSize: { w: 2, h: 3 }, // Adjust size as needed
      minSize: { w: 1, h: 2 },
    },
  ];

  // Filter items based on user role
  const dashboardItems = userRole === 'superadmin' 
    ? allDashboardItems 
    : allDashboardItems.filter(item => item.i === 'leads' || item.i === 'zillowScraper');

  const getFromLS = (key: string): any => {
    let ls: Record<string, any> = {};
    if (typeof window !== "undefined") {
      try {
        ls = JSON.parse(localStorage.getItem("dashboard-layouts") || "{}");
      } catch (e) {
        console.error(e);
      }
    }
    return ls[key] || null;
  };

  const saveToLS = (key: string, value: any) => {
    if (typeof window !== "undefined") {
      try {
        const layouts = JSON.parse(localStorage.getItem("dashboard-layouts") || "{}");
        layouts[key] = value;
        localStorage.setItem("dashboard-layouts", JSON.stringify(layouts));
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Define default layouts based on allDashboardItems' default sizes
  const generateDefaultLayouts = (items: DashboardItem[]): Layouts => {
    const lgLayout: LayoutItem[] = [];
    const mdLayout: LayoutItem[] = [];
    const smLayout: LayoutItem[] = [];
    
    let yLg = 0, yMd = 0, ySm = 0; // Track y position for each breakpoint

    items.forEach(item => {
      // For LG, ensure 'senders' starts below 'engine-manager' if both are present
      if (item.i === 'senders' && items.some(i => i.i === 'engine-manager')) {
        // Find the position of engine-manager and place senders below it
        const engineManagerLayout = lgLayout.find(layoutItem => layoutItem.i === 'engine-manager');
        if (engineManagerLayout) {
          lgLayout.push({ i: item.i, x: engineManagerLayout.x, y: engineManagerLayout.y + engineManagerLayout.h, w: item.defaultSize.w, h: item.defaultSize.h });
        } else {
          // Fallback if engine-manager not found (e.g., if filtered out for non-superadmin)
          lgLayout.push({ i: item.i, x: 0, y: yLg, w: item.defaultSize.w, h: item.defaultSize.h });
          yLg += item.defaultSize.h;
        }
      } else {
        lgLayout.push({ i: item.i, x: 0, y: yLg, w: item.defaultSize.w, h: item.defaultSize.h });
        yLg += item.defaultSize.h;
      }
      

      // Simple stacking for smaller breakpoints
      mdLayout.push({ i: item.i, x: 0, y: yMd, w: Math.min(item.defaultSize.w, 3), h: item.defaultSize.h });
      yMd += item.defaultSize.h;

      smLayout.push({ i: item.i, x: 0, y: ySm, w: Math.min(item.defaultSize.w, 1), h: item.defaultSize.h });
      ySm += item.defaultSize.h;
    });

    // Sort lgLayout to ensure consistent starting positions based on their initial y.
    // This helps in consistent layout when regenerating defaults.
    lgLayout.sort((a, b) => a.y - b.y || a.x - b.x);

    return { lg: lgLayout, md: mdLayout, sm: smLayout };
  };

  const defaultLayouts = React.useMemo(() => generateDefaultLayouts(dashboardItems), [dashboardItems]);


  const [layouts, setLayouts] = React.useState<Layouts>(() => {
    const savedLayouts = getFromLS("layouts") as Layouts | null;
    return savedLayouts || defaultLayouts;
  });

  const handleLayoutChange = (currentLayout: any, allLayouts: any) => {
    if (isEditMode) {
      setLayouts(allLayouts);
      saveToLS("layouts", allLayouts);
    }
  };

  const resetLayout = () => {
    setLayouts(defaultLayouts);
    saveToLS("layouts", defaultLayouts);
  };

  const isDraggableResizable = isEditMode && userRole === 'superadmin';

  return (
    <div className="relative">
      {isEditMode && userRole === 'superadmin' && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-content2 p-3">
          <div className="flex items-center gap-2">
            <Icon icon="lucide:move" className="text-primary" />
            <span className="text-small font-medium">
              Drag cards to rearrange your dashboard layout
            </span>
          </div>
          <Button size="sm" variant="flat" color="danger" onPress={resetLayout}>
            Reset Layout
          </Button>
        </div>
      )}

      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 1 }} // Changed xxs to 1 to ensure a minimum 1 column layout
        cols={{ lg: 4, md: 3, sm: 1, xs: 1, xxs: 1 }}
        rowHeight={150}
        isDraggable={isDraggableResizable} // Apply conditional draggable
        isResizable={isDraggableResizable} // Apply conditional resizable
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