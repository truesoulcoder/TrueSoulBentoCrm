// src/components/lead-modal.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Spinner,
} from "@heroui/react"; // Keep original modal components
import { Mail, FileText, Plus, X } from 'lucide-react';
import { useSWRConfig } from 'swr';
import StreetViewMap from './maps/StreetViewMap';
import { getLeadDetails, saveLead, deleteLead } from '@/actions/lead-actions';
import type { TablesInsert, TablesUpdate, Enums } from '@/types/supabase';

// --- New Floating Label UI Components ---
const Button = ({ children, variant, size, className, color, onPress, isLoading, disabled, ...props }) => {
    const baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50 disabled:pointer-events-none";
    const colorClasses = {
        primary: "bg-blue-600 text-white hover:bg-blue-700",
        danger: "bg-red-600 text-white hover:bg-red-700",
    };
    const variantClasses = {
        flat: "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600",
        light: "hover:bg-slate-200 dark:hover:bg-slate-700",
    };
    const dangerLight = "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50";

    const finalClassName = `${baseClasses} ${
        color === 'danger' && variant === 'light' ? dangerLight : 
        color ? colorClasses[color] :
        variant ? variantClasses[variant] : colorClasses.primary
    } ${className || ''}`;

    return <button onClick={onPress} className={finalClassName} disabled={disabled || isLoading} {...props}>{isLoading ? <Spinner size="sm"/> : children}</button>;
};

