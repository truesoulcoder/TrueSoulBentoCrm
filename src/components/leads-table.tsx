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
  Modal
} from "@heroui/react";
import type { Database } from "@/types/supabase";
import LeadModal from "./lead-modal";

type LeadData = Database['public']['Views']['properties_with_contacts']['Row'];

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

const columns = [
  { name: "STATUS", uid: "status", sortable: true },
  { name: "CONTACTS", uid: "contact_names", sortable: true },
  { name: "ADDRESS", uid: "property_address", sortable: true },
  { name: "REGION", uid: "market_region", sortable: true },
  { name: "MARKET VALUE", uid: "market_value", sortable: true },
  { name: "TYPE", uid: "property_type", sortable: true },
  { name: "LIST PRICE", uid: "mls_list_price", sortable: true },
  { name: "DOM", uid: "mls_days_on_market", sortable: true },
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

export const LeadsTable: React.FC = () => {
  const [filterValue, setFilterValue] = React.useState("");
  const [debouncedFilterValue, setDebouncedFilterValue] = React.useState("");

  const { data: leads, error, isLoading, mutate } = useSWR<LeadData[]>(
    `/api/leads?search=${debouncedFilterValue}`,
    fetcher
  );

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

  const [selectedKeys, setSelectedKeys] = React.useState(new Set<string>());

  const items = React.useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const itemsToProcess = leads || [];

    const sortedLeads = [...itemsToProcess].sort((a, b) => {
      const first = a[sortDescriptor.column as keyof LeadData];
      const second = b[sortDescriptor.column as keyof LeadData];

      if (first == null && second == null) return 0;
      if (first == null) return 1;
      if (second == null) return -1;

      const cmp = String(first).localeCompare(String(second), undefined, { numeric: true });
      return sortDescriptor.direction === "descending" ? -cmp : cmp;
    });

    return sortedLeads.slice(start, end);
  }, [page, leads, rowsPerPage, sortDescriptor]);

  const onSearchChange = React.useCallback((value?: string) => {
    setFilterValue(value || "");
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

  const handleEditLead = React.useCallback((propertyId: string) => {
    setSelectedPropertyId(propertyId);
    onOpen();
  }, [onOpen]);
  
  const handleCloseModal = () => {
    onClose();
    setSelectedPropertyId(null);
  };
  
  const handleSaveSuccess = () => {
      mutate();
      handleCloseModal();
  };

  const renderCell = React.useCallback((lead: LeadData, columnKey: React.Key) => {
    switch (columnKey) {
      case "status":
        const statusKey = lead.status as keyof typeof statusColorMap;
        return <Chip className="capitalize" color={statusColorMap[statusKey] || "default"} size="sm" variant="flat">{lead.status || "N/A"}</Chip>;
      case "contact_names":
        const names = lead.contact_names?.split(',').map(n => n.trim()) || [];
        const phones = lead.contact_phones?.split(',').map(p => p.trim()) || [];
        const emails = lead.contact_emails?.split(',').map(e => e.trim()) || [];
        if (names.length === 0 || names.every(name => !name)) return "No Contacts";
        return (
          <div className="text-xs space-y-2">
            {names.map((name, index) => (
              <div key={index}>
                <div className="flex justify-between items-center font-medium">
                  <span className="truncate">{name || 'N/A'}</span>
                  <span className="text-default-500 ml-2 whitespace-nowrap">{phones[index] || ''}</span>
                </div>
                <div className="text-default-600 truncate">{emails[index] || ''}</div>
              </div>
            ))}
          </div>
        );
      case "property_address":
        return (
          <div className="flex items-center gap-2">
            <Icon icon="mdi:map-marker" className="text-red-500 w-5 h-5 flex-shrink-0" />
            <div>
              <div className="font-medium">{lead.property_address}</div>
              <div className="text-xs text-default-500">{`${lead.property_city}, ${lead.property_state} ${lead.property_postal_code}`}</div>
            </div>
          </div>
        );
      case "market_value":
        return formatCurrency(lead.market_value);
      case "mls_list_price":
        return formatCurrency(lead.mls_list_price);
      default:
        const value = lead[columnKey as keyof LeadData];
        return value === null || value === undefined ? "N/A" : String(value);
    }
  }, []);

  const topContent = React.useMemo(() => {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-between gap-3 items-end">
          <Input
            isClearable
            className="w-full sm:max-w-[44%]"
            placeholder="Search all leads..."
            startContent={<Icon icon="lucide:search" />}
            value={filterValue}
            onClear={onClear}
            onValueChange={onSearchChange}
          />
          <div className="flex gap-3">
            <Button color="primary" startContent={<Icon icon="lucide:plus" />} onPress={handleAddLead}>
              Add Lead
            </Button>
          </div>
        </div>
        <span className="text-default-400 text-small">Total {leads?.length || 0} leads found</span>
      </div>
    );
  }, [filterValue, onSearchChange, onClear, handleAddLead, leads?.length]);

  const bottomContent = React.useMemo(() => {
    const totalPages = leads ? Math.ceil(leads.length / rowsPerPage) : 0;
    return (
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 py-2">
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
  }, [page, leads?.length, rowsPerPage]);

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
            // Added styles for sticky header and footer
            thead: "sticky top-0 z-20 bg-content1",
            bottomContent: "sticky bottom-0 z-20 bg-content1 p-4 border-t border-divider",
          }}
          removeWrapper
        >
          <TableHeader columns={columns}>
            {(column) => (<TableColumn key={column.uid} align={column.uid === "actions" ? "center" : "start"} allowsSorting={column.sortable}>{column.name}</TableColumn>)}
          </TableHeader>
          <TableBody
            items={items}
            isLoading={isLoading}
            loadingContent={<Spinner label="Loading leads..." />}
            emptyContent={debouncedFilterValue ? "No leads found matching your search." : "No leads to display."}
          >
            {(item) => (
              <TableRow key={item.property_id} onPress={() => handleEditLead(item.property_id!)} className="cursor-pointer hover:bg-default-50 dark:hover:bg-default-100">
                {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
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