import { z } from 'zod';

export const MutationInputSchema = z.object({
    mutation: z.string(),
    target: z.enum(['pim', 'core']),
    sets: z.array(z.any()),
});
export type MutationInput = z.infer<typeof MutationInputSchema>;

export const MutationsInputSchema = z.record(MutationInputSchema);
export type MutationsInput = z.infer<typeof MutationsInputSchema>;
