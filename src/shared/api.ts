import { z } from 'zod'

/**
 * The wire format between the app and the API. Shared by both sides so a
 * change to a shape breaks the build rather than production.
 *
 * Money is always an integer in the smallest currency unit. The only
 * floating point field in here is fx_rate_to_base.
 */

const ID = z.string().min(1).max(64)
const CURRENCY = z.string().regex(/^[A-Z]{3}$/, 'ISO-4217-Code erwartet')
const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum als YYYY-MM-DD erwartet')
const CENTS = z.number().int().safe()

export const SPLIT_MODES = ['equal', 'shares', 'percent', 'fixed'] as const
export const ITEM_KINDS = ['item', 'tax', 'tip', 'deposit', 'discount'] as const
export const NETTING_MODES = ['graph', 'direct'] as const

/** The categories the import prompt may return, plus 'transport' for trips. */
export const CATEGORIES = [
  'lebensmittel',
  'getraenke',
  'haushalt',
  'drogerie',
  'restaurant',
  'transport',
  'freizeit',
  'sonstiges',
] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  lebensmittel: 'Lebensmittel',
  getraenke: 'Getränke',
  haushalt: 'Haushalt',
  drogerie: 'Drogerie',
  restaurant: 'Restaurant',
  transport: 'Transport',
  freizeit: 'Freizeit',
  sonstiges: 'Sonstiges',
}

/* ------------------------------------------------------------------ *
 * Records as they come back from the API
 * ------------------------------------------------------------------ */

export const MemberSchema = z.object({
  id: ID,
  group_id: ID,
  display_name: z.string().min(1).max(60),
  color: z.string(),
  sort_order: z.number().int(),
  archived: z.number().int().min(0).max(1),
})

export const SplitSchema = z.object({
  id: ID,
  item_id: ID,
  member_id: ID,
  mode: z.enum(SPLIT_MODES),
  value: z.number(),
})

export const ItemSchema = z.object({
  id: ID,
  receipt_id: ID,
  name: z.string().max(200),
  name_original: z.string().max(200).nullable(),
  qty: z.number(),
  total_cents: CENTS,
  kind: z.enum(ITEM_KINDS),
  category: z.string().nullable(),
  sort_order: z.number().int(),
  splits: z.array(SplitSchema),
})

export const ReceiptSchema = z.object({
  id: ID,
  group_id: ID,
  payer_id: ID,
  merchant: z.string().max(120).nullable(),
  date: ISO_DATE.nullable(),
  note: z.string().max(2000).nullable(),
  currency: CURRENCY,
  fx_rate_to_base: z.number().positive(),
  fx_date: z.string(),
  total_cents: CENTS,
  source: z.enum(['manual', 'import', 'travel']),
  raw_json: z.string().nullable(),
  created_at: z.number().int(),
  updated_at: z.number().int(),
  items: z.array(ItemSchema),
})

export const SettlementSchema = z.object({
  id: ID,
  group_id: ID,
  from_id: ID,
  to_id: ID,
  amount_cents: CENTS,
  settled_at: z.number().int(),
})

export const BudgetSchema = z.object({
  id: ID,
  group_id: ID,
  amount_cents: CENTS.positive(),
  currency: CURRENCY,
  period: z.enum(['once', 'weekly', 'monthly']),
  starts_on: ISO_DATE,
  ends_on: ISO_DATE.nullable(),
  categories: z.string().nullable(),
  active: z.number().int().min(0).max(1),
})

export const GroupSchema = z.object({
  id: ID,
  name: z.string().min(1).max(80),
  base_currency: CURRENCY,
  netting_mode: z.enum(NETTING_MODES),
  show_zetti: z.number().int().min(0).max(1),
  has_pin: z.boolean(),
  revision: z.number().int(),
  created_at: z.number().int(),
  updated_at: z.number().int(),
})

/** Everything about one group, in a single round trip. */
export const SnapshotSchema = z.object({
  group: GroupSchema,
  members: z.array(MemberSchema),
  receipts: z.array(ReceiptSchema),
  settlements: z.array(SettlementSchema),
  budgets: z.array(BudgetSchema),
})

export type Member = z.infer<typeof MemberSchema>
export type Split = z.infer<typeof SplitSchema>
export type Item = z.infer<typeof ItemSchema>
export type Receipt = z.infer<typeof ReceiptSchema>
export type Settlement = z.infer<typeof SettlementSchema>
export type Budget = z.infer<typeof BudgetSchema>
export type Group = z.infer<typeof GroupSchema>
export type Snapshot = z.infer<typeof SnapshotSchema>

/* ------------------------------------------------------------------ *
 * Request bodies
 * ------------------------------------------------------------------ */

export const CreateGroupInput = z.object({
  name: z.string().min(1).max(80),
  base_currency: CURRENCY.default('EUR'),
  /** Optional: create the group with its people in one go. */
  members: z.array(z.object({ display_name: z.string().min(1).max(60), color: z.string() })).optional(),
})

export const UpdateGroupInput = z.object({
  name: z.string().min(1).max(80).optional(),
  base_currency: CURRENCY.optional(),
  netting_mode: z.enum(NETTING_MODES).optional(),
  show_zetti: z.boolean().optional(),
  /** Four digits, or null to remove the PIN. */
  pin: z.string().regex(/^\d{4}$/).nullable().optional(),
})

export const CreateMemberInput = z.object({
  display_name: z.string().min(1).max(60),
  color: z.string(),
  sort_order: z.number().int().optional(),
})

export const UpdateMemberInput = z.object({
  display_name: z.string().min(1).max(60).optional(),
  color: z.string().optional(),
  sort_order: z.number().int().optional(),
  archived: z.boolean().optional(),
})

const ItemInput = z.object({
  id: ID.optional(),
  name: z.string().min(1).max(200),
  name_original: z.string().max(200).nullable().optional(),
  qty: z.number().default(1),
  total_cents: CENTS,
  kind: z.enum(ITEM_KINDS).default('item'),
  category: z.string().nullable().optional(),
  sort_order: z.number().int(),
  splits: z
    .array(
      z.object({
        member_id: ID,
        mode: z.enum(SPLIT_MODES),
        value: z.number(),
      }),
    )
    .default([]),
})

export const SaveReceiptInput = z.object({
  payer_id: ID,
  merchant: z.string().max(120).nullable().optional(),
  date: ISO_DATE.nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  currency: CURRENCY,
  fx_rate_to_base: z.number().positive().default(1),
  fx_date: z.string().optional(),
  total_cents: CENTS,
  source: z.enum(['manual', 'import', 'travel']).default('manual'),
  raw_json: z.string().nullable().optional(),
  items: z.array(ItemInput),
})

export const CreateSettlementInput = z.object({
  from_id: ID,
  to_id: ID,
  amount_cents: CENTS.positive(),
  settled_at: z.number().int().optional(),
})

export const SaveBudgetInput = z.object({
  amount_cents: CENTS.positive(),
  currency: CURRENCY,
  period: z.enum(['once', 'weekly', 'monthly']),
  starts_on: ISO_DATE,
  ends_on: ISO_DATE.nullable().optional(),
  categories: z.array(z.string()).nullable().optional(),
  active: z.boolean().optional(),
})

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

/** Error messages stay factual — the humour lives in the success cases. */
export interface ApiError {
  fehler: string
  feld?: string
}
