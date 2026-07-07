// PreCali — Lead capture schema (zod 4).
// Validates the x-www-form-urlencoded payload POSTed by the calculators to /api/lead.
// Field names match the legacy Netlify Forms inputs 1:1 to keep the frontend untouched.

import { z } from "zod";

export const leadSchema = z.object({
  nombre: z.string().min(1).max(80),
  apellido: z.string().min(1).max(80),
  email: z.email(),
  banco: z.string().min(1).max(120),
  "tipo-prestamo": z.string().min(1).max(60),
  monto: z.string().min(1).max(40),
  cuota: z.string().min(1).max(40),
  "acepta-terminos": z.literal("sí"),
  "acepta-marketing": z.enum(["sí", "no"]),
  "bot-field": z.string().max(0).optional(),
});

export type Lead = z.infer<typeof leadSchema>;
