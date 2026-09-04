import { z } from "zod";

export const CurrencyKindSchema = z.enum(["fiat", "crypto"]);
export type CurrencyKind = z.infer<typeof CurrencyKindSchema>;

export const CurrencyItemSchema = z.object({
  id: z.string(),
  kind: CurrencyKindSchema,
  code: z.string(),
  label: z.string().default(""),
});
export type CurrencyItem = z.infer<typeof CurrencyItemSchema>;

export const CurrenciesConfigSchema = z.object({
  enabled: z.boolean().default(false),
  hidden: z.boolean().default(false),
  base: z.string().default("BRL"),
  items: z.array(CurrencyItemSchema).default([]),
});
export type CurrenciesConfig = z.infer<typeof CurrenciesConfigSchema>;

export const CurrencyQuoteSchema = z.object({
  id: z.string(),
  kind: CurrencyKindSchema,
  code: z.string(),
  label: z.string().default(""),
  price: z.number().nullable().default(null),
  ok: z.boolean().default(true),
  error: z.string().nullable().default(null),
});
export type CurrencyQuote = z.infer<typeof CurrencyQuoteSchema>;

export const CurrenciesPayloadSchema = z.object({
  ok: z.boolean().default(true),
  error: z.string().nullable().default(null),
  updated_at: z.string().nullable().default(null),
  base: z.string().default("BRL"),
  items: z.array(CurrencyQuoteSchema).default([]),
});
export type CurrenciesPayload = z.infer<typeof CurrenciesPayloadSchema>;

export const CurrencyItemBodySchema = z.object({
  kind: CurrencyKindSchema,
  code: z.string(),
  label: z.string().default(""),
});
export type CurrencyItemBody = z.infer<typeof CurrencyItemBodySchema>;

export const CurrenciesPatchSchema = z.object({
  enabled: z.boolean().nullable().default(null),
  hidden: z.boolean().nullable().default(null),
  base: z.string().nullable().default(null),
});
export type CurrenciesPatch = z.infer<typeof CurrenciesPatchSchema>;

export const CurrencySearchResultSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
});
export type CurrencySearchResult = z.infer<typeof CurrencySearchResultSchema>;

export const CurrencySearchResponseSchema = z.object({
  results: z.array(CurrencySearchResultSchema).default([]),
});
export type CurrencySearchResponse = z.infer<typeof CurrencySearchResponseSchema>;
