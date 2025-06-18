// src/components/lead-modal.tsx
'use client';

import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import useSWR from 'swr';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Spinner,
  Divider,
} from "@heroui/react";
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';

import { getLeadDetails, saveLead, deleteLead } from '@/actions/lead-actions';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';

import FloatingLabelInput from '@/components/ui/FloatingLabelInput';
import FloatingLabelSelect from '@/components/ui/FloatingLabelSelect';
import FloatingLabelTextarea from '@/components/ui/FloatingLabelTextarea';
import StreetViewMap from './maps/StreetViewMap';

type Property = Tables<'properties'>;
type Contact = Tables<'contacts'>;
type Profile = Pick<Tables<'profiles'>, 'id' | 'full_name' | 'email'>;

const LEAD_STATUS_OPTIONS = [
  "New Lead", "Attempted to Contact", "Contacted", "Working/In Progress",
  "Contract Sent", "Qualified", "Unqualified/Disqualified", "Nurture",
  "Meeting Set", "Closed - Converted/Customer", "Closed - Not Converted/Opportunity Lost"
];
const CONTACT_ROLE_OPTIONS: (Tables<'contacts'>['role'])[] = ["owner", "alternate_contact", "mls_agent"];
const PROPERTY_TYPE_OPTIONS = ["Single Family", "Condo", "Townhouse", "Multi-Family", "Vacant Land"];

const fetcher = async (url: string) => {
  const response = await fetch(url);
  
  if (!response.ok) {
    const error: any = new Error('An error occurred while fetching the data.');
    error.info = await response.json().catch(() => ({}));
    error.status = response.status;
    throw error;
  }
  
  return response.json();
};

const getInitialPropertyState = (): TablesUpdate<'properties'> => ({
  property_id: undefined, status: 'New Lead', property_address: '', property_city: '',
  property_state: '', property_postal_code: '', market_region: '', property_type: 'Single Family',
  square_footage: null, lot_size_sqft: null, beds: null, baths: null, year_built: null, market_value: null,
  wholesale_value: null, assessed_total: null, mls_days_on_market: null, mls_list_price: null, notes: '', user_id: '',
});

const getInitialContactState = (): TablesUpdate<'contacts'> => ({
    contact_id: undefined, name: '', email: '', phone: '', role: 'owner',
});

export interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string | null;
  onSaveSuccess: () => void;
}

