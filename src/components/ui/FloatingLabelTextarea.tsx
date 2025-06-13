// src/components/ui/FloatingLabelTextarea.tsx
import React from 'react';

// Define the props interface for type safety
interface FloatingLabelTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

const FloatingLabelTextarea = React.forwardRef<HTMLTextAreaElement, FloatingLabelTextareaProps>(
  ({ label, className, ...props }, ref) => {
    // This is the exact structure and styling from your concept file.
    return (
      <div className={`relative ${className || ''}`}>
        <textarea
          ref={ref}
          placeholder=" " // The space is crucial for the floating label to work
          className={`
            peer block w-full appearance-none rounded-md border border-slate-300 bg-white
            px-3 pb-2 pt-5 text-sm text-gray-900
            focus:outline-none focus:ring-2 focus:ring-blue-500
            dark:border-slate-600 dark:bg-slate-900 dark:text-white
          `}
          {...props}
        />
        <label
          className={`
            pointer-events-none absolute top-4 z-10 origin-[0] -translate-y-4 scale-75 transform
            bg-white px-2 text-sm text-gray-500 duration-300
            peer-placeholder-shown:top-6 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100
            peer-focus:top-4 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2
            peer-focus:text-blue-600 dark:bg-slate-900 dark:text-gray-400
            dark:peer-focus:text-blue-500 left-1
          `}
        >
          {label}
        </label>
      </div>
    );
  }
);

// Set a display name for better debugging in React DevTools
FloatingLabelTextarea.displayName = 'FloatingLabelTextarea';

export default FloatingLabelTextarea;