const Input = React.forwardRef(({ label, className, startContent, value, onChange, onValueChange, ...props }, ref) => {
    const handleChange = (e) => {
        if (onChange) onChange(e);
        if (onValueChange) onValueChange(e.target.value);
    };
    return (
      <div className={`relative ${className}`}>
        {startContent && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">{startContent}</span>}
        <input
          ref={ref}
          value={value || ''}
          onChange={handleChange}
          placeholder=" "
          className={`block px-3 pb-2 pt-5 w-full text-sm text-gray-900 dark:text-white bg-white dark:bg-slate-900 rounded-md border border-slate-300 dark:border-slate-600 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 peer ${startContent ? 'pl-7' : ''}`}
          {...props}
        />
        <label
          className={`absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-4 z-10 origin-[0] bg-white dark:bg-slate-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 dark:peer-focus:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-4 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto pointer-events-none ${startContent ? 'left-7' : 'left-1'}`}
        >
          {label}
        </label>
      </div>
    )
});

const Select = ({ label, children, selectedKeys, onSelectionChange, className, value, ...props }) => (
    <div className={`relative ${className}`}>
        <select
            className="block px-3 pb-2 pt-5 w-full text-sm text-gray-900 dark:text-white bg-white dark:bg-slate-900 rounded-md border border-slate-300 dark:border-slate-600 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 peer"
            value={value || selectedKeys?.[0] || ''}
            onChange={(e) => onSelectionChange(new Set([e.target.value]))}
            {...props}
        >
            {children}
        </select>
        <label
          className={`absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-4 z-10 origin-[0] bg-white dark:bg-slate-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 dark:peer-focus:text-blue-500 pointer-events-none left-1`}
        >
          {label}
        </label>
    </div>
);

const SelectItem = ({ children, ...props }) => (
  <option {...props}>{children}</option>
);

const Textarea = React.forwardRef(({ label, className, value, onValueChange, ...props }, ref) => (
  <div className={`relative ${className}`}>
    <textarea
      ref={ref}
      value={value || ''}
      onChange={(e) => onValueChange(e.target.value)}
      placeholder=" "
      className="block px-3 pb-2 pt-5 w-full text-sm text-gray-900 dark:text-white bg-white dark:bg-slate-900 rounded-md border border-slate-300 dark:border-slate-600 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 peer"
      {...props}
    />
    <label
      className={`absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-4 z-10 origin-[0] bg-white dark:bg-slate-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 dark:peer-focus:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-6 peer-focus:top-4 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto pointer-events-none left-1`}
    >
      {label}
    </label>
  </div>
));

const Divider = () => <hr className="border-gray-200 dark:border-gray-700" />;

// --- Constants from your project ---
const LEAD_STATUS_OPTIONS: Enums<'lead_status'>[] = [
  "New Lead", "Attempted to Contact", "Contacted", "Working/In Progress", 
  "Contract Sent", "Qualified", "Unqualified/Disqualified", "Nurture",
  "Meeting Set", "Closed - Converted/Customer", "Closed - Not Converted/Opportunity Lost"
];
const CONTACT_ROLE_OPTIONS: Enums<'contact_role'>[] = ["owner", "alternate_contact", "mls_agent"];
const PROPERTY_TYPE_OPTIONS = ["Single Family", "Condo", "Townhouse", "Multi-Family", "Vacant Land"];
const MLS_STATUS_OPTIONS = ["Active", "Pending", "Sold", "Expired", "Withdrawn"];

// --- The New LeadForm Component ---
const LeadForm = ({ property, contacts, onPropertyChange, onContactChange, addContact, removeContact }) => (
    <div className="space-y-8">
    {/* Property Info Section */}
    <div>
        <h2 className="text-gray-500 dark:text-gray-400 uppercase tracking-widest text-sm font-bold mb-4">Property Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {/* Left Column */}
            <div className="flex flex-col space-y-4">
                <Select label="Lead Status" value={property.status} onSelectionChange={keys => onPropertyChange('status', Array.from(keys)[0] ?? '')}>
                    {LEAD_STATUS_OPTIONS.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </Select>
                <Input label="Property Address" value={property.property_address} onValueChange={v => onPropertyChange('property_address', v)} />
                <div className="grid grid-cols-6 gap-4">
                    <Input label="City" value={property.property_city} onValueChange={v => onPropertyChange('property_city', v)} className="col-span-3" />
                    <Input label="State" maxLength={2} value={property.property_state} onValueChange={v => onPropertyChange('property_state', v)} className="col-span-1" />
                    <Input label="Postal Code" value={property.property_postal_code} onValueChange={v => onPropertyChange('property_postal_code', v)} className="col-span-2" />
                </div>
                <div className="grid grid-cols-6 gap-4">
                    {property.property_type === 'Vacant Land' ? (
                        <Input label="Lot Size (sqft)" type="number" value={property.lot_size_sqft} onValueChange={v => onPropertyChange('lot_size_sqft', v)} className="col-span-2" />
                    ) : (
                        <Input label="Square Footage" type="number" value={property.square_footage} onValueChange={v => onPropertyChange('square_footage', v)} className="col-span-2" />
                    )}
                    <Input label="Beds" type="number" value={property.beds} onValueChange={v => onPropertyChange('beds', v)} className="col-span-1" />
                    <Input label="Baths" type="number" step="0.1" value={property.baths} onValueChange={v => onPropertyChange('baths', v)} className="col-span-1" />
                    <Input label="Year Built" type="number" value={property.year_built} onValueChange={v => onPropertyChange('year_built', v)} className="col-span-2" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Market Value" type="number" startContent="$" value={property.market_value} onValueChange={v => onPropertyChange('market_value', v)} />
                    <Input label="Wholesale Value" type="number" startContent="$" value={property.wholesale_value} onValueChange={v => onPropertyChange('wholesale_value', v)} />
                </div>
                 <Input label="Assessed Total" type="number" startContent="$" value={property.assessed_total} onValueChange={v => onPropertyChange('assessed_total', v)} />
            </div>
            
            {/* Right Column */}
            <div className="flex flex-col space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <Input label="Market Region" value={property.market_region} onValueChange={v => onPropertyChange('market_region', v)} />
                    <Input label="Assigned User" value={property.assigned_user} onValueChange={v => onPropertyChange('assigned_user', v)} />
                </div>
                <Select label="Property Type" value={property.property_type} onSelectionChange={keys => onPropertyChange('property_type', Array.from(keys)[0] ?? '')} >
                    {PROPERTY_TYPE_OPTIONS.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </Select>
                {/* MLS Info Subsection */}
                <div className="p-4 border border-dashed border-slate-400 dark:border-slate-500 rounded-lg space-y-4 mt-2">
                    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 -mt-1">MLS Info</h3>
                    <div className="grid grid-cols-5 gap-4">
                        <Select label="MLS Status" value={property.mls_status} onSelectionChange={keys => onPropertyChange('mls_status', Array.from(keys)[0] ?? '')} className="col-span-2">
                           {MLS_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </Select>
                        <Input label="MLS DOM" type="number" value={property.mls_days_on_market} onValueChange={v => onPropertyChange('mls_days_on_market', v)} className="col-span-1" />
                        <Input label="MLS List Price" type="number" startContent="$" value={property.mls_list_price} onValueChange={v => onPropertyChange('mls_list_price', v)} className="col-span-2" />
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                        <Input label="MLS Sqft" type="number" value={property.mls_sqft} onValueChange={v => onPropertyChange('mls_sqft', v)} className="col-span-1" />
                        <Input label="MLS Beds" type="number" value={property.mls_beds} onValueChange={v => onPropertyChange('mls_beds', v)} className="col-span-1" />
                        <Input label="MLS Baths" type="number" step="0.1" value={property.mls_baths} onValueChange={v => onPropertyChange('mls_baths', v)} className="col-span-1" />
                        <Input label="MLS Year Built" type="number" value={property.mls_year_built} onValueChange={v => onPropertyChange('mls_year_built', v)} className="col-span-1" />
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <Divider />

    {/* Contact Info Section */}
    <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-gray-500 dark:text-gray-400 uppercase tracking-widest text-sm font-bold">Contact Info</h2>
          <div className="flex items-center space-x-1">
            <Button variant="light" size="sm"><Mail className="w-6 h-6 text-gray-500" /></Button>
            <Button variant="light" size="sm"><FileText className="w-6 h-6 text-gray-500" /></Button>
            <Button size="sm" variant="flat" onPress={addContact} className="ml-2">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {contacts.map((c, i) => (
            <div key={i} className="space-y-4 p-4 border border-slate-300 dark:border-slate-700 rounded-lg relative">
              <Button variant="light" className="!absolute top-1 right-1 h-8 w-8 p-0" onPress={() => removeContact(i)}>
                <X className="w-4 h-4 text-gray-500" />
              </Button>
              <Input label="Contact Name" value={c.name} onValueChange={v => onContactChange(i, 'name', v)} />
              <Input label="Email" type="email" value={c.email} onValueChange={v => onContactChange(i, 'email', v)} />
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <Input label="Phone" value={c.phone} onValueChange={v => onContactChange(i, 'phone', v)} className="w-full" />
                <Select label="Role" value={c.role} onSelectionChange={keys => onContactChange(i, 'role', Array.from(keys)[0] ?? '')} className="w-full">
                   {CONTACT_ROLE_OPTIONS.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                </Select>
              </div>
            </div>
          ))}
        </div>
    </div>

    <Divider />

    {/* Notes Section */}
    <div>
        <h2 className="text-gray-500 dark:text-gray-400 uppercase tracking-widest text-sm font-bold mb-4">Notes</h2>
        <Textarea label="Notes" rows={8} value={property.notes} onValueChange={v => onPropertyChange('notes', v)} />
    </div>
  </div>
);

// --- Original LeadModal Component (Main Logic) ---
const newPropertyTemplate: TablesInsert<'properties'> = {
  property_id: '', status: 'New Lead', property_address: '', property_city: '',
  property_state: '', property_postal_code: '',
};

type Property = Awaited<ReturnType<typeof getLeadDetails>>['property'];
type Contact = Awaited<ReturnType<typeof getLeadDetails>>['contacts'][number];

interface LeadModalProps {
  propertyId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LeadModal: React.FC<LeadModalProps> = ({ propertyId, isOpen, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [property, setProperty] = useState<Property | TablesInsert<'properties'>>(newPropertyTemplate);
  const [contacts, setContacts] = useState<Contact[]>([]);
  
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (isOpen && propertyId) {
      setIsLoading(true);
      getLeadDetails(propertyId)
        .then(({ property, contacts, error }) => {
          if (error) {
            setError(error);
          } else {
            setProperty(property);
            setContacts(contacts);
          }
        })
        .finally(() => setIsLoading(false));
    } else if (isOpen && !propertyId) {
      setProperty(newPropertyTemplate);
      setContacts([]);
      setIsLoading(false);
    }
  }, [propertyId, isOpen]);

  const handlePropertyChange = (name: string, value: any) => {
    setProperty(prev => ({ ...prev, [name]: value }));
  };

  const handleContactChange = (index: number, name: string, value: any) => {
    setContacts(prev => {
      const newContacts = [...prev];
      const contactToUpdate = { ...newContacts[index], [name]: value };
      newContacts[index] = contactToUpdate;
      return newContacts;
    });
  };

  const addContact = () => {
    setContacts(prev => [...prev, { contact_id: crypto.randomUUID(), name: '', email: '', phone: '', role: 'owner', is_new: true }]);
  };

  const removeContact = (index: number) => {
    setContacts(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      const result = await saveLead(property, contacts);
      if (result.error) {
        throw new Error(result.error);
      }
      mutate('/api/leads'); // Revalidate SWR cache
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  }, [property, contacts, mutate, onClose]);

  const handleDelete = useCallback(async () => {
    if (!propertyId) return;
    setIsDeleting(true);
    setError(null);
    try {
        const result = await deleteLead(propertyId);
        if (result.error) throw new Error(result.error);
        mutate('/api/leads');
        onClose();
    } catch(e: any) {
        setError(e.message)
    } finally {
        setIsDeleting(false);
    }
  }, [propertyId, mutate, onClose]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 border-b border-divider">
            <h2 className='text-xl font-bold'>{propertyId ? 'Edit Lead' : 'Create New Lead'}</h2>
            <p className='text-sm text-default-500'>{property?.property_address || 'Enter property details below'}</p>
        </ModalHeader>
        <ModalBody>
          {isLoading ? (
            <div className="flex justify-center items-center h-96">
              <Spinner label="Loading Lead Details..." />
            </div>
          ) : (
            <div className="p-2 md:p-4">
              {property?.property_address && (
                  <div className="h-64 rounded-lg overflow-hidden mb-6">
                      <StreetViewMap address={property.property_address} />
                  </div>
              )}
              <LeadForm 
                property={property}
                contacts={contacts}
                onPropertyChange={handlePropertyChange}
                onContactChange={handleContactChange}
                addContact={addContact}
                removeContact={removeContact}
              />
            </div>
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
