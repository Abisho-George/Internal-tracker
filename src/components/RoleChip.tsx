import type { PastelKey, Role } from '@/store/types';
import { Chip, type ChipSize } from './Chip';

export const ROLE_LABEL: Record<Role, string> = {
  resource: 'Resource',
  pm: 'Project Manager',
  management: 'Management',
};

/** Role colours from the spec: resource = mint, PM = sky, management = peach. */
export const ROLE_TONE: Record<Role, PastelKey> = {
  resource: 'mint',
  pm: 'sky',
  management: 'peach',
};

export interface RoleChipProps {
  role: Role;
  size?: ChipSize;
  className?: string;
  /** Override the label (e.g. a job title) while keeping the role colour. */
  label?: string;
}

export function RoleChip({ role, size = 'sm', className, label }: RoleChipProps) {
  return (
    <Chip tone={ROLE_TONE[role]} size={size} className={className}>
      {label ?? ROLE_LABEL[role]}
    </Chip>
  );
}
