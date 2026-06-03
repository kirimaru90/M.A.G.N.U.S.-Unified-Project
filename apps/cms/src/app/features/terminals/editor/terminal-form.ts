import { AbstractControl, FormArray, FormControl, FormGroup, ValidatorFn } from '@angular/forms';
import type {
  Condition,
  Mutation,
  NodeChoice,
  NodeComponent,
  NodeVariant,
  TerminalContent,
  TerminalNode,
} from '../../../domain/terminal-schema';

// ── Types for the form raw value ─────────────────────────────────────────────

export interface MutationRow {
  key: string;
  op: 'set' | 'increment' | 'toggle';
  value: unknown;
  by: number | null;
}

export type ConditionKind = 'leaf' | 'and' | 'or' | 'not';

export interface ConditionLeafRaw {
  kind: 'leaf';
  var: string;
  op: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';
  value: string;
  children: never[];
}

export interface ConditionComboRaw {
  kind: 'and' | 'or' | 'not';
  var: string;
  op: string;
  value: string;
  children: ConditionRaw[];
}

export type ConditionRaw = ConditionLeafRaw | ConditionComboRaw;

export interface StateVarRow {
  name: string;
  type: 'boolean' | 'number' | 'string' | 'enum';
  default: string;
  values: string;
}

export interface UserRow {
  username: string;
  password: string;
}

export interface ChoiceRow {
  label: string;
  target: string;
  hasWhen: boolean;
  when: ConditionRaw | null;
  hasSet: boolean;
  set: MutationRow[];
}

export interface VariantRow {
  isDefault: boolean;
  when: ConditionRaw | null;
  text: string;
  choices: ChoiceRow[];
  components: ComponentRow[];
}

export interface BranchRow {
  isDefault: boolean;
  when: ConditionRaw | null;
  target: string;
}

export interface ComponentRow {
  placeholder: string;
  set: string;
  branches: BranchRow[];
}

export interface NodeRow {
  id: string;
  text: string;
  on_enter: MutationRow[];
  choices: ChoiceRow[];
  variants: VariantRow[];
  components: ComponentRow[];
  loginUsers: string[];
}

// ── Validators ────────────────────────────────────────────────────────────────

export const uniqueNamesValidator: ValidatorFn = (arr: AbstractControl) => {
  const fa = arr as FormArray;
  const names: string[] = fa.controls.map((c) => (c.get('name')?.value as string)?.trim() ?? '');
  const seen = new Set<string>();
  let hasDup = false;
  for (const n of names) {
    if (n && seen.has(n)) { hasDup = true; break; }
    seen.add(n);
  }
  return hasDup ? { duplicateNames: true } : null;
};

export const uniqueNodeIdsValidator: ValidatorFn = (arr: AbstractControl) => {
  const fa = arr as FormArray;
  const ids: string[] = fa.controls.map((c) => (c.get('id')?.value as string)?.trim() ?? '');
  const seen = new Set<string>();
  let hasDup = false;
  for (const id of ids) {
    if (id && seen.has(id)) { hasDup = true; break; }
    seen.add(id);
  }
  return hasDup ? { duplicateIds: true } : null;
};

export function atMostOneDefaultValidator(field: string): ValidatorFn {
  return (arr: AbstractControl) => {
    const fa = arr as FormArray;
    const count = fa.controls.filter((c) => c.get(field)?.value === true).length;
    return count > 1 ? { multipleDefaults: true } : null;
  };
}

// ── Condition helpers ─────────────────────────────────────────────────────────

function makeLeafGroup(
  varName = '', op: ConditionLeafRaw['op'] = 'eq', value = '',
): FormGroup {
  return new FormGroup({
    kind: new FormControl<'leaf'>('leaf'),
    var: new FormControl(varName),
    op: new FormControl(op),
    value: new FormControl(value),
    children: new FormArray([] as FormGroup[]),
  });
}

function makeComboGroup(kind: 'and' | 'or' | 'not'): FormGroup {
  return new FormGroup({
    kind: new FormControl<'and' | 'or' | 'not'>(kind),
    var: new FormControl(''),
    op: new FormControl(''),
    value: new FormControl(''),
    children: new FormArray([] as FormGroup[]),
  });
}

