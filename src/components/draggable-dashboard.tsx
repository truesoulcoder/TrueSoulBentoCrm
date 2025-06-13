// src/components/draggable-dashboard.tsx
import React from "react";
import { Icon } from "@iconify/react";
import { Card, CardHeader, CardBody, Button } from "@heroui/react";
import { Responsive, WidthProvider } from "react-grid-layout";
import { CampaignChart } from "./campaign-chart";
import { CampaignConsole } from "./campaign-console";
import { CampaignStatus } from "./campaign-status";
import { CampaignEngineManager } from "./campaign-engine-manager"; // Import the new component
import { TemplatePreview } from "./template-preview";
import { CampaignSettings } from "./campaign-settings";
import { LeadsTable } from "./leads-table";
import { LeadsUpload } from "./leads-upload";

// Fix CSS imports for react-grid-layout
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
}

type LayoutItem = { i: string; x: number; y: number; w: number; h: number };
type Layouts = Record<string, LayoutItem[]>;

export const DraggableDashboard: React.FC<DraggableDashboardProps> = ({
  isRunning,
  isPaused,
  currentCampaign,
  isEditMode,
}) => {
  const dashboardItems: DashboardItem[] = [
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
      i: "engine-manager", // Replaced "emails" with "engine-manager"
      title: "Engine Control",
      subtitle: "Manage campaign state",
      component: <CampaignEngineManager />, // Use the new component
      defaultSize: { w: 1, h: 2 },
      minSize: { w: 1, h: 2 },
    },
    {
      i: "console",
      title: "Console Log",
      subtitle: "Real-time campaign updates",
      component: <CampaignConsole isRunning={isRunning} isPaused={isPaused} />,
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 1, h: 2 },
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
      i: "leads",
      title: "Campaign Leads",
      subtitle: "Manage your campaign leads",
      component: <LeadsTable />,
      defaultSize: { w: 4, h: 4 }, 
      minSize: { w: 4, h: 3 },
    },
  ];

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

  const defaultLayouts: Layouts = {
    lg: [
      { i: "leads", x: 0, y: 0, w: 4, h: 4 },
      { i: "status", x: 0, y: 4, w: 1, h: 2 },
      { i: "chart", x: 1, y: 4, w: 2, h: 2 },
      { i: "engine-manager", x: 3, y: 4, w: 1, h: 2 }, // Updated key
      { i: "console", x: 0, y: 6, w: 2, h: 2 },
      { i: "leads-upload", x: 2, y: 6, w: 2, h: 2 },
      { i: "template", x: 0, y: 8, w: 2, h: 2 },
      { i: "settings", x: 2, y: 8, w: 2, h: 2 },
    ],
    md: [
      { i: "leads", x: 0, y: 0, w: 3, h: 4 },
      { i: "status", x: 0, y: 4, w: 1, h: 2 },
      { i: "chart", x: 1, y: 4, w: 2, h: 2 },
      { i: "engine-manager", x: 0, y: 6, w: 1, h: 2 }, // Updated key
      { i: "console", x: 1, y: 6, w: 2, h: 2 },
      { i: "leads-upload", x: 0, y: 8, w: 2, h: 2 },
      { i: "template", x: 0, y: 10, w: 3, h: 2 },
      { i: "settings", x: 0, y: 12, w: 3, h: 2 },
    ],
    sm: [
      { i: "leads", x: 0, y: 0, w: 1, h: 4 },
      { i: "status", x: 0, y: 4, w: 1, h: 2 },
      { i: "chart", x: 0, y: 6, w: 1, h: 2 },
      { i: "engine-manager", x: 0, y: 8, w: 1, h: 2 }, // Updated key
      { i: "console", x: 0, y: 10, w: 1, h: 2 },
      { i: "leads-upload", x: 0, y: 12, w: 1, h: 2 },
      { i: "template", x: 0, y: 14, w: 1, h: 2 },
      { i: "settings", x: 0, y: 16, w: 1, h: 2 },
    ],
  };

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

  return (
    <div className="relative">
      {isEditMode && (
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
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 4, md: 3, sm: 1, xs: 1, xxs: 1 }}
        rowHeight={150}
        isDraggable={isEditMode}
        isResizable={isEditMode}
        onLayoutChange={handleLayoutChange}
        margin={[16, 16]}
        measureBeforeMount={false}
        useCSSTransforms={true}
      >
        {dashboardItems.map((item) => (
          <div key={item.i}>
            <Card className="h-full transition-all duration-200">
              {isEditMode && (
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