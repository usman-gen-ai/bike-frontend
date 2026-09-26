import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@lib/utils';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'error'> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className: _className, error: _error, ...rest }, ref) => {
    const textareaProps = rest as TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean };
    return (
      <div className="w-full">
        <textarea
          ref={ref}
          className={cn(
            'flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            textareaProps.error && 'border-red-500 focus:ring-red-500 focus:border-red-500'
          )}
          {...textareaProps}
        />
        {textareaProps.error && <p className="mt-1 text-sm text-red-600">{textareaProps.error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';