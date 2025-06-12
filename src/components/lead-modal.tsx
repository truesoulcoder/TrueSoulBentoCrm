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
  user_id: '',
};

const newContactTemplate: TablesInsert<'contacts'> = {
  contact_id: '', name: '', email: '', phone: '', role: 'owner', property_id: '', user_id: '',
};

interface LeadModalProps {
  propertyId: string | null;
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
    try {
      const data = await getLeadDetails(id);
      if (data) {
        setProperty(data.property);
        setContacts(data.contacts.length > 0 ? data.contacts : [{...newContactTemplate}]);
      } else {
        // Instead of closing, display the error inside the modal.
        setError('Failed to load lead data. The lead may not exist or there was a server error.');
      }
    } catch (err: any) {
      // Catch any other unexpected errors from the action.
      setError(err.message || 'An unknown error occurred while fetching data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
        setError(null); // Clear previous errors when modal opens
        if (propertyId) {
            loadLeadData(propertyId);
        } else {
            setProperty(newPropertyTemplate);
            setContacts([{...newContactTemplate, contact_id: `new_${Date.now()}`}]);
            setIsLoading(false);
        }
    }
  }, [isOpen, propertyId, loadLeadData]);

  const handlePropertyChange = (name: string, value: string) => {
    const numericFields = ['market_value', 'assessed_total', 'year_built', 'beds', 'baths', 'square_footage', 'lot_size_sqft', 'mls_list_price', 'mls_days_on_market'];
    if (numericFields.includes(name)) {
        setProperty(prev => ({ ...prev, [name]: value === '' ? null : Number(value) }));
    } else {
        setProperty(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (name: keyof Property, value: string) => {
    setProperty(prev => ({ ...prev, [name]: value as any }));
  };
  
  const handleContactChange = (index: number, name: string, value: string) => {
    const newContacts = [...contacts];
    newContacts[index] = { ...newContacts[index], [name]: value };
    setContacts(newContacts);
  };
  
  const handleContactSelectChange = (index: number, name: keyof Contact, value: string) => {
    const newContacts = [...contacts];
    newContacts[index] = { ...newContacts[index], [name]: value as any };
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

  const fullAddress = [property.property_address, property.property_city, property.property_state, property.property_postal_code].filter(Boolean).join(', ');
  const modalHeader = propertyId && fullAddress ? fullAddress : 'Create New Lead';
  const canDisplayMap = !!property.property_address && !!property.property_city && !!property.property_state;

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
          ) : error ? (
            <div className="flex flex-col justify-center items-center h-96 p-8 text-center text-danger">
                <Icon icon="lucide:server-crash" className="w-16 h-16 mb-4" />
                <p className="text-lg font-semibold">Could Not Load Lead</p>
                <p className="text-sm">{error}</p>
            </div>
          ) : (
            <>
              <div className="h-64 bg-content2">
                {canDisplayMap ? <StreetViewMap address={fullAddress} /> : <div className="flex items-center justify-center h-full text-default-500">Enter a full address to display map</div>}
              </div>
              <div className="p-6 space-y-6">
                <h3 className="text-lg font-semibold text-foreground">Property Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                  <Input label="Property Address" name="property_address" value={property.property_address || ''} onValueChange={(v) => handlePropertyChange('property_address', v)} className="col-span-2" />
                  <Input label="City" name="property_city" value={property.property_city || ''} onValueChange={(v) => handlePropertyChange('property_city', v)} />
                  <Input label="State" name="property_state" value={property.property_state || ''} onValueChange={(v) => handlePropertyChange('property_state', v)} maxLength={2} />
                  <Input label="Postal Code" name="property_postal_code" value={property.property_postal_code || ''} onValueChange={(v) => handlePropertyChange('property_postal_code', v)} maxLength={10} />
                  <Select label="Lead Status" selectedKeys={property.status ? [property.status] : []} onSelectionChange={(keys) => handleSelectChange('status', Array.from(keys)[0] as string)} className="col-span-2">
                    {LEAD_STATUS_OPTIONS.map(s => <SelectItem key={s}>{s}</SelectItem>)}
                  </Select>
                  <Input label="Market Region" name="market_region" value={property.market_region || ''} onValueChange={(v) => handlePropertyChange('market_region', v)} />
                  <Input label="Property Type" name="property_type" value={property.property_type || ''} onValueChange={(v) => handlePropertyChange('property_type', v)} />
                  <Input label="Market Value" name="market_value" type="number" startContent="$" value={String(property.market_value ?? '')} onValueChange={(v) => handlePropertyChange('market_value', v)} />
                  <Input label="Assessed Total" name="assessed_total" type="number" startContent="$" value={String(property.assessed_total ?? '')} onValueChange={(v) => handlePropertyChange('assessed_total', v)} />
                  <Input label="MLS List Price" name="mls_list_price" type="number" startContent="$" value={String(property.mls_list_price ?? '')} onValueChange={(v) => handlePropertyChange('mls_list_price', v)} />
                  <Input label="Days on Market" name="mls_days_on_market" type="number" value={String(property.mls_days_on_market ?? '')} onValueChange={(v) => handlePropertyChange('mls_days_on_market', v)} />
                  <Input label="Year Built" name="year_built" type="number" value={String(property.year_built ?? '')} onValueChange={(v) => handlePropertyChange('year_built', v)} />
                  <Input label="Beds" name="beds" type="number" value={String(property.beds ?? '')} onValueChange={(v) => handlePropertyChange('beds', v)} />
                  <Input label="Baths" name="baths" type="number" step="0.1" value={String(property.baths ?? '')} onValueChange={(v) => handlePropertyChange('baths', v)} />
                  <Input label="Square Footage" name="square_footage" type="number" value={String(property.square_footage ?? '')} onValueChange={(v) => handlePropertyChange('square_footage', v)} />
                  <Input label="Lot Size (sqft)" name="lot_size_sqft" type="number" value={String(property.lot_size_sqft ?? '')} onValueChange={(v) => handlePropertyChange('lot_size_sqft', v)} />
                </div>
                
                <Divider />
                
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-foreground">Contact Details</h3>
                    <Button size="sm" color="primary" variant="flat" startContent={<Icon icon="lucide:plus" />} onPress={addContact}>Add Contact</Button>
                </div>
                <div className="space-y-4">
                    {contacts.map((contact, index) => (
                        <div key={contact.contact_id || `new-${index}`} className="p-4 border border-divider rounded-md space-y-3 relative">
                           <Button isIconOnly size="sm" color="danger" variant="light" className="absolute top-2 right-2" onPress={() => removeContact(index)}><Icon icon="lucide:x" /></Button>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Contact Name" name="name" value={contact.name || ''} onValueChange={(v) => handleContactChange(index, 'name', v)} className="col-span-2 md:col-span-1" />
                            <Select label="Role" selectedKeys={contact.role ? [contact.role] : []} onSelectionChange={(keys) => handleContactSelectChange(index, 'role', Array.from(keys)[0] as string)}>
                                {CONTACT_ROLE_OPTIONS.map(r => <SelectItem key={r}>{r.charAt(0).toUpperCase() + r.slice(1).replace('_', ' ')}</SelectItem>)}
                            </Select>
                            <Input label="Phone Number" name="phone" value={contact.phone || ''} onValueChange={(v) => handleContactChange(index, 'phone', v)} />
                            <Input label="Email Address" name="email" type="email" value={contact.email || ''} onValueChange={(v) => handleContactChange(index, 'email', v)} className="col-span-2" />
                           </div>
                        </div>
                    ))}
                </div>

                <Divider />
                
                <h3 className="text-lg font-semibold text-foreground">Notes</h3>
                <Textarea label="Notes" name="notes" value={property.notes || ''} onValueChange={(v) => handlePropertyChange('notes', v)} minRows={10} />
              </div>
            </>
          )}
        </ModalBody>
        <ModalFooter className="border-t border-divider">
            {isSaving && <Spinner size="sm" className="mr-auto" />}
            {error && !isSaving && <p className="text-sm text-danger mr-auto">{error}</p>}
            {!propertyId ? null : ( <Button color="danger" variant="light" onPress={handleDelete} isLoading={isDeleting} disabled={isDeleting || isSaving}>Delete Lead</Button>)}
            <div className='flex-grow' />
            <Button variant="flat" onPress={onClose} disabled={isSaving || isDeleting}>Cancel</Button>
            <Button color="primary" onPress={handleSave} isLoading={isSaving} disabled={isDeleting || isSaving}>{propertyId ? 'Save Changes' : 'Create Lead'}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};