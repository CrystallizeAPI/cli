import type { Envelope, QueryHandlerDefinition } from 'missive.js';
import type { PimCredentials } from '../contracts/models/credentials';
import type { AsyncCreateClient } from '../contracts/credential-retriever';

type Deps = {
    createCrystallizeClient: AsyncCreateClient;
};

type Query = {
    tenantIdentifier: string;
    credentials: PimCredentials;
};

export type GetStaticAuthTokenHandlerDefinition = QueryHandlerDefinition<
    'GetStaticAuthToken',
    Query,
    Awaited<ReturnType<typeof handler>>
>;

const handler = async (envelope: Envelope<Query>, deps: Deps) => {
    const { createCrystallizeClient } = deps;
    const { tenantIdentifier, credentials } = envelope.message;
    const client = await createCrystallizeClient({
        tenantIdentifier: tenantIdentifier,
        sessionId: credentials.sessionId,
        accessTokenId: credentials.ACCESS_TOKEN_ID,
        accessTokenSecret: credentials.ACCESS_TOKEN_SECRET,
    });

    const results = await client.nextPimApi(`#graphql
        query {
            tenant {
                ... on Tenant {
                    staticAuthToken
                }
                ... on BasicError {
                    error: message
                }
            }
        }
    `);

    if (results.tenant.error) {
        throw new Error(results.tenant.error);
    }
    return {
        token: results.tenant.staticAuthToken,
    };
};

export const createGetStaticAuthTokenHandler = (deps: Deps) => (query: Envelope<Query>) => handler(query, deps);
