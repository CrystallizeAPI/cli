import type { createClient } from '@crystallize/js-api-client';
import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import type { Tenant } from '../contracts/models/tenant';
import type { CommandHandlerDefinition, Envelope } from 'missive.js';
import type { PimCredentials } from '../contracts/models/credentials';

type Deps = {
    createCrystallizeClient: typeof createClient;
};
type Command = {
    tenant: Tenant;
    credentials: PimCredentials;
};

export type CreateCleanTenantHandlerDefinition = CommandHandlerDefinition<
    'CreateCleanTenant',
    Command,
    Awaited<ReturnType<typeof handler>>
>;

const handler = async (
    envelope: Envelope<Command>,
    { createCrystallizeClient }: Deps,
): Promise<{
    id: string;
    identifier: string;
}> => {
    const { tenant, credentials } = envelope.message;
    const client = createCrystallizeClient({
        tenantIdentifier: '',
        accessTokenId: credentials.ACCESS_TOKEN_ID,
        accessTokenSecret: credentials.ACCESS_TOKEN_SECRET,
    });
    const createResult = await client.pimApi(
        `mutation CREATE_TENANT ($identifier: String!, $name: String!) {
            tenant {
                create(input: {
                    identifier: $identifier,
                    isActive: true,
                    name: $name,
                    meta: {
                        key: "cli"
                        value: "yes"
                    }
                }) {
                    id
                    identifier
                }
            }
        }`,
        {
            name: tenant.identifier,
            identifier: tenant.identifier,
        },
    );
    const { id, identifier } = createResult.tenant.create;
    const shapeIdentifiers = ['default-product', 'default-folder', 'default-document'];
    const mutation = {
        shape: shapeIdentifiers.reduce((memo: Record<string, any>, shapeIdentifier: string) => {
            const camelCaseIdentifier = shapeIdentifier.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
            return {
                ...memo,
                [camelCaseIdentifier]: {
                    __aliasFor: 'delete',
                    __args: {
                        identifier: shapeIdentifier,
                        tenantId: id,
                    },
                },
            };
        }, {}),
    };
    const query = jsonToGraphQLQuery({ mutation });
    await client.pimApi(query);
    return {
        id,
        identifier,
    };
};

export const createCreateCleanTenantHandler = (deps: Deps) => (command: Envelope<Command>) => handler(command, deps);
