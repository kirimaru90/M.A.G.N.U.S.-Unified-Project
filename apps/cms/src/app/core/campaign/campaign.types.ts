import type { StateMapEntry } from '../state/state.types';

export interface CampaignDto {
  id: string;
  name: string;
  isActive: boolean;
  isPublic: boolean;
  state?: Record<string, StateMapEntry>;
}