function loadConditionGroup(cond: Condition): FormGroup {
  if ('and' in cond) {
    const g = makeComboGroup('and');
    const children = g.get('children') as FormArray;
    for (const child of (cond as { and: Condition[] }).and) {
      children.push(loadConditionGroup(child));
    }
    return g;
  }
  if ('or' in cond) {
    const g = makeComboGroup('or');
    const children = g.get('children') as FormArray;
    for (const child of (cond as { or: Condition[] }).or) {
      children.push(loadConditionGroup(child));
    }
    return g;
  }
  if ('not' in cond) {
    const g = makeComboGroup('not');
    const children = g.get('children') as FormArray;
    children.push(loadConditionGroup((cond as { not: Condition }).not));
    return g;
  }
  // default: true handled externally — should not arrive here
  const leaf = cond as Record<string, unknown>;
  // accept both new { var, op, value } and legacy { key, <op>: value } shapes
  let varName: string;
  let op: ConditionLeafRaw['op'];
  let value: string;
  if ('var' in leaf) {
    varName = leaf['var'] as string;
    op = leaf['op'] as ConditionLeafRaw['op'];
    const rawVal = leaf['value'];
    value = Array.isArray(rawVal) ? (rawVal as unknown[]).join(',') : String(rawVal ?? '');
  } else {
    varName = leaf['key'] as string;
    const ops = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in'] as const;
    op = ops.find((o) => o in leaf) ?? 'eq';
    const rawVal = leaf[op];
    value = Array.isArray(rawVal) ? (rawVal as unknown[]).join(',') : String(rawVal ?? '');
  }
  return makeLeafGroup(varName, op, value);
}

function serializeCondition(raw: ConditionRaw): Condition {
  if (raw.kind === 'and') {
    return { and: raw.children.map(serializeCondition) };
  }
  if (raw.kind === 'or') {
    return { or: raw.children.map(serializeCondition) };
  }
  if (raw.kind === 'not') {
    return { not: serializeCondition(raw.children[0]) };
  }
  // leaf → canonical { var, op, value }
  const val = parseConditionValue(raw.op, raw.value);
  return { var: raw.var, op: raw.op, value: val } as Condition;
}

function parseConditionValue(op: string, raw: string): unknown {
  if (op === 'in') {
    return raw.split(',').map((s) => s.trim()).filter(Boolean).map(inferPrimitive);
  }
  return inferPrimitive(raw);
}

function inferPrimitive(s: string): unknown {
  if (s === 'true') return true;
  if (s === 'false') return false;
  const n = Number(s);
  if (!isNaN(n) && s !== '') return n;
  return s;
}

// ── Mutation helpers ──────────────────────────────────────────────────────────

function makeMutationGroup(m?: Mutation): FormGroup {
  if (!m) {
    return new FormGroup({
      key: new FormControl(''),
      op: new FormControl<'set' | 'increment' | 'toggle'>('set'),
      value: new FormControl(''),
      by: new FormControl<number | null>(null),
    });
  }
  const op = 'op' in m ? m.op : 'set';
  const value = op === 'set' ? String(('value' in m ? m.value : (m as { value?: unknown }).value) ?? '')
    : 'value' in m && !('op' in m) ? String((m as { value?: unknown }).value ?? '') : '';
  const by = op === 'increment' ? (m as { by: number }).by : null;
  return new FormGroup({
    key: new FormControl(m.key),
    op: new FormControl<'set' | 'increment' | 'toggle'>(op),
    value: new FormControl(value),
    by: new FormControl<number | null>(by),
  });
}

function loadMutationArray(mutations?: Mutation[]): FormArray {
  const fa = new FormArray<FormGroup>([]);
  for (const m of mutations ?? []) {
    fa.push(makeMutationGroup(m));
  }
  return fa;
}

function serializeMutations(rows: MutationRow[]): Mutation[] {
  return rows.map((r) => {
    if (r.op === 'toggle') return { key: r.key, op: 'toggle' as const };
    if (r.op === 'increment') return { key: r.key, op: 'increment' as const, by: r.by ?? 0 };
    return { key: r.key, op: 'set' as const, value: inferPrimitive(String(r.value ?? '')) };
  });
}

// ── Choice helpers ────────────────────────────────────────────────────────────

function makeChoiceGroup(choice?: NodeChoice): FormGroup {
  const whenGroup = choice?.when ? loadConditionGroup(choice.when) : makeLeafGroup();
  return new FormGroup({
    label: new FormControl(choice?.label ?? ''),
    target: new FormControl(choice?.target ?? ''),
    hasWhen: new FormControl(!!choice?.when),
    when: whenGroup,
    hasSet: new FormControl(!!choice?.set?.length),
    set: loadMutationArray(choice?.set),
  });
}