const LeadModal: React.FC<LeadModalProps> = ({ isOpen, onClose, propertyId, onSaveSuccess }) => {
  const [property, setProperty] = useState<TablesUpdate<'properties'>>(getInitialPropertyState());
  const [contacts, setContacts] = useState<TablesUpdate<'contacts'>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNewLead = !propertyId;
  
  const { data: users } = useSWR<Profile[]>('/api/users', fetcher, {
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      if (error.status === 403 || retryCount >= 2) return;
      setTimeout(() => revalidate({ retryCount }), 5000);
    }
  });

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (isNewLead) {
        setProperty(getInitialPropertyState());
        setContacts([getInitialContactState()]);
      } else if (propertyId) {
        const fetchLeadData = async () => {
          setIsLoading(true);
          const leadDetails = await getLeadDetails(propertyId);
          if (leadDetails) {
            setProperty(leadDetails.property);
            setContacts(leadDetails.contacts.length > 0 ? leadDetails.contacts : [getInitialContactState()]);
          } else {
            setError("Failed to load lead data. The lead may have been deleted.");
          }
          setIsLoading(false);
        };
        fetchLeadData();
      }
    }
  }, [isOpen, propertyId, isNewLead]);

  const handlePropertyChange = (name: string, value: any) => {
    setProperty(prev => ({ ...prev, [name]: value === '' ? null : value }));
  };

  const handleContactChange = (index: number, name: string, value: any) => {
    setContacts(prev => {
      const newContacts = [...prev];
      newContacts[index] = { ...newContacts[index], [name]: value };
      return newContacts;
    });
  };

  const addContact = () => {
    if (contacts.length < 4) {
      setContacts(prev => [...prev, getInitialContactState()]);
    }
  };

  const removeContact = (index: number) => {
    setContacts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    const validContacts = contacts.filter(c => c.name || c.email || c.phone);
    const result = await saveLead({ property, contacts: validContacts });

    if (result.error) {
      setError(result.error);
      toast.error(result.error);
    } else {
      toast.success("Lead saved successfully!");
      onSaveSuccess();
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!propertyId) return;
    const confirmed = window.confirm("Are you sure you want to permanently delete this lead?");
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);
    const result = await deleteLead(propertyId);
    if (result.error) {
      setError(result.error);
      toast.error(result.error);
    } else {
      toast.success("Lead deleted successfully.");
      onSaveSuccess();
    }
    setIsDeleting(false);
  };
  
  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>, field: keyof Property) => {
    handlePropertyChange(field, e.target.value);
  };
    
  const handleContactSelectChange = (e: ChangeEvent<HTMLSelectElement>, index: number, field: keyof Contact) => {
    handleContactChange(index, field, e.target.value);
  };

  const fullAddress = [
    property.property_address,
    property.property_city,
    property.property_state,
    property.property_postal_code
  ].filter(Boolean).join(', ');

  const modalTitle = isNewLead ? "Add New Lead" : fullAddress || "Edit Lead";

  return (
    <Modal size="5xl" isOpen={isOpen} onClose={onClose} scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 text-base">
          {modalTitle}
        </ModalHeader>
        <ModalBody>
          {isLoading ? (
            <div className="flex justify-center items-center h-96"><Spinner label="Loading Lead Data..." /></div>
          ) : (
            <div className="space-y-6 py-4">
              
              <div className="h-[32rem] w-full rounded-lg mb-4 bg-default-100">
                <StreetViewMap
                    // FIX: Use standardized environment variable name
                    apiKey={process.env.NEXT_PUBLIC_MAPS_API_KEY!}
                    address={fullAddress}
                />
              </div>

              <h2 className="text-gray-500 dark:text-gray-400 uppercase tracking-widest text-sm font-bold">Property Info</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div className="flex flex-col space-y-4">
                  <FloatingLabelSelect label="Lead Status" value={property.status || ''} onChange={(e) => handleSelectChange(e, 'status')}>
                    {LEAD_STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
                  </FloatingLabelSelect>
                  <FloatingLabelInput label="Property Address" value={property.property_address || ''} onChange={e => handlePropertyChange('property_address', e.target.value)} />
                  <div className="grid grid-cols-6 gap-4">
                    <FloatingLabelInput className="col-span-3" label="City" value={property.property_city || ''} onChange={e => handlePropertyChange('property_city', e.target.value)} />
                    <FloatingLabelInput className="col-span-1" label="State" maxLength={2} value={property.property_state || ''} onChange={e => handlePropertyChange('property_state', e.target.value)} />
                    <FloatingLabelInput className="col-span-2" label="Postal Code" value={property.property_postal_code || ''} onChange={e => handlePropertyChange('property_postal_code', e.target.value)} />
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4">
                    {property.property_type === 'Vacant Land' ? (
                      <FloatingLabelInput className="col-span-4" label="Lot Size (sqft)" type="number" value={String(property.lot_size_sqft || '')} onChange={e => handlePropertyChange('lot_size_sqft', e.target.value)} />
                    ) : (
                      <>
                        <FloatingLabelInput className="col-span-1" label="SqFt" type="number" value={String(property.square_footage || '')} onChange={e => handlePropertyChange('square_footage', e.target.value)} />
                        <FloatingLabelInput className="col-span-1" label="Beds" type="number" value={String(property.beds || '')} onChange={e => handlePropertyChange('beds', e.target.value)} />
                        <FloatingLabelInput className="col-span-1" label="Baths" type="number" step="0.1" value={String(property.baths || '')} onChange={e => handlePropertyChange('baths', e.target.value)} />
                        <FloatingLabelInput className="col-span-1" label="Year" type="number" value={String(property.year_built || '')} onChange={e => handlePropertyChange('year_built', e.target.value)} />
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FloatingLabelInput label="Market Region" value={property.market_region || ''} onChange={e => handlePropertyChange('market_region', e.target.value)} />
                    {users ? (
                      <FloatingLabelSelect label="Assigned User" value={property.user_id || ''} onChange={(e) => handlePropertyChange('user_id', e.target.value)}>
                        {(users || []).map(user => <option key={user.id} value={user.id}>{user.full_name}</option>)}
                      </FloatingLabelSelect>
                    ) : <div />}
                  </div>
                  <FloatingLabelSelect label="Property Type" value={property.property_type || ''} onChange={(e) => handleSelectChange(e, 'property_type')}>
                    {PROPERTY_TYPE_OPTIONS.map(type => <option key={type} value={type}>{type}</option>)}
                  </FloatingLabelSelect>
                  <div className="grid grid-cols-3 gap-4">
                    <FloatingLabelInput label="DOM" type="number" value={String(property.mls_days_on_market || '')} onChange={e => handlePropertyChange('mls_days_on_market', e.target.value)} />
                    <FloatingLabelInput label="List $" type="number" startContent="$" value={String(property.mls_list_price || '')} onChange={e => handlePropertyChange('mls_list_price', e.target.value)} />
                    <FloatingLabelInput label="Assessed $" type="number" startContent="$" value={String(property.assessed_total || '')} onChange={e => handlePropertyChange('assessed_total', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FloatingLabelInput label="Market $" type="number" startContent="$" value={String(property.market_value || '')} onChange={e => handlePropertyChange('market_value', e.target.value)} />
                    <FloatingLabelInput label="Wholesale $" type="number" startContent="$" value={String(property.wholesale_value || '')} onChange={e => handlePropertyChange('wholesale_value', e.target.value)} />
                  </div>
                </div>
              </div>

              <Divider />

              <div className="flex items-center justify-between">
                <h2 className="text-gray-500 dark:text-gray-400 uppercase tracking-widest text-sm font-bold">Contact Info</h2>
                <div className="flex items-center space-x-1">
                    <Button isIconOnly variant="light" size="sm" onPress={() => toast('Send Offer feature coming soon.', { icon: 'lucide:mail-plus' })}>
                        <Icon icon="lucide:mail-plus" className="w-5 h-5 text-gray-500" />
                    </Button>
                    <Button isIconOnly variant="light" size="sm" onPress={() => toast('Send Contract feature coming soon.', { icon: 'lucide:file-signature' })}>
                        <Icon icon="lucide:file-signature" className="w-5 h-5 text-gray-500" />
                    </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {contacts.slice(0, 4).map((c, i) => (
                    <div key={c.contact_id || i} className="space-y-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg relative">
                       {contacts.length > 1 && (
                         <Button isIconOnly variant="light" size="sm" className="!absolute top-1 right-1 h-8 w-8 p-0" onPress={() => removeContact(i)}>
                           <Icon icon="lucide:x" className="w-4 h-4 text-default-500" />
                         </Button>
                       )}
                      <FloatingLabelInput label={`Contact Name ${i + 1}`} value={c.name || ''} onChange={e => handleContactChange(i, 'name', e.target.value)} />
                      <FloatingLabelInput label="Email" type="email" value={c.email || ''} onChange={e => handleContactChange(i, 'email', e.target.value)} />
                      <div className="grid grid-cols-2 gap-4">
                        <FloatingLabelInput label="Phone" value={c.phone || ''} onChange={e => handleContactChange(i, 'phone', e.target.value)} />
                        <FloatingLabelSelect label="Role" value={c.role || ''} onChange={(e) => handleContactSelectChange(e, i, 'role')}>
                           {(CONTACT_ROLE_OPTIONS as (string | null)[]).map(role => <option key={role || 'none'} value={role || ''}>{role}</option>)}
                        </FloatingLabelSelect>
                      </div>
                    </div>
                ))}
              </div>
               {contacts.length < 4 && (
                  <Button size="sm" variant="flat" onPress={addContact} startContent={<Icon icon="lucide:plus" className="w-4 h-4" />}>
                    Add Another Contact
                  </Button>
                )}

              <Divider />

              <h2 className="text-gray-500 dark:text-gray-400 uppercase tracking-widest text-sm font-bold">Notes</h2>
              <FloatingLabelTextarea label="Notes" rows={6} value={property.notes || ''} onChange={e => handlePropertyChange('notes', e.target.value)} />
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
                <Button variant="flat" onPress={onClose} disabled={isSaving || isDeleting}>Cancel</Button>
                <Button color="primary" onPress={handleSave} isLoading={isSaving} disabled={isDeleting}>
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