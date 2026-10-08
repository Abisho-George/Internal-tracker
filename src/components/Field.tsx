import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from './cn';

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Softly highlights the field (e.g. a value that needs another look). */
  invalid?: boolean;
}

/** Styled text input (uses the `.input` class). */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className, invalid, type = 'text', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn('input', invalid && 'border-butter-strong focus:ring-butter-strong/40', className)}
      {...rest}
    />
  );
});

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

/** Styled multi-line input. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { className, invalid, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        'input resize-y leading-relaxed',
        invalid && 'border-butter-strong focus:ring-butter-strong/40',
        className,
      )}
      {...rest}
    />
  );
});

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  /** Explicit id of the control to label. Otherwise a single input child is wired up automatically. */
  htmlFor?: string;
  /** Shows a small "Optional" tag next to the label. */
  optional?: boolean;
  className?: string;
}

const LABELLABLE = new Set<unknown>(['input', 'textarea', 'select', TextInput, TextArea]);

/**
 * Label + control + hint. With a single TextInput / TextArea / input / select child,
 * the label is linked to it automatically; otherwise the children are wrapped in a
 * labelled group (good for pill pickers or steppers).
 */
export function Field({ label, hint, children, htmlFor, optional = false, className }: FieldProps) {
  const autoId = useId();
  const hintId = `${autoId}-hint`;
  const labelId = `${autoId}-label`;

  const only = Children.count(children) === 1 ? Children.toArray(children)[0] : null;
  const canLink = !htmlFor && isValidElement(only) && LABELLABLE.has(only.type);
  const childProps = canLink ? ((only as ReactElement).props as { id?: string; 'aria-describedby'?: string }) : {};
  const controlId = htmlFor ?? (canLink ? (childProps.id ?? autoId) : undefined);

  const labelRow = (
    <span className="flex items-center gap-2 text-sm font-semibold text-ink">
      {label}
      {optional && <span className="text-xs font-medium text-faint">Optional</span>}
    </span>
  );

  let control: ReactNode = children;
  if (canLink) {
    control = cloneElement(only as ReactElement<{ id?: string; 'aria-describedby'?: string }>, {
      id: controlId,
      'aria-describedby': cn(childProps['aria-describedby'], hint ? hintId : undefined) || undefined,
    });
  }

  const hintEl = hint ? (
    <p id={hintId} className="text-xs text-muted">
      {hint}
    </p>
  ) : null;

  if (controlId) {
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label htmlFor={controlId} className="w-fit">
          {labelRow}
        </label>
        {control}
        {hintEl}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={hint ? hintId : undefined}
      className={cn('flex flex-col gap-1.5', className)}
    >
      <span id={labelId}>{labelRow}</span>
      {control}
      {hintEl}
    </div>
  );
}