function serializeChoices(rows: ChoiceRow[]): NodeChoice[] {
  return rows.map((r) => {
    const c: NodeChoice = { label: r.label, target: r.target };
    if (r.hasWhen && r.when) c.when = serializeCondition(r.when);
    if (r.hasSet && r.set?.length) c.set = serializeMutations(r.set);
    return c;
  });
}

// ── Variant helpers ───────────────────────────────────────────────────────────

function makeVariantGroup(v?: NodeVariant): FormGroup {
  return new FormGroup({
    isDefault: new FormControl(v?.default === true),
    when: v?.when ? loadConditionGroup(v.when) : makeLeafGroup(),
    text: new FormControl(v?.text ?? ''),
    choices: new FormArray<FormGroup>((v?.choices ?? []).map((c) => makeChoiceGroup(c))),
    components: new FormArray<FormGroup>((v?.components ?? []).map((c) => makeComponentGroup(c))),
  });
}

function serializeVariants(rows: VariantRow[]): NodeVariant[] {
  return rows.map((r) => {
    const v: NodeVariant = {};
    if (r.isDefault) {
      v.default = true;
    } else if (r.when) {
      v.when = serializeCondition(r.when);
    }
    if (r.text.trim()) v.text = r.text;
    if (r.choices?.length) v.choices = serializeChoices(r.choices);
    if (r.components?.length) v.components = serializeComponents(r.components);
    return v;
  });
}

// ── Branch/Component helpers ──────────────────────────────────────────────────

function makeBranchGroup(b?: { when?: Condition; default?: true; target: string }): FormGroup {
  return new FormGroup({
    isDefault: new FormControl(b && 'default' in b),
    when: b && 'when' in b && b.when ? loadConditionGroup(b.when) : makeLeafGroup(),
    target: new FormControl(b?.target ?? ''),
  });
}

function makeComponentGroup(comp?: NodeComponent): FormGroup {
  const c = comp as { type: 'input'; placeholder: string; set: string; branches: unknown[] } | undefined;
  return new FormGroup({
    placeholder: new FormControl(c?.placeholder ?? ''),
    set: new FormControl(c?.set ?? ''),
    branches: new FormArray<FormGroup>(
      (c?.branches ?? []).map((b) =>
        makeBranchGroup(b as { when?: Condition; default?: true; target: string }),
      ),
    ),
  });
}

function serializeComponents(rows: ComponentRow[]): NodeComponent[] {
  return rows.map((r) => ({
    type: 'input' as const,
    placeholder: r.placeholder,
    set: r.set,
    branches: r.branches.map((b) => {
      if (b.isDefault) return { default: true as const, target: b.target };
      return { when: serializeCondition(b.when ?? makeLeafGroup().getRawValue()), target: b.target };
    }),
  }));
}

// ── Node helpers ──────────────────────────────────────────────────────────────

function makeNodeGroup(id: string, node?: TerminalNode): FormGroup {
  const nodeAny = node as (TerminalNode & { login?: { users?: string[] } }) | undefined;
  return new FormGroup({
    id: new FormControl(id),
    text: new FormControl(node?.text ?? ''),
    loginUsers: new FormControl<string[]>(nodeAny?.login?.users ?? []),
    on_enter: loadMutationArray(node?.on_enter),
    choices: new FormArray<FormGroup>((node?.choices ?? []).map((c) => makeChoiceGroup(c))),
    variants: new FormArray<FormGroup>(
      (node?.variants ?? []).map((v) => makeVariantGroup(v)),
      [atMostOneDefaultValidator('isDefault')],
    ),
    components: new FormArray<FormGroup>(
      (node?.components ?? []).map((c) => makeComponentGroup(c)),
    ),
  });
}

// ── State variable helpers ────────────────────────────────────────────────────

function makeStateVarGroup(name: string, v: { type: string; default: unknown; values?: string[] }): FormGroup {
  const defaultStr = v.type === 'boolean' ? String(v.default) : String(v.default ?? '');
  return new FormGroup({
    name: new FormControl(name),
    type: new FormControl(v.type),
    default: new FormControl(defaultStr),
    values: new FormControl(Array.isArray(v.values) ? v.values.join(',') : ''),
  });
}

function emptyStateVarGroup(): FormGroup {
  return new FormGroup({
    name: new FormControl(''),
    type: new FormControl('string'),
    default: new FormControl(''),
    values: new FormControl(''),
  });
}

