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
        throw new Error('Failed to load lead data.');
      }
    } catch (err: any) {
      setError(err.message);
      onClose();
    } finally {
      setIsLoading(false);
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen && propertyId) {
      loadLeadData(propertyId);
    } else if (isOpen && !propertyId) {
      setProperty(newPropertyTemplate);
      setContacts([{...newContactTemplate, contact_id: `new_${Date.now()}`}]);
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen, propertyId, loadLeadData]);

  const handlePropertyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numericFields = ['market_value', 'assessed_total', 'year_built', 'beds', 'baths', 'square_footage', 'lot_size_sqft', 'mls_list_price', 'mls_days_on_market'];
    if (numericFields.includes(name)) {
        setProperty(prev => ({ ...prev, [name]: value === '' ? null : Number(value) }));
    } else {
        setProperty(prev => ({ ...prev, [name]: value }));
    }
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
  const modalHeader = propertyId ? fullAddress : 'Create New Lead';
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
          ) : (
            <>
              <div className="h-64 bg-content2">
                {canDisplayMap ? <StreetViewMap address={fullAddress} /> : <div className="flex items-center justify-center h-full text-default-500">Enter a full address to display map</div>}
              </div>
              <div className="p-6 space-y-6">
                <h3 className="text-lg font-semibold text-foreground">Property Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                  <Input name="property_address" placeholder="Property Address" value={property.property_address || ''} onValueChange={(v) => handlePropertyChange({target: {name: 'property_address', value: v}} as any)} className="col-span-2 w-full" style={{minWidth: '30rem'}} />
                  <Input name="property_city" placeholder="City" value={property.property_city || ''} onValueChange={(v) => handlePropertyChange({target: {name: 'property_city', value: v}} as any)} className="w-full" style={{minWidth: '15rem'}} />
                  <Input name="property_state" placeholder="State" value={property.property_state || ''} onValueChange={(v) => handlePropertyChange({target: {name: 'property_state', value: v}} as any)} maxLength={2} className="w-full" style={{minWidth: '5rem'}}/>
                  <Input name="property_postal_code" placeholder="Postal Code" value={property.property_postal_code || ''} onValueChange={(v) => handlePropertyChange({target: {name: 'property_postal_code', value: v}} as any)} maxLength={10} className="w-full" style={{minWidth: '8rem'}} />
                  <Select aria-label="Lead Status" placeholder="Lead Status" selectedKeys={property.status ? [property.status] : []} onSelectionChange={(keys) => handleSelectChange('status', Array.from(keys)[0] as string)} className="col-span-2">
                    {LEAD_STATUS_OPTIONS.map(s => <SelectItem key={s}>{s}</SelectItem>)}
                  </Select>
                  <Input name="market_region" placeholder="Market Region" value={property.market_region || ''} onValueChange={(v) => handlePropertyChange({target: {name: 'market_region', value: v}} as any)} className="w-full" style={{minWidth: '12rem'}}/>
                  <Input name="property_type" placeholder="Property Type" value={property.property_type || ''} onValueChange={(v) => handlePropertyChange({target: {name: 'property_type', value: v}} as any)} className="w-full" style={{minWidth: '10rem'}} />
                  <Input name="market_value" placeholder="Market Value" type="number" startContent="$" value={String(property.market_value ?? '')} onChange={handlePropertyChange} className="w-full" style={{minWidth: '10rem'}}/>
                  <Input name="assessed_total" placeholder="Assessed Total" type="number" startContent="$" value={String(property.assessed_total ?? '')} onChange={handlePropertyChange} className="w-full" style={{minWidth: '10rem'}}/>
                  <Input name="mls_list_price" placeholder="MLS List Price" type="number" startContent="$" value={String(property.mls_list_price ?? '')} onChange={handlePropertyChange} className="w-full" style={{minWidth: '10rem'}}/>
                  <Input name="mls_days_on_market" placeholder="Days on Market" type="number" value={String(property.mls_days_on_market ?? '')} onChange={handlePropertyChange} className="w-full" style={{minWidth: '8rem'}}/>
                  <Input name="year_built" placeholder="Year Built" type="number" value={String(property.year_built ?? '')} onChange={handlePropertyChange} className="w-full" style={{minWidth: '6rem'}}/>
                  <Input name="beds" placeholder="Beds" type="number" value={String(property.beds ?? '')} onChange={handlePropertyChange} className="w-full" style={{minWidth: '5rem'}}/>
                  <Input name="baths" placeholder="Baths" type="number" step="0.1" value={String(property.baths ?? '')} onChange={handlePropertyChange} className="w-full" style={{minWidth: '5rem'}}/>
                  <Input name="square_footage" placeholder="Square Footage" type="number" value={String(property.square_footage ?? '')} onChange={handlePropertyChange} className="w-full" style={{minWidth: '8rem'}}/>
                  <Input name="lot_size_sqft" placeholder="Lot Size (sqft)" type="number" value={String(property.lot_size_sqft ?? '')} onChange={handlePropertyChange} className="w-full" style={{minWidth: '8rem'}}/>
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
                            <Input name="name" placeholder="Contact Name" value={contact.name || ''} onChange={(e) => handleContactChange(index, e)} className="col-span-2 md:col-span-1" />
                            <Select aria-label={`Role for contact ${index + 1}`} placeholder="Role" selectedKeys={contact.role ? [contact.role] : []} onChange={(e) => handleContactSelectChange(index, 'role', e.target.value)} className="w-full">
                                {CONTACT_ROLE_OPTIONS.map(r => <SelectItem key={r}>{r.charAt(0).toUpperCase() + r.slice(1).replace('_', ' ')}</SelectItem>)}
                            </Select>
                            <Input name="phone" placeholder="Phone Number" value={contact.phone || ''} onChange={(e) => handleContactChange(index, e)} className="w-full" />
                            <Input name="email" placeholder="Email Address" type="email" value={contact.email || ''} onChange={(e) => handleContactChange(index, e)} className="w-full" />
                           </div>
                        </div>
                    ))}
                </div>
                <Divider />
                <h3 className="text-lg font-semibold text-foreground">Notes</h3>
                <Textarea name="notes" placeholder="Enter notes here..." value={property.notes || ''} onValueChange={(v) => handlePropertyChange({target: {name: 'notes', value: v}} as any)} minRows={10} className="w-full" />
              </div>
            </>
          )}
        </ModalBody>
        <ModalFooter className="border-t border-divider">
            {error && <p className="text-sm text-danger mr-auto">{error}</p>}
            {!propertyId ? null : ( <Button color="danger" variant="light" onPress={handleDelete} isLoading={isDeleting} disabled={isDeleting || isSaving}>Delete Lead</Button>)}
            <div className='flex-grow' />
            <Button variant="flat" onPress={onClose} disabled={isSaving || isDeleting}>Cancel</Button>
            <Button color="primary" onPress={handleSave} isLoading={isSaving} disabled={isSaving || isDeleting}>{propertyId ? 'Save Changes' : 'Create Lead'}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};