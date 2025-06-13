// src/components/lead-modal.tsx
'use client';

import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Spinner,
  Divider,
  ScrollShadow
} from '@heroui/react';
import { Icon } from '@iconify/react';
import StreetViewMap from '@/components/maps/StreetViewMap';
import { getLeadDetails, saveLead, deleteLead } from '@/actions/lead-actions';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';

// Import our new custom components
import FloatingLabelInput from '@/components/ui/FloatingLabelInput';
import FloatingLabelSelect from '@/components/ui/FloatingLabelSelect';
import FloatingLabelTextarea from '@/components/ui/FloatingLabelTextarea';

// Define types for convenience
type Property = Tables<'properties'>;
type Contact = Tables<'contacts'>;

// --- Constants (aligned with supabase types and concept) ---
const LEAD_STATUS_OPTIONS = [
  "New Lead", "Attempted to Contact", "Contacted", "Working/In Progress",
  "Contract Sent", "Qualified", "Unqualified/Disqualified", "Nurture",
  "Meeting Set", "Closed - Converted/Customer", "Closed - Not Converted/Opportunity Lost"
];
const CONTACT_ROLE_OPTIONS: (Tables<'contacts'>['role'])[] = ["owner", "alternate_contact", "mls_agent"];
const PROPERTY_TYPE_OPTIONS = ["Single Family", "Condo", "Townhouse", "Multi-Family", "Vacant Land"];
const MLS_STATUS_OPTIONS = ["Active", "Pending", "Sold", "Expired", "Withdrawn"];


// --- Helper to provide an empty initial state ---
const getInitialPropertyState = (): TablesUpdate<'properties'> => ({
  property_id: undefined,
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
  user_id: '',
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

  const handlePropertyChange = (name: string, value: any) => {
    setProperty(prev => ({ ...prev, [name]: value }));
  };
  
  const handleContactChange = (index: number, name: string, value: any) => {
    setContacts(prev => {
      const newContacts = [...prev];
      newContacts[index] = { ...newContacts[index], [name]: value };
      return newContacts;
    });
  };

  const addContact = () => {
    setContacts(prev => [...prev, getInitialContactState()]);
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
    } else {
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
    } else {
      onSaveSuccess();
    }
    setIsDeleting(false);
  };

  const fullAddress = [
      property.property_address,
      property.property_city,
      property.property_state,
      property.property_postal_code
  ].filter(Boolean).join(', ');

  const modalTitle = isNewLead ? "Add New Lead" : "Edit Lead";

  // Event handler for custom select
  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>, field: keyof Property) => {
    handlePropertyChange(field, e.target.value);
  };
    // Event handler for custom contact select
  const handleContactSelectChange = (e: ChangeEvent<HTMLSelectElement>, index: number, field: keyof Contact) => {
    handleContactChange(index, field, e.target.value);
  };

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
                    <FloatingLabelSelect label="Lead Status" value={property.status || ''} onChange={(e) => handleSelectChange(e, 'status')}>
                        {LEAD_STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
                    </FloatingLabelSelect>
                    <FloatingLabelInput label="Property Address" value={property.property_address || ''} onChange={e => handlePropertyChange('property_address', e.target.value)} />
                    <div className="grid grid-cols-6 gap-4">
                      <FloatingLabelInput label="City" value={property.property_city || ''} onChange={e => handlePropertyChange('property_city', e.target.value)} className="col-span-3" />
                      <FloatingLabelInput label="State" maxLength={2} value={property.property_state || ''} onChange={e => handlePropertyChange('property_state', e.target.value)} className="col-span-1" />
                      <FloatingLabelInput label="Postal Code" value={property.property_postal_code || ''} onChange={e => handlePropertyChange('property_postal_code', e.target.value)} className="col-span-2" />
                    </div>
                    <div className="grid grid-cols-6 gap-4">
                      <FloatingLabelInput label="Square Footage" type="number" value={String(property.square_footage || '')} onChange={e => handlePropertyChange('square_footage', e.target.value)} className="col-span-2" />
                      <FloatingLabelInput label="Beds" type="number" value={String(property.beds || '')} onChange={e => handlePropertyChange('beds', e.target.value)} className="col-span-1" />
                      <FloatingLabelInput label="Baths" type="number" step="0.1" value={String(property.baths || '')} onChange={e => handlePropertyChange('baths', e.target.value)} className="col-span-1" />
                      <FloatingLabelInput label="Year Built" type="number" value={String(property.year_built || '')} onChange={e => handlePropertyChange('year_built', e.target.value)} className="col-span-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FloatingLabelInput label="Market Value" type="number" startContent="$" value={String(property.market_value || '')} onChange={e => handlePropertyChange('market_value', e.target.value)} />
                      <FloatingLabelInput label="Wholesale Value" type="number" startContent="$" value={String(property.wholesale_value || '')} onChange={e => handlePropertyChange('wholesale_value', e.target.value)} />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="flex flex-col space-y-4">
                    <FloatingLabelInput label="Market Region" value={property.market_region || ''} onChange={e => handlePropertyChange('market_region', e.target.value)} />
                    <FloatingLabelSelect label="Property Type" value={property.property_type || ''} onChange={(e) => handleSelectChange(e, 'property_type')}>
                        {PROPERTY_TYPE_OPTIONS.map(type => <option key={type} value={type}>{type}</option>)}
                    </FloatingLabelSelect>
                    <div className="h-64 w-full rounded-lg overflow-hidden bg-default-100">
                      <StreetViewMap apiKey={process.env.NEXT_PUBLIC_Maps_API_KEY!} address={fullAddress} />
                    </div>
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {contacts.map((c, i) => (
                    <div key={i} className="space-y-4 p-4 border border-slate-300 dark:border-slate-700 rounded-lg relative">
                      <Button isIconOnly variant="light" size="sm" className="!absolute top-1 right-1 h-8 w-8 p-0" onPress={() => removeContact(i)}>
                        <Icon icon="lucide:x" className="w-4 h-4 text-default-500" />
                      </Button>
                      <FloatingLabelInput label="Contact Name" value={c.name || ''} onChange={e => handleContactChange(i, 'name', e.target.value)} />
                      <FloatingLabelInput label="Email" type="email" value={c.email || ''} onChange={e => handleContactChange(i, 'email', e.target.value)} />
                      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                        <FloatingLabelInput label="Phone" value={c.phone || ''} onChange={e => handleContactChange(i, 'phone', e.target.value)} className="w-full" />
                        <FloatingLabelSelect label="Role" value={c.role || ''} onChange={(e) => handleContactSelectChange(e, i, 'role')} className="w-full">
                           {(CONTACT_ROLE_OPTIONS as (string | null)[]).map(role => <option key={role || 'none'} value={role || ''}>{role}</option>)}
                        </FloatingLabelSelect>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Divider />

              {/* Notes Section */}
              <div>
                <h2 className="text-gray-500 dark:text-gray-400 uppercase tracking-widest text-sm font-bold mb-4">Notes</h2>
                <FloatingLabelTextarea label="Notes" rows={6} value={property.notes || ''} onChange={e => handlePropertyChange('notes', e.target.value)} />
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