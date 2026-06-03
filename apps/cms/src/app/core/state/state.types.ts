export type StateVarType = 'boolean' | 'number' | 'string' | 'enum';

export interface StateEntryDto {
  key: string;
  type: StateVarType;
  default: boolean | number | string;
  current: boolean | number | string;
  values?: string[];
}

export type StateScope = 'local' | 'global';

export interface MutationAtom {
  key: string;
  op: 'set' | 'increment' | 'toggle';
  value?: unknown;
  by?: number;
}

export interface MutateStateBody {
  mutations: MutationAtom[];
}

export interface StateEntryShape {
  type: StateVarType;
  default: boolean | number | string;
  values?: string[];
}

export interface StateMapEntry extends StateEntryShape {
  value: unknown;
}

export interface StateSchemaOp {
  action: 'add' | 'update' | 'delete';
  name: string;
  rename?: string;
  entry?: StateEntryShape;
  value?: unknown;
}

export interface StateSchemaConflictItem {
  variable: string;
  referencedBy: { id: string; title: string }[];
}

export interface StateSchemaConflictResponse {
  error: string;
  conflicts: StateSchemaConflictItem[];
}

export type FlatState = Record<string, unknown>;
