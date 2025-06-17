// src/components/leads-table.tsx
import React from "react";
import useSWR from 'swr';
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
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Chip,
  Spinner,
  useDisclosure,
  Input,
  Select, 
  SelectItem
} from "@heroui/react";
import type { Database } from "@/types/supabase";
import LeadModal from "./lead-modal";

// TYPE DEFINITIONS
// FIX: Update the LeadData type to match the properties_with_contacts view/RPC result.
type LeadData = Database['public']['Views']['properties_with_contacts']['Row'];
type MarketRegion = { id: string; name: string };

interface LeadsTableProps {
  leads?: LeadData[]; // Prop remains the same, but the type it holds is different.
  userRole?: string; // Add userRole prop
  userId?: string;   // Add userId prop
}

// HELPER FUNCTIONS
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    throw error;
  }
  return res.json();
});

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "N/A";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Now gets a value directly from the LeadData object. No nesting needed.
const getCellValue = (lead: LeadData, key: string): any => {
    return lead[key as keyof LeadData];
}

// TABLE CONFIGURATION
// FIX: Update columns to match the fields available in the 'properties_with_contacts' view.
const columns = [
  { name: "STATUS", uid: "status", sortable: true },
  { name: "CONTACTS", uid: "contact_names", sortable: true },
  { name: "ADDRESS", uid: "property_address", sortable: true },
  { name: "REGION", uid: "market_region", sortable: true },
  { name: "MARKET VALUE", uid: "market_value", sortable: true },
  { name: "TYPE", uid: "property_type", sortable: true },
  { name: "LIST PRICE", uid: "mls_list_price", sortable: true },
  { name: "DOM", uid: "mls_days_on_market", sortable: true },
  { name: "ACTIONS", uid: "actions" },
];

const statusColorMap: { [key: string]: "primary" | "secondary" | "success" | "warning" | "danger" | "default" } = {
  "New Lead": "primary",
  "Attempted to Contact": "secondary",
  "Contacted": "secondary",
  "Working/In Progress": "default",
  "Contract Sent": "warning",
  "Qualified": "success",
  "Unqualified/Disqualified": "default",
  "Nurture": "secondary",
  "Meeting Set": "success",
  "Closed - Converted/Customer": "success",
  "Closed - Not Converted/Opportunity Lost": "danger",
};

