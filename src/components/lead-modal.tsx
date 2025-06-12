// src/components/lead-modal.tsx
'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Textarea,
  Divider,
  Spinner,
} from "@heroui/react";
import { Icon } from '@iconify/react';
import { useSWRConfig } from 'swr';
import StreetViewMap from './maps/StreetViewMap';
import { getLeadDetails, saveLead, deleteLead, type Property, type Contact } from '@/actions/lead-actions';
import type { TablesInsert, TablesUpdate, Enums } from '@/types/supabase';

// Define the available lead statuses from the database schema
const LEAD_STATUS_OPTIONS: Enums<'lead_status'>[] = [
  "New Lead", "Attempted to Contact", "Contacted", "Working/In Progress", 
  "Contract Sent", "Qualified", "Unqualified/Disqualified", "Nurture",
  "Meeting Set", "Closed - Converted/Customer", "Closed - Not Converted/Opportunity Lost"
];

const CONTACT_ROLE_OPTIONS: Enums<'contact_role'>[] = ["owner", "alternate_contact", "mls_agent"];

const newPropertyTemplate: TablesInsert<'properties'> = {
  property_id: '', status: 'New Lead', property_address: '', property_city: '',
  property_state: '', property_postal_code: '', market_region: '', market_value: null,
  assessed_total: null, year_built: null, beds: null, baths: null,
  square_footage: null, lot_size_sqft: null, mls_list_price: null,
  mls_days_on_market: null, property_type: null, notes: null,
  user_id: '', // This will be set on the server
};

const newContactTemplate: TablesInsert<'contacts'> = {
  contact_id: '', name: '', email: '', phone: '', role: 'owner', property_id: '', user_id: '',
};

interface LeadModalProps {
  propertyId: string | null; // null for a new lead
  isOpen: boolean;
  onClose: () => void;
}

