import type { ClientConfiguration, ClientInterface, CreateClientOptions } from '@crystallize/js-api-client';
import type { PimAuthenticatedUser } from './models/authenticated-user';
import type { PimCredentials } from './models/credentials';

export type CredentialRetrieverOptions = {
    token_id?: string;
    token_secret?: string;
};

export type CredentialRetriever = {
    getCredentials: (options?: CredentialRetrieverOptions) => Promise<PimCredentials>;
    checkCredentials: (credentials: PimCredentials) => Promise<PimAuthenticatedUser | undefined>;
    removeCredentials: () => Promise<void>;
    saveCredentials: (credentials: PimCredentials) => Promise<void>;
};

export type AsyncCreateClient = (
    configuration: ClientConfiguration,
    options?: CreateClientOptions,
) => Promise<ClientInterface>;
