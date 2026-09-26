import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@lib/utils';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'error'> {
  error?: boolean;
  label?: string;
  required?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className: _className, error: _error, label, required, children, ...rest }, ref) => {
    const selectProps = rest as SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean; label?: string; required?: boolean };
    return (
      <div className="w-full">
        {selectProps.label && (
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            {selectProps.label} {selectProps.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            'flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            selectProps.error && 'border-red-500 focus:ring-red-500 focus:border-red-500'
          )}
          {...selectProps}
        >
          {children}
        </select>
        {selectProps.error && <p className="mt-1 text-sm text-red-600">{selectProps.error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';