export const LeadModal: React.FC<LeadModalProps> = ({ propertyId, isOpen, onClose }) => {
  const [property, setProperty] = useState<TablesInsert<'properties'> | TablesUpdate<'properties'>>(newPropertyTemplate);
  const [contacts, setContacts] = useState<(TablesInsert<'contacts'> | TablesUpdate<'contacts'>)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isSaving, startSaveTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  
  const { mutate } = useSWRConfig();

  const loadLeadData = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    const data = await getLeadDetails(id);
    if (data) {
      setProperty(data.property);
      // Ensure at least one contact card is shown, even if none exist
      setContacts(data.contacts.length > 0 ? data.contacts : [{...newContactTemplate}]);
    } else {
      setError('Failed to load lead data.');
      onClose();
    }
    setIsLoading(false);
  }, [onClose]);

  useEffect(() => {
    if (isOpen && propertyId) {
      loadLeadData(propertyId);
    } else if (isOpen && !propertyId) {
      setProperty(newPropertyTemplate);
      setContacts([{...newContactTemplate}]);
      setError(null);
    }
  }, [isOpen, propertyId, loadLeadData]);

  const handlePropertyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProperty(prev => ({ ...prev, [name]: value === '' ? null : value }));
  };

  const handleSelectChange = (name: keyof Property, value: string) => {
    setProperty(prev => ({ ...prev, [name]: value }));
  };
  
  const handleContactChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const newContacts = [...contacts];
    newContacts[index] = { ...newContacts[index], [name]: value };
    setContacts(newContacts);
  };
  
  const handleContactSelectChange = (index: number, name: keyof Contact, value: string) => {
    const newContacts = [...contacts];
    newContacts[index] = { ...newContacts[index], [name]: value };
    setContacts(newContacts);
  };

  const addContact = () => {
    setContacts(prev => [...prev, {...newContactTemplate, contact_id: `new_${Date.now()}`}]);
  };
  
  const removeContact = (index: number) => {
    setContacts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    startSaveTransition(async () => {
      setError(null);
      const result = await saveLead({ property, contacts });
      if (result.error) {
        setError(result.error);
      } else {
        await mutate('/api/leads');
        onClose();
      }
    });
  };

  const handleDelete = async () => {
    if (!propertyId || !window.confirm('Are you sure you want to permanently delete this lead?')) {
      return;
    }
    startDeleteTransition(async () => {
      setError(null);
      const result = await deleteLead(propertyId);
      if (result.error) {
        setError(result.error);
      } else {
        await mutate('/api/leads');
        onClose();
      }
    });
  };

  const fullAddress = `${property.property_address || ''}, ${property.property_city || ''}, ${property.property_state || ''} ${property.property_postal_code || ''}`;
  const modalHeader = propertyId ? fullAddress : 'Create New Lead';

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose} size="5xl" scrollBehavior="inside">
      <ModalContent className="text-foreground bg-content1">
        <ModalHeader className="flex items-start justify-between text-xl font-semibold border-b border-divider">
          <div className="flex items-center gap-2">
            <Icon icon="lucide:home" className="w-6 h-6" />
            <span>{modalHeader}</span>
          </div>
        </ModalHeader>
        <ModalBody className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-96"><Spinner label="Loading Lead..." /></div>
          ) : (
            <>
              <div className="h-64 bg-content2">
                <StreetViewMap address={fullAddress} />
              </div>
              <div className="p-6 space-y-6">
                {/* Property Details */}
                <h3 className="text-lg font-semibold text-foreground">Property Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Input name="property_address" placeholder="Property Address" value={property.property_address || ''} onValueChange={(v) => handlePropertyChange({target: {name: 'property_address', value: v}} as any)} className="col-span-2" />
                  <Input name="property_city" placeholder="City" value={property.property_city || ''} onValueChange={(v) => handlePropertyChange({target: {name: 'property_city', value: v}} as any)} />
                  <Input name="property_state" placeholder="State" value={property.property_state || ''} onValueChange={(v) => handlePropertyChange({target: {name: 'property_state', value: v}} as any)} maxLength={2} />
                  <Input name="property_postal_code" placeholder="Postal Code" value={property.property_postal_code || ''} onValueChange={(v) => handlePropertyChange({target: {name: 'property_postal_code', value: v}} as any)} maxLength={10} />
                  <Select labelPlacement="inside" placeholder="Lead Status" selectedKeys={property.status ? [property.status] : []} onSelectionChange={(keys) => handleSelectChange('status', Array.from(keys)[0] as string)} className="col-span-2">
                    {LEAD_STATUS_OPTIONS.map(s => <SelectItem key={s}>{s}</SelectItem>)}
                  </Select>
                  <Input name="market_region" placeholder="Market Region" value={property.market_region || ''} onValueChange={(v) => handlePropertyChange({target: {name: 'market_region', value: v}} as any)} />
                  <Input name="property_type" placeholder="Property Type" value={property.property_type || ''} onValueChange={(v) => handlePropertyChange({target: {name: 'property_type', value: v}} as any)} />
                  <Input name="market_value" placeholder="Market Value" type="number" startContent="$" value={String(property.market_value ?? '')} onValueChange={(v) => handlePropertyChange({target: {name: 'market_value', value: v}} as any)} />
                  <Input name="assessed_total" placeholder="Assessed Total" type="number" startContent="$" value={String(property.assessed_total ?? '')} onValueChange={(v) => handlePropertyChange({target: {name: 'assessed_total', value: v}} as any)} />
                  <Input name="mls_list_price" placeholder="MLS List Price" type="number" startContent="$" value={String(property.mls_list_price ?? '')} onValueChange={(v) => handlePropertyChange({target: {name: 'mls_list_price', value: v}} as any)} />
                  <Input name="mls_days_on_market" placeholder="Days on Market" type="number" value={String(property.mls_days_on_market ?? '')} onValueChange={(v) => handlePropertyChange({target: {name: 'mls_days_on_market', value: v}} as any)} />
                  <Input name="year_built" placeholder="Year Built" type="number" value={String(property.year_built ?? '')} onValueChange={(v) => handlePropertyChange({target: {name: 'year_built', value: v}} as any)} />
                  <Input name="beds" placeholder="Beds" type="number" value={String(property.beds ?? '')} onValueChange={(v) => handlePropertyChange({target: {name: 'beds', value: v}} as any)} />
                  <Input name="baths" placeholder="Baths" type="number" step="0.5" value={String(property.baths ?? '')} onValueChange={(v) => handlePropertyChange({target: {name: 'baths', value: v}} as any)} />
                  <Input name="square_footage" placeholder="Square Footage" type="number" value={String(property.square_footage ?? '')} onValueChange={(v) => handlePropertyChange({target: {name: 'square_footage', value: v}} as any)} />
                  <Input name="lot_size_sqft" placeholder="Lot Size (sqft)" type="number" value={String(property.lot_size_sqft ?? '')} onValueChange={(v) => handlePropertyChange({target: {name: 'lot_size_sqft', value: v}} as any)} className="col-span-1" />
                </div>
                
                <Divider />
                
                {/* Contact Details */}
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-foreground">Contact Details</h3>
                    <Button size="sm" color="primary" variant="flat" startContent={<Icon icon="lucide:plus" />} onPress={addContact}>
                        Add Contact
                    </Button>
                </div>
                <div className="space-y-4">
                    {contacts.map((contact, index) => (
                        <div key={contact.contact_id || index} className="p-4 border border-divider rounded-md space-y-3 relative">
                             <Button isIconOnly size="sm" color="danger" variant="light" className="absolute top-2 right-2" onPress={() => removeContact(index)}>
                                <Icon icon="lucide:x" />
                            </Button>
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input name="name" placeholder="Contact Name" value={contact.name || ''} onChange={(e) => handleContactChange(index, e)} className="col-span-3 md:col-span-1" />
                            <Select labelPlacement="inside" placeholder="Role" selectedKeys={contact.role ? [contact.role] : []} onChange={(e) => handleContactSelectChange(index, 'role', e.target.value)} className="col-span-3 md:col-span-1">
                                {CONTACT_ROLE_OPTIONS.map(r => <SelectItem key={r}>{r.charAt(0).toUpperCase() + r.slice(1).replace('_', ' ')}</SelectItem>)}
                            </Select>
                            <Input name="phone" placeholder="Phone Number" value={contact.phone || ''} onChange={(e) => handleContactChange(index, e)} className="col-span-3 md:col-span-1" />
                            <Input name="email" placeholder="Email Address" type="email" value={contact.email || ''} onChange={(e) => handleContactChange(index, e)} className="col-span-3" />
                           </div>
                        </div>
                    ))}
                </div>

                <Divider />

                {/* Notes */}
                <h3 className="text-lg font-semibold text-foreground">Notes</h3>
                <Textarea name="notes" placeholder="Enter notes here..." value={property.notes || ''} onValueChange={(v) => handlePropertyChange({target: {name: 'notes', value: v}} as any)} minRows={10} />
              </div>
            </>
          )}
        </ModalBody>
        <ModalFooter className="border-t border-divider">
            {error && <p className="text-sm text-danger mr-auto">{error}</p>}
            {!propertyId ? null : (
                <Button color="danger" variant="light" onPress={handleDelete} isLoading={isDeleting} disabled={isDeleting || isSaving}>
                    Delete Lead
                </Button>
            )}
            <Button variant="flat" onPress={onClose} disabled={isSaving || isDeleting}>
                Cancel
            </Button>
            <Button color="primary" onPress={handleSave} isLoading={isSaving} disabled={isSaving || isDeleting}>
                {propertyId ? 'Save Changes' : 'Create Lead'}
            </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};