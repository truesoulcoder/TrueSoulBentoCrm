// src/components/leads-table.tsx
import React, { useEffect } from "react";
import useSWR, { mutate } from 'swr';
import { Icon } from "@iconify/react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  Button,
  Chip,
  Spinner,
  useDisclosure,
  Input,
  Select,
  SelectItem
} from "@heroui/react";
import type { Database } from "@/types/supabase";
import LeadModal from "./lead-modal";

type LeadData = Omit<Database['public']['Views']['properties_with_contacts']['Row'], 'campaign_id'>;
type MarketRegion = { id: string; name: string };

interface LeadsTableProps {
  initialLeads: LeadData[];
  initialMarketRegions: MarketRegion[];
  userRole?: string;
  userId?: string;
  refreshKey?: number;
}

// HELPER FUNCTIONS
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    throw error;
  }
  return res.json();
});

export const LeadsTable: React.FC<LeadsTableProps> = ({
  initialLeads,
  initialMarketRegions,
  userRole,
  userId,
  refreshKey = 0,
}) => {
  const [filterValue, setFilterValue] = React.useState("");
  const [debouncedFilterValue, setDebouncedFilterValue] = React.useState("");
  const [regionFilter, setRegionFilter] = React.useState<string>("all");

  const isSuperAdmin = userRole === 'superadmin';

  const leadsApiUrl = `/api/leads?search=${debouncedFilterValue}&region=${regionFilter}${!isSuperAdmin && userId ? `&userId=${userId}` : ''}`;

  // SWR data fetch with refreshKey as part of the key
  const { data: leads, error, mutate: mutateLeads } = useSWR([leadsApiUrl, refreshKey], ([url]) => fetcher(url), {
    fallbackData: initialLeads,
    revalidateOnFocus: true,
  });

  // Refetch when refreshKey changes
  useEffect(() => {
    mutateLeads();
  }, [refreshKey, mutateLeads]);

  // ...rest of the component logic (table rendering, etc.)...

  return (
    <div>
      {/* Render your leads table using the `leads` array */}
      {/* ... */}
    </div>
  );
};