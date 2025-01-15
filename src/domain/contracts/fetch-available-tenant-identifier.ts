import type { PimCredentials } from './models/credentials';

export type FetchAvailableTenantIdentifier = (credentials: PimCredentials, identifier: string) => Promise<string>;
