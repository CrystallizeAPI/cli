import type { PimCredentials } from '../contracts/models/credentials';
import type { AsyncCreateClient } from '../contracts/credential-retriever';

type Deps = {
    createCrystallizeClient: AsyncCreateClient;
};

export const createFetchAvailableTenantIdentifier =
    ({ createCrystallizeClient }: Deps) =>
    async (credentials: PimCredentials, identifier: string) => {
        const apiClient = await createCrystallizeClient({
            tenantIdentifier: '',
            accessTokenId: credentials.ACCESS_TOKEN_ID,
            accessTokenSecret: credentials.ACCESS_TOKEN_SECRET,
        });
        const result = await apiClient.pimApi(
            `query { tenant { suggestIdentifier ( desired: "${identifier}" ) { suggestion } } }`,
        );
        return result.tenant?.suggestIdentifier?.suggestion || identifier;
    };
