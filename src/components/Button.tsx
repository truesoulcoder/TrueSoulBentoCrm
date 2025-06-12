import React from 'react';
import { clsx } from 'clsx';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Content rendered inside the button */
  children: React.ReactNode;
  /** Visual style variant */
  variant?: 'flat' | 'light' | 'outline' | 'default';
  /** Size of the button */
  size?: 'sm' | 'md' | 'lg';
  /** Additional custom classes */
  className?: string;
  /** Primary color name or hex */
  color?: string;
  /** Click handler alias for onClick */
  onPress?: React.MouseEventHandler<HTMLButtonElement>;
  /** Show loading indicator */
  isLoading?: boolean;
}

/**
 * A floating-label UI Button with variant, size, and loading state support.
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  color,
  onPress,
  isLoading = false,
  disabled,
  ...props
}) => {
  const base = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  const variantClasses = {
    default: 'bg-slate-700 text-white hover:bg-slate-800',
    flat: 'bg-transparent hover:bg-slate-100',
    light: 'bg-white shadow-sm hover:shadow-lg',
    outline: 'border border-slate-400 hover:bg-slate-50',
  };

  const styleClasses = clsx(
    base,
    sizeClasses[size],
    variantClasses[variant],
    className,
    color && `text-[${color}]`
  );

  return (
    <button
      type="button"
      className={styleClasses}
      onClick={onPress}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="animate-spin">⏳</span>
      ) : (
        children
      )}
    </button>
  );
};
