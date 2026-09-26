import { forwardRef } from 'react';
import { cn } from '@lib/utils';

export interface InputProps {
  type?: string;
  className?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  name?: string;
  id?: string;
  autoComplete?: string;
  required?: boolean;
  readOnly?: boolean;
  min?: string;
  max?: string;
  step?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  autoFocus?: boolean;
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className: _className, ...rest }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            'flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            rest.error && 'border-red-500 focus:ring-red-500 focus:border-red-500'
          )}
          {...rest}
        />
        {rest.error && <p className="mt-1 text-sm text-red-600">{rest.error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';