// MAIN COMPONENT
export const LeadsTable: React.FC<LeadsTableProps> = ({ leads: propLeads, userRole, userId }) => {
  const [filterValue, setFilterValue] = React.useState("");
  const [debouncedFilterValue, setDebouncedFilterValue] = React.useState("");
  const [regionFilter, setRegionFilter] = React.useState<string>("all");

  const shouldFetchInternally = !propLeads; // Only fetch if leads are not passed as a prop
  const isSuperAdmin = userRole === 'superadmin';

  // Construct the API URL for fetching leads
  const leadsApiUrl = shouldFetchInternally ? `/api/leads?search=${debouncedFilterValue}&region=${regionFilter}${!isSuperAdmin && userId ? `&userId=${userId}` : ''}` : null;

  // This SWR call now fetches from the corrected API route
  const { data: fetchedLeads, error: swrError, isLoading: swrIsLoading, mutate } = useSWR<LeadData[]>(
    leadsApiUrl,
    fetcher
  );

  const leadsToDisplay = propLeads || fetchedLeads;
  const currentError = shouldFetchInternally ? swrError : null;
  const currentIsLoading = shouldFetchInternally ? swrIsLoading : false;

  const { data: marketRegions, isLoading: isLoadingRegions } = useSWR<MarketRegion[]>('/api/market-regions', fetcher);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilterValue(filterValue);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [filterValue]);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedPropertyId, setSelectedPropertyId] = React.useState<string | null>(null);

  const [page, setPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  const [sortDescriptor, setSortDescriptor] = React.useState({
    column: "market_value",
    direction: "descending" as "ascending" | "descending",
  });

  const items = React.useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const itemsToProcess = leadsToDisplay || [];

    const sortedLeads = [...itemsToProcess].sort((a, b) => {
      const first = getCellValue(a, sortDescriptor.column);
      const second = getCellValue(b, sortDescriptor.column);

      if (first == null && second == null) return 0;
      if (first == null) return 1;
      if (second == null) return -1;
      
      const cmp = String(first).localeCompare(String(second), undefined, { numeric: true });

      return sortDescriptor.direction === "descending" ? -cmp : cmp;
    });

    return sortedLeads.slice(start, end);
  }, [page, leadsToDisplay, rowsPerPage, sortDescriptor]);

  const onSearchChange = React.useCallback((value?: string) => {
    setFilterValue(value || "");
    setPage(1);
  }, []);
  
  const onRegionChange = React.useCallback((key: React.Key) => {
    setRegionFilter(String(key));
    setPage(1);
  }, []);


  const onClear = React.useCallback(() => {
    setFilterValue("");
    setPage(1);
  }, []);

  const handleAddLead = React.useCallback(() => {
    setSelectedPropertyId(null);
    onOpen();
  }, [onOpen]);

  const handleEditLead = React.useCallback((lead: LeadData) => {
    if (lead.property_id) {
        setSelectedPropertyId(lead.property_id);
        onOpen();
    } else {
        console.error("Cannot edit lead: property_id is missing.", lead);
    }
  }, [onOpen]);
  
  const handleCloseModal = () => {
    onClose();
    setSelectedPropertyId(null);
  };
  
  const handleSaveSuccess = () => {
    // If fetching internally, revalidate SWR cache
    if (shouldFetchInternally) {
      mutate();
    }
    handleCloseModal();
  };

  const renderCell = React.useCallback((lead: LeadData, columnKey: React.Key) => {
    const cellValue = getCellValue(lead, columnKey as string);

    switch (columnKey) {
      case "status":
        const statusKey = cellValue as keyof typeof statusColorMap;
        return <Chip className="capitalize" color={statusColorMap[statusKey] || "default"} size="sm" variant="flat">{cellValue || "N/A"}</Chip>;

      case "contact_names":
        return (
          <div className="text-xs">
            <div className="flex justify-between items-center font-medium">
              <span className="truncate">{lead.contact_names || 'N/A'}</span>
            </div>
            <div className="text-default-600 truncate">{lead.contact_emails || 'No Email'}</div>
          </div>
        );

      case "property_address":
        return (
          <div className="flex items-center gap-2">
            <Icon icon="mdi:map-marker" className="text-red-500 w-5 h-5 flex-shrink-0" />
            <div>
              <div className="font-medium">{lead.property_address || 'N/A'}</div>
              <div className="text-xs text-default-500">
                {`${lead.property_city || ''}, ${lead.property_state || ''} ${lead.property_postal_code || ''}`}
              </div>
            </div>
          </div>
        );
      
      case "market_value":
      case "mls_list_price":
        return formatCurrency(cellValue);

      case "actions":
        return (
          <div className="relative flex items-center gap-2">
            <Button isIconOnly size="sm" variant="light" onPress={() => handleEditLead(lead)}>
              <Icon icon="lucide:edit" className="text-lg text-default-500" />
            </Button>
          </div>
        );

      default:
        return cellValue === null || cellValue === undefined ? "N/A" : String(cellValue);
    }
  }, [handleEditLead]);

  const topContent = React.useMemo(() => {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between gap-3 md:items-end">
          <div className="flex flex-col md:flex-row gap-3 w-full">
            <Input
              isClearable
              className="w-full md:max-w-md"
              placeholder="Search leads..."
              startContent={<Icon icon="lucide:search" />}
              value={filterValue}
              onClear={onClear}
              onValueChange={onSearchChange}
            />
          <Select
            aria-label="Market region filter"
            placeholder="Filter by region"
            selectedKeys={new Set<string>([regionFilter])}
            onSelectionChange={(keys) => {
            const selected = (keys as Set<string | number>).values().next().value ?? "all";
            const selectedString = String(selected);
            setRegionFilter(selectedString);
            onRegionChange(selectedString);
          }}
            className="w-full md:max-w-xs"
            items={[
              { key: "all", name: "All Regions" },
              ...(marketRegions || []).map(region => ({
                key: region.name,
                name: region.name,
              })),
            ]}
          >
            {(item) => (
              <SelectItem key={item.key} textValue={item.name}>
                {item.name}
              </SelectItem>
            )}
          </Select>
          </div>
          <div className="flex gap-3">
            <Button color="primary" startContent={<Icon icon="lucide:plus" />} onPress={handleAddLead}>
              Add Lead
            </Button>
          </div>
        </div>
        <span className="text-default-400 text-small">Total {leadsToDisplay?.length || 0} leads found</span>
      </div>
    );
  }, [filterValue, onSearchChange, onClear, handleAddLead, leadsToDisplay?.length, regionFilter, onRegionChange, marketRegions]);

  const bottomContent = React.useMemo(() => {
    const totalPages = leadsToDisplay ? Math.ceil(leadsToDisplay.length / rowsPerPage) : 0;
    return (
      <div className="sticky bottom-0 z-20 bg-content1 p-4 border-t border-divider flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-default-500 text-small whitespace-nowrap">Rows per page:</span>
          <Select
             aria-label="Rows per page"
             className="w-20"
             selectedKeys={new Set([String(rowsPerPage)])}
             onSelectionChange={(keys) => {
                const value = Array.from(keys as Set<React.Key>)[0];
                setRowsPerPage(Number(value));
                setPage(1);
             }}
          >
              <SelectItem key="10">10</SelectItem>
              <SelectItem key="25">25</SelectItem>
              <SelectItem key="50">50</SelectItem>
          </Select>
        </div>
        <Pagination
          isCompact
          showControls
          showShadow
          color="primary"
          page={page}
          total={totalPages > 0 ? totalPages : 1}
          onChange={setPage}
        />
        <div className="hidden sm:flex w-[30%] justify-end gap-2">
          <Button isDisabled={page <= 1} size="sm" variant="flat" onPress={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button isDisabled={page >= totalPages} size="sm" variant="flat" onPress={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      </div>
    );
  }, [page, leadsToDisplay?.length, rowsPerPage]);

  return (
    <>
      <div className="w-full h-full flex flex-col">
        <Table
          aria-label="Leads table with server-side filtering"
          isHeaderSticky
          topContent={topContent}
          bottomContent={bottomContent}
          classNames={{
            wrapper: "flex-grow min-h-[500px]",
            base: "h-full",
            table: "min-w-full",
            thead: "sticky top-0 z-20 bg-content1",
          }}
          removeWrapper
        >
          <TableHeader columns={columns}>
            {(column) => (
              <TableColumn 
                key={column.uid} 
                align={column.uid === "actions" ? "center" : "start"}
              >
                {column.name}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody
            items={items}
            isLoading={(currentIsLoading || isLoadingRegions)}
            loadingContent={<Spinner label="Loading leads..." />}
            emptyContent={currentError ? "Error loading leads." : (debouncedFilterValue || regionFilter !== 'all' ? "No leads found matching your criteria." : "No leads to display.")}
          >
            {(item) => (
              <TableRow key={item.property_id} onClick={() => handleEditLead(item)} className="cursor-pointer hover:bg-default-50 dark:hover:bg-default-100">
                {(columnKey) => (
                  <TableCell>
                    {renderCell(item, columnKey)}
                  </TableCell>
                )}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <LeadModal
        isOpen={isOpen}
        onClose={handleCloseModal}
        propertyId={selectedPropertyId}
        onSaveSuccess={handleSaveSuccess}
      />
    </>
  );
};