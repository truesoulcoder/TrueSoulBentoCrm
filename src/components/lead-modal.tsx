// src/components/lead-modal.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Select,
  SelectItem,
  Textarea,
  Divider,
  Button,
  Spinner,
  ScrollShadow
} from '@heroui/react';
import { Icon } from '@iconify/react';
import StreetViewMap from '@/components/maps/StreetViewMap';
import { getLeadDetails, saveLead, deleteLead } from '@/actions/lead-actions';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';

// Define types for convenience
type Property = Tables<'properties'>;
type Contact = Tables<'contacts'>;

// --- Constants (aligned with supabase types and concept) ---
const LEAD_STATUS_OPTIONS = [
  "New Lead", "Attempted to Contact", "Contacted", "Working/In Progress",
  "Contract Sent", "Qualified", "Unqualified/Disqualified", "Nurture",
  "Meeting Set", "Closed - Converted/Customer", "Closed - Not Converted/Opportunity Lost"
];
// NOTE: Using roles from your supabase.ts enum. Update if concept is preferred and DB is changed.
const CONTACT_ROLE_OPTIONS: Tables<'contacts'>['role'][] = ["owner", "alternate_contact", "mls_agent"];
const PROPERTY_TYPE_OPTIONS = ["Single Family", "Condo", "Townhouse", "Multi-Family", "Vacant Land"];
const MLS_STATUS_OPTIONS = ["Active", "Pending", "Sold", "Expired", "Withdrawn"];


// --- Helper to provide an empty initial state ---
const getInitialPropertyState = (): TablesUpdate<'properties'> => ({
  property_id: undefined, // Ensure it's not present for inserts
  status: 'New Lead',
  property_address: '',
  property_city: '',
  property_state: '',
  property_postal_code: '',
  market_region: '',
  property_type: 'Single Family',
  square_footage: null,
  lot_size_sqft: null,
  beds: null,
  baths: null,
  year_built: null,
  market_value: null,
  wholesale_value: null,
  assessed_total: null,
  notes: '',
  mls_status: null,
  mls_days_on_market: null,
  mls_list_price: null,
  mls_sqft: null,
  mls_beds: null,
  mls_baths: null,
  mls_year_built: null,
  user_id: '', // This will be set on the server for new leads
});

const getInitialContactState = (): TablesUpdate<'contacts'> => ({
    contact_id: undefined,
    name: '',
    email: '',
    phone: '',
    role: 'owner',
});


export interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string | null;
  onSaveSuccess: () => void;
}

