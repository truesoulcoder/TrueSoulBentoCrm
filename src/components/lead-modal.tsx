import React from 'react';
import { Input, Select, SelectItem, Textarea, Divider } from '@heroui/react';
import { Button } from './Button';
import { Icon } from '@iconify/react';
import { LEAD_STATUS_OPTIONS, CONTACT_ROLE_OPTIONS } from '@/constants/LeadStatus';

export interface LeadModalProps {
  /** Controls the visibility of the modal */
  isOpen: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** ID of the property to load/edit */
  propertyId: string | null;
  /** Full property record, if preloaded */
  property?: any;
  /** Contacts array, if preloaded */
  contacts?: any[];
  /** Change handler for property fields */
  onPropertyChange?: (name: string, value: any) => void;
  /** Change handler for contact fields */
  onContactChange?: (index: number, name: string, value: any) => void;
  /** Add a new contact entry */
  addContact?: () => void;
  /** Remove an existing contact entry by index */
  removeContact?: (index: number) => void;
}

export const LeadModal: React.FC<LeadModalProps> = ({
  property = {},
  contacts = [],
  onPropertyChange = () => {},
  onContactChange = () => {},
  addContact = () => {},
  removeContact = () => {},
}) => (
  <div className="space-y-6">
    {/* Property Info Section */}
    <h2 className="text-gray-400 uppercase tracking-wide text-sm">Property Info</h2>
    <div className="grid grid-cols-4 gap-4">
      <div className="col-span-1">
        <Select
          label="Lead Status"
          selectedKeys={property.status ? [property.status] : []}
          onSelectionChange={keys => onPropertyChange('status', Array.from(keys)[0] ?? '')}
        >
          {LEAD_STATUS_OPTIONS.map(status => (
            <SelectItem key={status}>{status}</SelectItem>
          ))}
        </Select>
      </div>
      <div className="col-span-1">
        <Input
          label="Market Region"
          value={property.market_region || ''}
          onValueChange={v => onPropertyChange('market_region', v)}
        />
      </div>
      <div className="col-span-1">
        <Input
          label="Assigned User"
          value={property.assigned_user || ''}
          onValueChange={v => onPropertyChange('assigned_user', v)}
        />
      </div>
      {/* Full Address Fields */}
      <Input
        label="Property Address"
        className="col-span-2"
        value={property.property_address || ''}
        onValueChange={v => onPropertyChange('property_address', v)}
      />
      <Input
        label="City"
        value={property.property_city || ''}
        onValueChange={v => onPropertyChange('property_city', v)}
      />
      <Input
        label="State"
        maxLength={2}
        value={property.property_state || ''}
        onValueChange={v => onPropertyChange('property_state', v)}
      />
      <Input
        label="Postal Code"
        value={property.property_postal_code || ''}
        onValueChange={v => onPropertyChange('property_postal_code', v)}
      />
      {/* Dimensions & Values */}
      <Input
        label="Square Footage"
        type="number"
        value={property.square_footage || ''}
        onValueChange={v => onPropertyChange('square_footage', v)}
      />
      <Input
        label="Beds"
        type="number"
        value={property.beds || ''}
        onValueChange={v => onPropertyChange('beds', v)}
      />
      <Input
        label="Baths"
        type="number"
        step="0.1"
        value={property.baths || ''}
        onValueChange={v => onPropertyChange('baths', v)}
      />
      <Input
        label="Year Built"
        type="number"
        value={property.year_built || ''}
        onValueChange={v => onPropertyChange('year_built', v)}
      />
      <Input
        label="Market Value"
        type="number"
        startContent="$"
        value={property.market_value || ''}
        onValueChange={v => onPropertyChange('market_value', v)}
      />
      <Input
        label="Wholesale Value"
        type="number"
        startContent="$"
        value={property.wholesale_value || ''}
        onValueChange={v => onPropertyChange('wholesale_value', v)}
      />
    </div>

    <Divider />

    {/* Contact Info Section */}
    <div className="flex items-center justify-between">
      <h2 className="text-gray-400 uppercase tracking-wide text-sm">Contact Info</h2>
      <div className="flex space-x-2">
        <Icon icon="tabler:mail" className="w-6 h-6 text-gray-500" />
        <Icon icon="mdi:home-edit" className="w-6 h-6 text-gray-500" />
        <Button size="sm" variant="flat" startContent={<Icon icon="lucide:plus" />} onPress={addContact}>
          Add
        </Button>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-6">
      {contacts.map((c, i) => (
        <div key={i} className="space-y-2 p-4 border rounded-md relative">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className="absolute top-2 right-2"
            onPress={() => removeContact(i)}
          >
            <Icon icon="lucide:x" />
          </Button>
          <Input
            label="Contact Name"
            value={c.name || ''}
            onValueChange={v => onContactChange(i, 'name', v)}
          />
          <Input
            label="Email"
            type="email"
            value={c.email || ''}
            onValueChange={v => onContactChange(i, 'email', v)}
          />
          <div className="flex space-x-4">
            <Input
              label="Phone"
              value={c.phone || ''}
              onValueChange={v => onContactChange(i, 'phone', v)}
            />
            <Select
              label="Role"
              selectedKeys={c.role ? [c.role] : []}
              onSelectionChange={keys => onContactChange(i, 'role', Array.from(keys)[0] ?? '')}
            >
              {CONTACT_ROLE_OPTIONS.map(role => (
                <SelectItem key={role}>{role}</SelectItem>
              ))}
            </Select>
          </div>
        </div>
      ))}
    </div>

    <Divider />

    {/* Notes Section */}
    <h2 className="text-gray-400 uppercase tracking-wide text-sm">Notes</h2>
    <Textarea
      label="Notes"
      minRows={8}
      value={property.notes || ''}
      onValueChange={v => onPropertyChange('notes', v)}
    />
  </div>
);
export default LeadModal;
// Note: LEAD_STATUS_OPTIONS and CONTACT_ROLE_OPTIONS should be imported or defined above.
