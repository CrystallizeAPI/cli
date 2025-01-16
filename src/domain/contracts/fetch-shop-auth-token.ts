import type { PimCredentials } from './models/credentials';

export type FetchShopAuthToken = (
    tenantIdentifier: string,
    credentials: PimCredentials,
    scopes: string[],
    expiresIn: number,
) => Promise<string>;
