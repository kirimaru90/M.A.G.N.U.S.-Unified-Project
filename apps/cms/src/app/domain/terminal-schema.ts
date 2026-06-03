import { z } from 'zod';

// ── Meta ──────────────────────────────────────────────────────────────────────

export const MetaSchema = z.object({
  // Server-owned API identifier. Injected by the API on every read; never sent by the
  // client on create/import/update and stripped from exports. Used only in API call paths
  // (e.g. /terminals/:id), never displayed in the UI.
  id: z.string().optional(),
  // User-authored, human-friendly slug. Optional and unique within the campaign (only
  // enforced when present). Round-trips on import/export and is the only id surfaced in the UI.
  hiddenId: z.string().optional(),
  title: z.string().min(1),
  public: z.boolean(),
});

// ── State variables ───────────────────────────────────────────────────────────

const BooleanStateVarSchema = z.object({ type: z.literal('boolean'), default: z.boolean() });
const NumberStateVarSchema = z.object({ type: z.literal('number'), default: z.number() });
const StringStateVarSchema = z.object({ type: z.literal('string'), default: z.string() });
const EnumStateVarSchema = z
  .object({ type: z.literal('enum'), values: z.array(z.string()).min(1), default: z.string() })
  .superRefine((val, ctx) => {
    if (!val.values.includes(val.default)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['default'],
        message: 'Default value must be one of the declared enum values',
      });
    }
  });

export const StateVariableSchema = z.discriminatedUnion('type', [
  BooleanStateVarSchema,
  NumberStateVarSchema,
  StringStateVarSchema,
  EnumStateVarSchema,
]);

export const StateDeclarationSchema = z.object({
  local: z.record(z.string(), StateVariableSchema),
  global: z.record(z.string(), StateVariableSchema),
});

// ── Login block ───────────────────────────────────────────────────────────────

/**
 * Fictional passwords are cleartext at rest in terminal content and are
 * stripped by the API before delivery to the Terminal player app.
 */
export const LoginUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const LoginBlockSchema = z.object({
  users: z.array(LoginUserSchema),
});

// ── Mutations ─────────────────────────────────────────────────────────────────

const MutationSetSchema = z.object({ key: z.string(), op: z.literal('set'), value: z.unknown() });
// Shorthand set form used in the reference architecture doc (no explicit op)
const MutationSetShorthandSchema = z.object({ key: z.string(), value: z.unknown() });
const MutationIncrementSchema = z.object({
  key: z.string(),
  op: z.literal('increment'),
  by: z.number(),
});
const MutationToggleSchema = z.object({ key: z.string(), op: z.literal('toggle') });

export const MutationSchema = z.union([
  MutationSetSchema,
  MutationIncrementSchema,
  MutationToggleSchema,
  MutationSetShorthandSchema,
]);

// ── Conditions (recursive) ────────────────────────────────────────────────────

const PrimitiveValue = z.union([z.string(), z.number(), z.boolean()]);

const LeafPredicateSchema = z.union([
  // canonical new shape
  z.object({ var: z.string(), op: z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte']), value: PrimitiveValue }).strict(),
  z.object({ var: z.string(), op: z.literal('in'), value: z.array(PrimitiveValue) }).strict(),
  // legacy shape — read tolerance only; serializer always writes the new shape
  z.object({ key: z.string(), eq: PrimitiveValue }).strict(),
  z.object({ key: z.string(), neq: PrimitiveValue }).strict(),
  z.object({ key: z.string(), gt: PrimitiveValue }).strict(),
  z.object({ key: z.string(), lt: PrimitiveValue }).strict(),
  z.object({ key: z.string(), gte: PrimitiveValue }).strict(),
  z.object({ key: z.string(), lte: PrimitiveValue }).strict(),
  z.object({ key: z.string(), in: z.array(PrimitiveValue) }).strict(),
]);

export type Condition =
  | z.infer<typeof LeafPredicateSchema>
  | { and: Condition[] }
  | { or: Condition[] }
  | { not: Condition }
  | { default: true };

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    LeafPredicateSchema,
    z.object({ and: z.array(ConditionSchema) }).strict(),
    z.object({ or: z.array(ConditionSchema) }).strict(),
    z.object({ not: ConditionSchema }).strict(),
    z.object({ default: z.literal(true) }).strict(),
  ]),
);

// ── Node building blocks ──────────────────────────────────────────────────────

export const NodeChoiceSchema = z.object({
  label: z.string().min(1),
  target: z.string(),
  when: ConditionSchema.optional(),
  set: z.array(MutationSchema).optional(),
});

const BranchSchema = z.union([
  z.object({ when: ConditionSchema, target: z.string() }),
  z.object({ default: z.literal(true), target: z.string() }),
]);

export const NodeComponentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('input'),
    placeholder: z.string(),
    set: z.string(),
    branches: z.array(BranchSchema),
  }),
]);

export const NodeVariantSchema = z.object({
  when: ConditionSchema.optional(),
  default: z.literal(true).optional(),
  text: z.string().optional(),
  choices: z.array(NodeChoiceSchema).optional(),
  components: z.array(NodeComponentSchema).optional(),
});

export const TerminalNodeSchema = z.object({
  text: z.string().optional(),
  on_enter: z.array(MutationSchema).optional(),
  choices: z.array(NodeChoiceSchema).optional(),
  variants: z.array(NodeVariantSchema).optional(),
  components: z.array(NodeComponentSchema).optional(),
});

// ── Top-level schema ──────────────────────────────────────────────────────────

export const TerminalContentSchema = z.object({
  meta: MetaSchema,
  state: StateDeclarationSchema,
  login: LoginBlockSchema,
  nodes: z
    .record(z.string(), TerminalNodeSchema)
    .refine((map) => Object.keys(map).length > 0, {
      message: 'At least one node is required',
    }),
});

// ── Derived TypeScript types ──────────────────────────────────────────────────

export type TerminalContent = z.infer<typeof TerminalContentSchema>;
export type TerminalMeta = z.infer<typeof MetaSchema>;
export type StateDeclaration = z.infer<typeof StateDeclarationSchema>;
export type LoginBlock = z.infer<typeof LoginBlockSchema>;
export type TerminalNode = z.infer<typeof TerminalNodeSchema>;
export type NodeChoice = z.infer<typeof NodeChoiceSchema>;
export type NodeVariant = z.infer<typeof NodeVariantSchema>;
export type NodeComponent = z.infer<typeof NodeComponentSchema>;
export type Mutation = z.infer<typeof MutationSchema>;
