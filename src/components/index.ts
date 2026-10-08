/*
 * Shared UI kit. Import from '@/components'.
 * See docs/ARCHITECTURE.md → "Component kit" for the props summary.
 */

export { cn } from './cn';
export { formatDuration, initialsOf } from './format';
export { TONE_SOFT, TONE_SOFT_BG, TONE_STRONG_BG, TONE_TEXT, TONE_STROKE, TONE_BORDER } from './tones';

export { Card, type CardProps } from './Card';
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { IconButton, type IconButtonProps } from './IconButton';
export { Chip, type ChipProps, type ChipSize } from './Chip';
export { RatingChip, RATING_STYLE, type RatingChipProps } from './RatingChip';
export { PriorityBadge, type PriorityBadgeProps } from './PriorityBadge';
export { StatusChip, type StatusChipProps } from './StatusChip';
export { RoleChip, ROLE_LABEL, ROLE_TONE, type RoleChipProps } from './RoleChip';
export { Avatar, AvatarStack, type AvatarProps, type AvatarStackProps, type AvatarSize } from './Avatar';
export { ProjectChip, type ProjectChipProps } from './ProjectChip';

export { Modal, type ModalProps } from './Modal';
export { SlideOver, type SlideOverProps } from './SlideOver';
export { Popover, type PopoverProps, type PopoverTriggerProps } from './Popover';
export { useFocusTrap } from './useFocusTrap';

export { SegmentedControl, type SegmentedControlProps, type SegmentedOption } from './SegmentedControl';
export { PillToggle, type PillToggleProps } from './PillToggle';
export { NumberStepper, type NumberStepperProps } from './NumberStepper';
export { Checkbox, type CheckboxProps } from './Checkbox';
export { TextInput, TextArea, Field, type TextInputProps, type TextAreaProps, type FieldProps } from './Field';

export { ProgressBar, type ProgressBarProps } from './ProgressBar';
export { DayProgressLine, type DayProgressLineProps } from './DayProgressLine';
export { HealthRing, healthTone, type HealthRingProps } from './HealthRing';
export { KpiTile, DeltaPill, type KpiTileProps, type KpiDelta } from './KpiTile';

export { EmptyState, type EmptyStateProps } from './EmptyState';
export { Skeleton, PageSkeleton } from './Skeleton';
export { Page, type PageProps } from './Page';
export { SectionHeader, type SectionHeaderProps } from './SectionHeader';
export { Tooltip, type TooltipProps } from './Tooltip';
export { ComingSoon, type ComingSoonProps } from './ComingSoon';
export { VisuallyHidden } from './VisuallyHidden';

export { toast, dismissToast, Toaster, useToastStore, type ToastOptions, type ToastTone } from './toast';
export { celebrate, type CelebrateOptions } from './celebrate';
export { ChartTooltip, type ChartTooltipProps } from './ChartTooltip';
