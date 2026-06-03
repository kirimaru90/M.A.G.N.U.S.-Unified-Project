import type { TerminalContent, TerminalMeta } from '../../domain/terminal-schema';

export interface TerminalDto {
  id: string;
  hiddenId?: string;
  meta: TerminalMeta;
  campaignId: string;
  views?: number;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Literal shape of `GET /campaigns/:campaignId/terminals` rows. The list endpoint
 * returns flat objects (no nested `meta`), unlike the detail endpoints that emit
 * the full `TerminalContent`. Mapped into `TerminalDto` at the service boundary
 * so the rest of the app keeps the `meta`-nested convention.
 */
export interface TerminalListItem {
  id: string;
  campaignId: string;
  title: string;
  isPublic: boolean;
  viewCount?: number;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Literal shape of `GET /terminals/:id` and `PUT /terminals/:id` responses.
 * The backend wraps the canonical `TerminalContent` in an envelope; we unwrap
 * at the service boundary so consumers continue to operate on `TerminalContent`.
 */
export interface TerminalDetailEnvelope {
  id: string;
  campaignId: string;
  title: string;
  content: TerminalContent;
  state: Record<string, unknown>;
  fictionalUsers: unknown[];
  createdAt: string;
  updatedAt?: string;
}

export function toTerminalDto(item: TerminalListItem): TerminalDto {
  return {
    id: item.id,
    campaignId: item.campaignId,
    meta: { id: item.id, title: item.title, public: item.isPublic },
    views: item.viewCount,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
