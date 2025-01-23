import type { createClient } from '@crystallize/js-api-client';
import type { PimCredentials } from '../contracts/models/credentials';

type Deps = {
    createCrystallizeClient: typeof createClient;
};

export const createFetchAvailableTenantIdentifier =
    ({ createCrystallizeClient }: Deps) =>
    async (credentials: PimCredentials, identifier: string) => {
        const apiClient = createCrystallizeClient({
            tenantIdentifier: '',
            accessTokenId: credentials.ACCESS_TOKEN_ID,
            accessTokenSecret: credentials.ACCESS_TOKEN_SECRET,
        });
        const result = await apiClient.pimApi(
            `query { tenant { suggestIdentifier ( desired: "${identifier}" ) { suggestion } } }`,
        );
        return result.tenant?.suggestIdentifier?.suggestion || identifier;
    };
