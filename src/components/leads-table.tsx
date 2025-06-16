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
  Tooltip,
  Chip,
  Spinner,
  useDisclosure,
  Input,
  Modal,
  Select, 
  SelectItem
} from "@heroui/react";
import type { Database } from "@/types/supabase";
import LeadModal from "./lead-modal";

// TYPE DEFINITIONS
type LeadData = Database['public']['Tables']['campaign_leads']['Row'] & {
  properties?: Database['public']['Tables']['properties']['Row'] | null;
};

type MarketRegion = { id: string; name: string };

interface LeadsTableProps {
  leads?: LeadData[]; // Optional leads prop
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

// New helper to safely access nested properties
const getCellValue = (lead: LeadData, key: string): any => {
    if (key.startsWith('properties.')) {
        const propKey = key.substring(11); // "properties.".length
        return lead.properties?.[propKey as keyof typeof lead.properties];
    }
    return lead[key as keyof LeadData];
}

// TABLE CONFIGURATION
const columns = [
  { name: "STATUS", uid: "status", sortable: true },
  { name: "CONTACTS", uid: "contact_name", sortable: true },
  { name: "ADDRESS", uid: "properties.property_address", sortable: true },
  { name: "REGION", uid: "properties.market_region", sortable: true },
  { name: "MARKET VALUE", uid: "properties.market_value", sortable: true },
  { name: "TYPE", uid: "properties.property_type", sortable: true },
  { name: "LIST PRICE", uid: "properties.mls_list_price", sortable: true },
  { name: "DOM", uid: "properties.mls_days_on_market", sortable: true },
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
export const LeadsTable: React.FC<LeadsTableProps> = ({ leads: propLeads }) => {
  const [filterValue, setFilterValue] = React.useState("");
  const [debouncedFilterValue, setDebouncedFilterValue] = React.useState("");
  const [regionFilter, setRegionFilter] = React.useState("all");

  const shouldFetchInternally = !propLeads;

  const { data: fetchedLeads, error: swrError, isLoading: swrIsLoading, mutate } = useSWR<LeadData[]>(
    shouldFetchInternally ? `/api/leads?search=${debouncedFilterValue}&region=${regionFilter}` : null,
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
    column: "properties.market_value",
    direction: "descending" as "ascending" | "descending",
  });

  const [selectedKeys, setSelectedKeys] = React.useState(new Set<string>());

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
  
  type ComponentSelection = Set<React.Key> | "all";

  const onRegionChange = React.useCallback((keys: ComponentSelection) => {
    let newRegionFilter = "all"; 

    if (keys instanceof Set) {
      if (keys.size > 0) {
        const selectedKey = Array.from(keys)[0]; 
        newRegionFilter = String(selectedKey);
      }
    } else if (typeof keys === 'string' && keys === 'all') {
      newRegionFilter = "all";
    }

    setRegionFilter(newRegionFilter);
    setPage(1); 
  }, [setRegionFilter, setPage]);


  const onClear = React.useCallback(() => {
    setFilterValue("");
    setPage(1);
  }, []);

  const handleAddLead = React.useCallback(() => {
    setSelectedPropertyId(null);
    onOpen();
  }, [onOpen]);

  const handleEditLead = React.useCallback((lead: LeadData) => {
    // We need the property_id from the nested properties object
    const propId = lead.properties?.property_id;
    if (propId) {
        setSelectedPropertyId(propId);
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
    if (shouldFetchInternally && mutate) {
      mutate();
    }
    handleCloseModal();
  };

  const renderCell = React.useCallback((lead: LeadData, columnKey: React.Key) => {
    const value = getCellValue(lead, columnKey as string);

    switch (columnKey) {
      case "status":
        const statusKey = value as keyof typeof statusColorMap;
        return <Chip className="capitalize" color={statusColorMap[statusKey] || "default"} size="sm" variant="flat">{value || "N/A"}</Chip>;

      case "contact_name":
        return (
          <div className="text-xs">
            <div className="flex justify-between items-center font-medium">
              <span className="truncate">{value || 'N/A'}</span>
            </div>
            <div className="text-default-600 truncate">{lead.contact_email || 'No Email'}</div>
          </div>
        );

      case "properties.property_address":
        const property = lead.properties;
        if (!property) return "N/A";
        return (
          <div className="flex items-center gap-2">
            <Icon icon="mdi:map-marker" className="text-red-500 w-5 h-5 flex-shrink-0" />
            <div>
              <div className="font-medium">{property.property_address || 'N/A'}</div>
              <div className="text-xs text-default-500">
                {`${property.property_city || ''}, ${property.property_state || ''} ${property.property_postal_code || ''}`}
              </div>
            </div>
          </div>
        );
      
      case "properties.market_value":
      case "properties.mls_list_price":
        return formatCurrency(value);

      default:
        return value === null || value === undefined ? "N/A" : String(value);
    }
  }, []);

  const topContent = React.useMemo(() => {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between gap-3 md:items-end">
          <div className="flex flex-col md:flex-row gap-3 w-full">
            <Input
              isClearable
              className="w-full md:max-w-md"
              placeholder="Search all leads..."
              startContent={<Icon icon="lucide:search" />}
              value={filterValue}
              onClear={onClear}
              onValueChange={onSearchChange}
            />
            <Select
              aria-label="Market region filter"
              placeholder="Filter by region"
              selectedKeys={[regionFilter]} 
              onSelectionChange={onRegionChange} 
              className="w-full md:max-w-xs"
              items={React.useMemo(() => [
                { key: "all", name: "All Regions" }, 
                ...(marketRegions || []).map(region => ({ key: region.name, name: region.name })) 
              ], [marketRegions])}
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
          <Dropdown>
            <DropdownTrigger>
              <Button variant="flat" size="sm" className="text-default-500">
                {rowsPerPage}
                <Icon icon="lucide:chevron-down" className="text-small ml-2" />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              disallowEmptySelection
              aria-label="Rows per page"
              selectionMode="single"
              selectedKeys={new Set([rowsPerPage.toString()])}
              onSelectionChange={(keys) => {
                const value = Array.from(keys as Set<React.Key>)[0];
                setRowsPerPage(Number(value));
                setPage(1);
              }}
            >
              <DropdownItem key="10">10</DropdownItem>
              <DropdownItem key="25">25</DropdownItem>
              <DropdownItem key="50">50</DropdownItem>
            </DropdownMenu>
          </Dropdown>
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
          selectionMode="multiple"
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys as any}
          onSortChange={setSortDescriptor as any}
          sortDescriptor={sortDescriptor as any}
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
                align="start"
                allowsSorting={column.sortable}
              >
                {column.name}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody
            items={items}
            isLoading={(currentIsLoading || isLoadingRegions) && !leadsToDisplay}
            loadingContent={<Spinner label="Loading leads..." />}
            emptyContent={currentError ? "Error loading leads." : (debouncedFilterValue ? "No leads found matching your search." : "No leads to display.")}
          >
            {(item) => (
              <TableRow key={item.id} onClick={() => handleEditLead(item)} className="cursor-pointer hover:bg-default-50 dark:hover:bg-default-100">
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