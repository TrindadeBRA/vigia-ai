import { z } from "zod";

export const CalendarKindSchema = z.enum(["events", "tasks"]);
export type CalendarKind = z.infer<typeof CalendarKindSchema>;

export const CalendarEventSchema = z.object({
    uid: z.string().nullable().default(null),
    summary: z.string().default(""),
    description: z.string().nullable().default(null),
    location: z.string().nullable().default(null),
    dtstart: z.string().nullable().default(null),
    dtend: z.string().nullable().default(null),
    due: z.string().nullable().default(null),
    status: z.string().nullable().default(null),
    allDay: z.boolean().default(false),
    kind: CalendarKindSchema.default("events"),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CalendarSourceSchema = z.object({
    id: z.string(),
    label: z.string().default(""),
    url: z.string(),
    kind: CalendarKindSchema.default("events"),
    limit: z.number().int().min(1).max(50).default(5),
    ok: z.boolean().default(true),
    error: z.string().nullable().default(null),
    events: z.array(CalendarEventSchema).default([]),
    updated_at: z.string().nullable().default(null),
});
export type CalendarSource = z.infer<typeof CalendarSourceSchema>;

export const CalendarPayloadSchema = z.object({
    ok: z.boolean().default(true),
    error: z.string().nullable().default(null),
    updated_at: z.string().nullable().default(null),
    calendars: z.array(CalendarSourceSchema).default([]),
});
export type CalendarPayload = z.infer<typeof CalendarPayloadSchema>;

export const CalendarConfigItemSchema = z.object({
    id: z.string(),
    label: z.string().default(""),
    url: z.string().min(1),
    kind: CalendarKindSchema.default("events"),
    limit: z.number().int().min(1).max(50).default(5),
});
export type CalendarConfigItem = z.infer<typeof CalendarConfigItemSchema>;

export const CalendarConfigSchema = z.object({
    enabled: z.boolean().default(false),
    hidden: z.boolean().default(false),
    calendars: z.array(CalendarConfigItemSchema).default([]),
});
export type CalendarConfig = z.infer<typeof CalendarConfigSchema>;

export const CalendarBodySchema = z.object({
    url: z.string().min(1),
    label: z.string().default(""),
    kind: CalendarKindSchema.default("events"),
    limit: z.number().int().min(1).max(50).nullable().default(null),
});
export type CalendarBody = z.infer<typeof CalendarBodySchema>;

export const CalendarPatchSchema = z.object({
    enabled: z.boolean().nullable().default(null),
    hidden: z.boolean().nullable().default(null),
});
export type CalendarPatch = z.infer<typeof CalendarPatchSchema>;

export const CalendarItemPatchSchema = z.object({
    url: z.string().nullable().default(null),
    label: z.string().nullable().default(null),
    kind: CalendarKindSchema.nullable().default(null),
    limit: z.number().int().min(1).max(50).nullable().default(null),
});
export type CalendarItemPatch = z.infer<typeof CalendarItemPatchSchema>;