function serializeStateScope(rows: StateVarRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    if (!r.name.trim()) continue;
    if (r.type === 'boolean') {
      out[r.name] = { type: 'boolean', default: r.default === 'true' };
    } else if (r.type === 'number') {
      out[r.name] = { type: 'number', default: Number(r.default) };
    } else if (r.type === 'enum') {
      const values = r.values.split(',').map((s) => s.trim()).filter(Boolean);
      out[r.name] = { type: 'enum', values, default: r.default };
    } else {
      out[r.name] = { type: 'string', default: r.default };
    }
  }
  return out;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function toForm(content: TerminalContent): FormGroup {
  const localVars = Object.entries(content.state.local ?? {}).map(([name, v]) =>
    makeStateVarGroup(name, v as { type: string; default: unknown; values?: string[] }),
  );
  const globalVars = Object.entries(content.state.global ?? {}).map(([name, v]) =>
    makeStateVarGroup(name, v as { type: string; default: unknown; values?: string[] }),
  );
  const users = (content.login.users ?? []).map((u) =>
    new FormGroup({ username: new FormControl(u.username), password: new FormControl(u.password) }),
  );
  const nodes = Object.entries(content.nodes).map(([id, node]) => makeNodeGroup(id, node));

  return new FormGroup({
    meta: new FormGroup({
      // id is server-owned: loaded for reference but never displayed or serialized back.
      id: new FormControl(content.meta.id ?? null),
      hiddenId: new FormControl(content.meta.hiddenId ?? ''),
      title: new FormControl(content.meta.title),
      public: new FormControl(content.meta.public),
    }),
    stateLocal: new FormArray<FormGroup>(localVars, [uniqueNamesValidator]),
    stateGlobal: new FormArray<FormGroup>(globalVars, [uniqueNamesValidator]),
    users: new FormArray<FormGroup>(users),
    nodes: new FormArray<FormGroup>(nodes, [uniqueNodeIdsValidator]),
  });
}

export function toContent(raw: ReturnType<FormGroup['getRawValue']>): unknown {
  const nodes: Record<string, unknown> = {};
  for (const n of raw.nodes as NodeRow[]) {
    const node: Record<string, unknown> = {};
    if (n.text?.trim()) node['text'] = n.text;
    if (n.loginUsers?.length) node['login'] = { users: n.loginUsers };
    if (n.on_enter?.length) node['on_enter'] = serializeMutations(n.on_enter);
    if (n.choices?.length) node['choices'] = serializeChoices(n.choices);
    if (n.variants?.length) node['variants'] = serializeVariants(n.variants);
    if (n.components?.length) node['components'] = serializeComponents(n.components);
    nodes[n.id] = node;
  }

  // meta.id is server-owned — never sent back on save. meta.hiddenId is emitted only when set.
  const meta: Record<string, unknown> = {
    title: raw.meta.title,
    public: raw.meta.public,
  };
  const hiddenId = typeof raw.meta.hiddenId === 'string' ? raw.meta.hiddenId.trim() : '';
  if (hiddenId) meta['hiddenId'] = hiddenId;

  return {
    meta,
    state: {
      local: serializeStateScope(raw.stateLocal as StateVarRow[]),
      global: serializeStateScope(raw.stateGlobal as StateVarRow[]),
    },
    login: {
      users: (raw.users as UserRow[]).map((u) => ({ username: u.username, password: u.password })),
    },
    nodes,
  };
}

// ── Path-to-control resolver ──────────────────────────────────────────────────

export function resolveControlByPath(
  form: FormGroup,
  path: (string | number)[],
): AbstractControl | null {
  try {
    let ctrl: AbstractControl = form;
    for (const segment of path) {
      if (typeof segment === 'number') {
        ctrl = (ctrl as FormArray).at(segment);
      } else {
        // Map schema field names to form field names
        const mapped = mapSchemaFieldToForm(segment);
        const child = (ctrl as FormGroup).get(mapped);
        if (!child) return null;
        ctrl = child;
      }
    }
    return ctrl;
  } catch {
    return null;
  }
}

function mapSchemaFieldToForm(field: string): string {
  if (field === 'state') return 'stateLocal';
  if (field === 'local') return 'stateLocal';
  if (field === 'global') return 'stateGlobal';
  if (field === 'users') return 'users';
  return field;
}

// ── Factory helpers (used by child components) ────────────────────────────────

export { makeLeafGroup, makeComboGroup, makeMutationGroup, makeChoiceGroup, makeVariantGroup, makeBranchGroup, makeComponentGroup, makeNodeGroup, makeStateVarGroup, emptyStateVarGroup, serializeCondition, serializeMutations };
