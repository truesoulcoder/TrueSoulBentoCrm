import React, { useState } from 'react';
import { Mail, FileText, Plus, X } from 'lucide-react';

// --- UI Component Placeholders ---
// Updated to use a "floating label" style for a more modern and compact UI.

const Button = ({ children, variant, size, className, ...props }) => {
  const baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50 disabled:pointer-events-none";
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    flat: "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600",
    light: "hover:bg-slate-200 dark:hover:bg-slate-700",
    danger: "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50"
  };
  const sizeClasses = {
    default: "h-10 py-2 px-4",
    sm: "h-9 px-3",
  };
  const finalClassName = `${baseClasses} ${variantClasses[variant] || variantClasses.flat} ${sizeClasses[size] || sizeClasses.default} ${className || ''}`;
  return <button className={finalClassName} {...props}>{children}</button>;
};

const Input = React.forwardRef(({ label, className, startContent, value, ...props }, ref) => (
  <div className={`relative ${className}`}>
    {startContent && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">{startContent}</span>}
    <input
      ref={ref}
      value={value}
      placeholder=" " // The space is crucial for the floating label to work
      className={`block px-3 pb-2 pt-5 w-full text-sm text-gray-900 dark:text-white bg-white dark:bg-slate-900 rounded-md border border-slate-300 dark:border-slate-600 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 peer ${startContent ? 'pl-7' : ''}`}
      {...props}
    />
    <label
      className={`absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-4 z-10 origin-[0] bg-white dark:bg-slate-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 dark:peer-focus:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-4 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto pointer-events-none ${startContent ? 'left-7' : 'left-1'}`}
    >
      {label}
    </label>
  </div>
));

const Select = ({ label, children, selectedKeys, onSelectionChange, className, ...props }) => (
    <div className={`relative ${className}`}>
        <select
            className="block px-3 pb-2 pt-5 w-full text-sm text-gray-900 dark:text-white bg-white dark:bg-slate-900 rounded-md border border-slate-300 dark:border-slate-600 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 peer"
            value={selectedKeys[0] || ''}
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

const Textarea = React.forwardRef(({ label, className, ...props }, ref) => (
  <div className={`relative ${className}`}>
    <textarea
      ref={ref}
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

// --- Constants ---
const LEAD_STATUS_OPTIONS = [
  "New Lead", "Attempted to Contact", "Contacted", "Working/In Progress", 
  "Contract Sent", "Qualified", "Unqualified/Disqualified", "Nurture",
  "Meeting Set", "Closed - Converted/Customer", "Closed - Not Converted/Opportunity Lost"
];
const CONTACT_ROLE_OPTIONS = ["Decision Maker", "Influencer", "Primary Contact", "Tenant", "Spouse"];
const PROPERTY_TYPE_OPTIONS = ["Single Family", "Condo", "Townhouse", "Multi-Family", "Vacant Land"];
const MLS_STATUS_OPTIONS = ["Active", "Pending", "Sold", "Expired", "Withdrawn"];

// --- LeadForm Component ---
const LeadForm = ({ property, contacts, onPropertyChange, onContactChange, addContact, removeContact }) => (
  <div className="space-y-8">
    {/* Property Info Section */}
    <div>
        <h2 className="text-gray-500 dark:text-gray-400 uppercase tracking-widest text-sm font-bold mb-4">Property Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {/* Left Column */}
            <div className="flex flex-col space-y-4">
                <Select label="Lead Status" selectedKeys={property.status ? [property.status] : []} onSelectionChange={keys => onPropertyChange('status', Array.from(keys)[0] ?? '')}>
                    {LEAD_STATUS_OPTIONS.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </Select>
                <Input label="Property Address" value={property.property_address || ''} onChange={e => onPropertyChange('property_address', e.target.value)} />
                <div className="grid grid-cols-6 gap-4">
                    <Input label="City" value={property.property_city || ''} onChange={e => onPropertyChange('property_city', e.target.value)} className="col-span-3" />
                    <Input label="State" maxLength={2} value={property.property_state || ''} onChange={e => onPropertyChange('property_state', e.target.value)} className="col-span-1" />
                    <Input label="Postal Code" value={property.property_postal_code || ''} onChange={e => onPropertyChange('property_postal_code', e.target.value)} className="col-span-2" />
                </div>
                <div className="grid grid-cols-6 gap-4">
                    {property.property_type === 'Vacant Land' ? (
                        <Input label="Lot Size (sqft)" type="number" value={property.lot_size_sqft || ''} onChange={e => onPropertyChange('lot_size_sqft', e.target.value)} className="col-span-2" />
                    ) : (
                        <Input label="Square Footage" type="number" value={property.square_footage || ''} onChange={e => onPropertyChange('square_footage', e.target.value)} className="col-span-2" />
                    )}
                    <Input label="Beds" type="number" value={property.beds || ''} onChange={e => onPropertyChange('beds', e.target.value)} className="col-span-1" />
                    <Input label="Baths" type="number" step="0.1" value={property.baths || ''} onChange={e => onPropertyChange('baths', e.target.value)} className="col-span-1" />
                    <Input label="Year Built" type="number" value={property.year_built || ''} onChange={e => onPropertyChange('year_built', e.target.value)} className="col-span-2" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Market Value" type="number" startContent="$" value={property.market_value || ''} onChange={e => onPropertyChange('market_value', e.target.value)} />
                    <Input label="Wholesale Value" type="number" startContent="$" value={property.wholesale_value || ''} onChange={e => onPropertyChange('wholesale_value', e.target.value)} />
                </div>
                 <Input label="Assessed Total" type="number" startContent="$" value={property.assessed_total || ''} onChange={e => onPropertyChange('assessed_total', e.target.value)} />
            </div>
            
            {/* Right Column */}
            <div className="flex flex-col space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <Input label="Market Region" value={property.market_region || ''} onChange={e => onPropertyChange('market_region', e.target.value)} />
                    <Input label="Assigned User" value={property.assigned_user || ''} onChange={e => onPropertyChange('assigned_user', e.target.value)} />
                </div>
                <Select label="Property Type" selectedKeys={property.property_type ? [property.property_type] : []} onSelectionChange={keys => onPropertyChange('property_type', Array.from(keys)[0] ?? '')} >
                    {PROPERTY_TYPE_OPTIONS.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </Select>
                {/* MLS Info Subsection */}
                <div className="p-4 border border-dashed border-slate-400 dark:border-slate-500 rounded-lg space-y-4 mt-2">
                    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 -mt-1">MLS Info</h3>
                    <div className="grid grid-cols-5 gap-4">
                        <Select label="MLS Status" selectedKeys={property.mls_status ? [property.mls_status] : []} onSelectionChange={keys => onPropertyChange('mls_status', Array.from(keys)[0] ?? '')} className="col-span-2">
                           {MLS_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </Select>
                        <Input label="MLS DOM" type="number" value={property.mls_days_on_market || ''} onChange={e => onPropertyChange('mls_days_on_market', e.target.value)} className="col-span-1" />
                        <Input label="MLS List Price" type="number" startContent="$" value={property.mls_list_price || ''} onChange={e => onPropertyChange('mls_list_price', e.target.value)} className="col-span-2" />
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                        <Input label="MLS Sqft" type="number" value={property.mls_sqft || ''} onChange={e => onPropertyChange('mls_sqft', e.target.value)} className="col-span-1" />
                        <Input label="MLS Beds" type="number" value={property.mls_beds || ''} onChange={e => onPropertyChange('mls_beds', e.target.value)} className="col-span-1" />
                        <Input label="MLS Baths" type="number" step="0.1" value={property.mls_baths || ''} onChange={e => onPropertyChange('mls_baths', e.target.value)} className="col-span-1" />
                        <Input label="MLS Year Built" type="number" value={property.mls_year_built || ''} onChange={e => onPropertyChange('mls_year_built', e.target.value)} className="col-span-1" />
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
            <Button size="sm" variant="flat" onClick={addContact} className="ml-2">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {contacts.map((c, i) => (
            <div key={i} className="space-y-4 p-4 border border-slate-300 dark:border-slate-700 rounded-lg relative">
              <Button variant="light" className="!absolute top-1 right-1 h-8 w-8 p-0" onClick={() => removeContact(i)}>
                <X className="w-4 h-4 text-gray-500" />
              </Button>
              <Input label="Contact Name" value={c.name || ''} onChange={e => onContactChange(i, 'name', e.target.value)} />
              <Input label="Email" type="email" value={c.email || ''} onChange={e => onContactChange(i, 'email', e.target.value)} />
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <Input label="Phone" value={c.phone || ''} onChange={e => onContactChange(i, 'phone', e.target.value)} className="w-full" />
                <Select label="Role" selectedKeys={c.role ? [c.role] : []} onSelectionChange={keys => onContactChange(i, 'role', Array.from(keys)[0] ?? '')} className="w-full">
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
        <Textarea label="Notes" rows={8} value={property.notes || ''} onChange={e => onPropertyChange('notes', e.target.value)} />
    </div>
  </div>
);


// --- Main App Component ---
export default function App() {
  const [property, setProperty] = useState({
    status: 'New Lead',
    market_region: 'North Texas',
    assigned_user: 'Jane Doe',
    property_address: '123 Oak St',
    property_city: 'Dallas',
    property_state: 'TX',
    property_postal_code: '75201',
    property_type: 'Single Family',
    square_footage: '1850',
    lot_size_sqft: null,
    beds: '3',
    baths: '2',
    year_built: '1998',
    market_value: '350000',
    wholesale_value: '280000',
    assessed_total: '345000',
    notes: 'Initial lead from web form. Homeowner is motivated to sell due to job relocation.',
    mls_status: 'Active',
    mls_days_on_market: '12',
    mls_list_price: '365000',
    mls_sqft: '1850',
    mls_beds: '3',
    mls_baths: '2',
    mls_year_built: '1998',
  });

  const [contacts, setContacts] = useState([
      { name: 'John Smith', email: 'john.smith@example.com', phone: '214-555-1234', role: 'Decision Maker' },
      { name: 'Mary Smith', email: 'mary.smith@example.com', phone: '214-555-1235', role: 'Spouse' },
  ]);

  const handlePropertyChange = (name, value) => {
    setProperty(prev => ({ ...prev, [name]: value }));
  };

  const handleContactChange = (index, name, value) => {
    setContacts(prev => {
      const newContacts = [...prev];
      newContacts[index] = { ...newContacts[index], [name]: value };
      return newContacts;
    });
  };
  
  const addContact = () => {
    setContacts(prev => [...prev, { name: '', email: '', phone: '', role: '' }]);
  };

  const removeContact = (index) => {
    setContacts(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-50 min-h-screen p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto bg-white dark:bg-slate-800/80 rounded-xl shadow-lg">
        <main className="p-6 sm:p-8">
          <LeadForm 
            property={property}
            contacts={contacts}
            onPropertyChange={handlePropertyChange}
            onContactChange={handleContactChange}
            addContact={addContact}
            removeContact={removeContact}
          />
        </main>
        <footer className="mt-4 px-6 sm:px-8 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 rounded-b-xl flex items-center justify-between">
            <Button variant="danger">Delete Lead</Button>
            <div className="flex items-center space-x-2">
                <Button variant="flat">Cancel</Button>
                <Button variant="primary">Save Changes</Button>
            </div>
        </footer>
      </div>
    </div>
  );
}
