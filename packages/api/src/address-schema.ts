import { z } from 'zod'

export const addressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  countryCode: z.string().length(2),
  phone: z.string().optional(),
})
