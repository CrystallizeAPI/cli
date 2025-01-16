import type { Envelope, QueryHandlerDefinition } from 'missive.js';
import type { PimCredentials } from '../contracts/models/credentials';
import type { FetchShopAuthToken } from '../contracts/fetch-shop-auth-token';

type Deps = {
    fetchShopApiToken: FetchShopAuthToken;
};

type Query = {
    tenantIdentifier: string;
    credentials: PimCredentials;
    scopes: string[];
    expiresIn: number;
};

export type GetShopAuthTokenHandlerDefinition = QueryHandlerDefinition<
    'GetShopAuthToken',
    Query,
    Awaited<ReturnType<typeof handler>>
>;

const handler = async (envelope: Envelope<Query>, deps: Deps) => {
    const { fetchShopApiToken } = deps;
    const { tenantIdentifier, credentials, scopes, expiresIn } = envelope.message;

    const token = await fetchShopApiToken(tenantIdentifier, credentials, scopes, expiresIn);
    return { token };
};

export const createGetShopAuthTokenHandler = (deps: Deps) => (query: Envelope<Query>) => handler(query, deps);