const LeadModal: React.FC<LeadModalProps> = ({
  isOpen,
  onClose,
  propertyId,
  onSaveSuccess,
}) => {
  const [property, setProperty] = useState<TablesUpdate<'properties'>>(getInitialPropertyState());
  const [contacts, setContacts] = useState<TablesUpdate<'contacts'>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isNewLead = !propertyId;

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (isNewLead) {
        setProperty(getInitialPropertyState());
        setContacts([getInitialContactState()]);
      } else {
        const fetchLeadData = async () => {
          setIsLoading(true);
          const leadDetails = await getLeadDetails(propertyId);
          if (leadDetails) {
            setProperty(leadDetails.property);
            setContacts(leadDetails.contacts);
          } else {
            setError("Failed to load lead data. The lead may have been deleted.");
          }
          setIsLoading(false);
        };
        fetchLeadData();
      }
    }
  }, [isOpen, propertyId, isNewLead]);

  const handlePropertyChange = useCallback((name: string, value: any) => {
    setProperty(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleContactChange = useCallback((index: number, name: string, value: any) => {
    setContacts(prev => {
      const newContacts = [...prev];
      newContacts[index] = { ...newContacts[index], [name]: value };
      return newContacts;
    });
  }, []);

  const addContact = useCallback(() => {
    setContacts(prev => [...prev, getInitialContactState()]);
  }, []);

  const removeContact = useCallback((index: number) => {
    setContacts(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    // Filter out empty contacts before saving
    const validContacts = contacts.filter(c => c.name || c.email || c.phone);
    
    const result = await saveLead({ property, contacts: validContacts });
    
    if (result.error) {
      setError(result.error);
    } else {
      onSaveSuccess();
    }
    setIsSaving(false);
  };
  
  const handleDelete = async () => {
    if (!propertyId) return;

    const confirmed = window.confirm("Are you sure you want to permanently delete this lead and all associated contacts?");
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);
    const result = await deleteLead(propertyId);
    if (result.error) {
      setError(result.error);
    } else {
      onSaveSuccess();
    }
    setIsDeleting(false);
  };

  const fullAddress = `${property.property_address || ''}, ${property.property_city || ''}, ${property.property_state || ''} ${property.property_postal_code || ''}`.trim();

  const modalTitle = isNewLead ? "Add New Lead" : "Edit Lead";

  return (
    <Modal size="5xl" isOpen={isOpen} onClose={onClose} scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">{modalTitle}</ModalHeader>
        <ModalBody>
          {isLoading ? (
            <div className="flex justify-center items-center h-96">
              <Spinner label="Loading Lead Data..." />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Property Info Section */}
              <div>
                <h2 className="text-gray-500 dark:text-gray-400 uppercase tracking-widest text-sm font-bold mb-4">Property Info</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  {/* Left Column */}
                  <div className="flex flex-col space-y-4">
                    <Select label="Lead Status" selectedKeys={property.status ? [property.status] : []} onSelectionChange={keys => handlePropertyChange('status', Array.from(keys)[0] ?? '')}>
                      {LEAD_STATUS_OPTIONS.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                    </Select>
                    <Input label="Property Address" value={property.property_address || ''} onValueChange={v => handlePropertyChange('property_address', v)} />
                    <div className="grid grid-cols-6 gap-4">
                      <Input label="City" value={property.property_city || ''} onValueChange={v => handlePropertyChange('property_city', v)} className="col-span-3" />
                      <Input label="State" maxLength={2} value={property.property_state || ''} onValueChange={v => handlePropertyChange('property_state', v)} className="col-span-1" />
                      <Input label="Postal Code" value={property.property_postal_code || ''} onValueChange={v => handlePropertyChange('property_postal_code', v)} className="col-span-2" />
                    </div>
                    <div className="grid grid-cols-6 gap-4">
                      {property.property_type === 'Vacant Land' ? (
                        <Input label="Lot Size (sqft)" type="number" value={String(property.lot_size_sqft || '')} onValueChange={v => handlePropertyChange('lot_size_sqft', v)} className="col-span-2" />
                      ) : (
                        <Input label="Square Footage" type="number" value={String(property.square_footage || '')} onValueChange={v => handlePropertyChange('square_footage', v)} className="col-span-2" />
                      )}
                      <Input label="Beds" type="number" value={String(property.beds || '')} onValueChange={v => handlePropertyChange('beds', v)} className="col-span-1" />
                      <Input label="Baths" type="number" step="0.1" value={String(property.baths || '')} onValueChange={v => handlePropertyChange('baths', v)} className="col-span-1" />
                      <Input label="Year Built" type="number" value={String(property.year_built || '')} onValueChange={v => handlePropertyChange('year_built', v)} className="col-span-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Market Value" type="number" startContent="$" value={String(property.market_value || '')} onValueChange={v => handlePropertyChange('market_value', v)} />
                      <Input label="Wholesale Value" type="number" startContent="$" value={String(property.wholesale_value || '')} onValueChange={v => handlePropertyChange('wholesale_value', v)} />
                    </div>
                    <Input label="Assessed Total" type="number" startContent="$" value={String(property.assessed_total || '')} onValueChange={v => handlePropertyChange('assessed_total', v)} />
                  </div>

                  {/* Right Column */}
                  <div className="flex flex-col space-y-4">
                    <Input label="Market Region" value={property.market_region || ''} onValueChange={v => handlePropertyChange('market_region', v)} />
                    <Select label="Property Type" selectedKeys={property.property_type ? [property.property_type] : []} onSelectionChange={keys => handlePropertyChange('property_type', Array.from(keys)[0] ?? '')}>
                      {PROPERTY_TYPE_OPTIONS.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                    </Select>
                    
                    {/* StreetView or MLS */}
                    {fullAddress.length > 5 ? (
                         <div className="h-64 w-full rounded-lg overflow-hidden">
                            <StreetViewMap apiKey={process.env.NEXT_PUBLIC_Maps_API_KEY!} address={fullAddress} />
                         </div>
                    ) : (
                         <div className="p-4 border border-dashed border-default-400 dark:border-default-500 rounded-lg space-y-4 mt-2">
                            <h3 className="text-sm font-semibold text-default-600 dark:text-default-300 -mt-1">MLS Info</h3>
                            <div className="grid grid-cols-5 gap-4">
                                <Select label="MLS Status" selectedKeys={property.mls_status ? [property.mls_status] : []} onSelectionChange={keys => handlePropertyChange('mls_status', Array.from(keys)[0] ?? '')} className="col-span-2">
                                {MLS_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </Select>
                                <Input label="MLS DOM" type="number" value={String(property.mls_days_on_market || '')} onValueChange={v => handlePropertyChange('mls_days_on_market', v)} className="col-span-1" />
                                <Input label="MLS List Price" type="number" startContent="$" value={String(property.mls_list_price || '')} onValueChange={v => handlePropertyChange('mls_list_price', v)} className="col-span-2" />
                            </div>
                         </div>
                    )}
                  </div>
                </div>
              </div>

              <Divider />

              {/* Contact Info Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-gray-500 dark:text-gray-400 uppercase tracking-widest text-sm font-bold">Contact Info</h2>
                  <Button size="sm" variant="flat" onPress={addContact} startContent={<Icon icon="lucide:plus" className="w-4 h-4" />}>
                    Add Contact
                  </Button>
                </div>
                <ScrollShadow className="max-h-[300px] pr-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {contacts.map((c, i) => (
                    <div key={i} className="space-y-4 p-4 border border-default-300 dark:border-default-700 rounded-lg relative">
                      {contacts.length > 1 && (
                        <Button isIconOnly variant="light" size="sm" className="!absolute top-1 right-1 h-8 w-8 p-0" onPress={() => removeContact(i)}>
                          <Icon icon="lucide:x" className="w-4 h-4 text-gray-500" />
                        </Button>
                      )}
                      <Input label="Contact Name" value={c.name || ''} onValueChange={v => handleContactChange(i, 'name', v)} />
                      <Input label="Email" type="email" value={c.email || ''} onValueChange={v => handleContactChange(i, 'email', v)} />
                      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                        <Input label="Phone" value={c.phone || ''} onValueChange={v => handleContactChange(i, 'phone', v)} className="w-full" />
                        <Select label="Role" selectedKeys={c.role ? [c.role] : []} onSelectionChange={keys => handleContactChange(i, 'role', Array.from(keys)[0] ?? '')} className="w-full">
                          {CONTACT_ROLE_OPTIONS.map(role => <SelectItem key={role} value={role || ''}>{role}</SelectItem>)}
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
                </ScrollShadow>
              </div>

              <Divider />

              {/* Notes Section */}
              <div>
                <h2 className="text-gray-500 dark:text-gray-400 uppercase tracking-widest text-sm font-bold mb-4">Notes</h2>
                <Textarea label="Notes" minRows={6} value={property.notes || ''} onValueChange={v => handlePropertyChange('notes', v)} />
              </div>

            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <div className="flex w-full justify-between items-center">
            <div>
              {!isNewLead && (
                <Button color="danger" variant="light" onPress={handleDelete} isLoading={isDeleting}>
                  {isDeleting ? 'Deleting...' : 'Delete Lead'}
                </Button>
              )}
            </div>
            <div className="flex items-center space-x-2">
                {error && <p className="text-danger text-sm">{error}</p>}
                <Button variant="flat" onPress={onClose}>Cancel</Button>
                <Button color="primary" onPress={handleSave} isLoading={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default LeadModal;