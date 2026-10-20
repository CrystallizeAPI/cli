import type { Envelope, QueryHandlerDefinition } from 'missive.js';
import { z } from 'zod';
import type { SuperfastShop } from '../contracts/models/superfast-shop';

export const SUPERFAST_SHOPS_URL = 'https://superfast.shop/demos.json';
const FETCH_TIMEOUT_MS = 10_000;

type Query = {};

export type FetchSuperfastShopsHandlerDefinition = QueryHandlerDefinition<
    'FetchSuperfastShops',
    Query,
    Awaited<ReturnType<typeof handler>>
>;

const PayloadSchema = z.object({ stores: z.array(z.unknown()) });
const ShopSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    prompt: z.string().min(1),
    url: z.string().catch(''),
    industry: z.string().catch(''),
    description: z.string().catch(''),
    features: z.array(z.string()).catch([]),
    isNew: z.boolean().catch(false),
    promptUrl: z.string().catch(''),
});

export const parseSuperfastShops = (payload: unknown): SuperfastShop[] => {
    const parsed = PayloadSchema.safeParse(payload);
    if (!parsed.success) {
        throw new Error('Unexpected format, no list of stores.');
    }
    // one broken store must not hide the others
    return parsed.data.stores.flatMap((store) => {
        const shop = ShopSchema.safeParse(store);
        return shop.success ? [shop.data] : [];
    });
};

const handler = async (_: Envelope<Query>) => {
    try {
        const response = await fetch(SUPERFAST_SHOPS_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return { shops: parseSuperfastShops(await response.json()) };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Could not load the Superfast Shops from ${SUPERFAST_SHOPS_URL}: ${message}`);
    }
};

export const createFetchSuperfastShopsHandler = () => (query: Envelope<Query>) => handler(query);
