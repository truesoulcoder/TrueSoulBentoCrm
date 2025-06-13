// src/components/ui/FloatingLabelSelect.tsx
import React from 'react';

// Define the props interface for type safety
interface FloatingLabelSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: React.ReactNode;
}

const FloatingLabelSelect: React.FC<FloatingLabelSelectProps> = ({ label, children, className, value, ...props }) => {
  // This version uses the :invalid pseudo-class, a standard way to style inputs
  // based on their validation state. A required select is "invalid" if its value is empty.
  return (
    <div className={`relative ${className || ''}`}>
      <select
        required
        value={value} // Control the select's value via props
        className={`
          peer block w-full appearance-none rounded-md border border-slate-300 bg-white
          px-3 pb-2 pt-5 text-sm text-gray-900
          focus:outline-none focus:ring-2 focus:ring-blue-500
          dark:border-slate-600 dark:bg-slate-900 dark:text-white
        `}
        {...props}
      >
        {/* An empty, disabled option is necessary for the 'required' attribute to work correctly */}
        <option value="" disabled hidden></option>
        {children}
      </select>
      <label
        className={`
          pointer-events-none absolute top-4 z-10 origin-[0] -translate-y-4 scale-75 transform
          bg-white px-2 text-sm text-gray-500 duration-300
          
          /* This is the key change: use peer-invalid instead of peer-placeholder-shown */
          peer-invalid:top-1/2 peer-invalid:-translate-y-1/2 peer-invalid:scale-100

          peer-focus:top-4 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2
          peer-focus:text-blue-600 dark:bg-slate-900 dark:text-gray-400
          dark:peer-focus:text-blue-500 left-1
        `}
      >
        {label}
      </label>
    </div>
  );
};

export default FloatingLabelSelect;