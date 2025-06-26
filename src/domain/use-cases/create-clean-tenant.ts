import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import type { Tenant } from '../contracts/models/tenant';
import type { CommandHandlerDefinition, Envelope } from 'missive.js';
import type { PimCredentials } from '../contracts/models/credentials';
import type { AsyncCreateClient, CredentialRetriever } from '../contracts/credential-retriever';
import type { FlySystem } from '../contracts/fly-system';
import type { Logger } from '../contracts/logger';
import type { InstallBoilerplateStore } from '../../ui/journeys/install-boilerplate/create-store';
import type { TenantEnrollerBuilder } from '../contracts/tenant-enroller';

type Deps = {
    createCrystallizeClient: AsyncCreateClient;
    credentialsRetriever: CredentialRetriever;
    crystallizeEnvironment: 'staging' | 'production';
    installBoilerplateCommandStore: InstallBoilerplateStore;
    flySystem: FlySystem;
    logger: Logger;
    tenantEnrollerBuilder: TenantEnrollerBuilder;
};
type Command = {
    tenant: Tenant;
    credentials: PimCredentials;
    folder?: string;
};

export type CreateCleanTenantHandlerDefinition = CommandHandlerDefinition<
    'CreateCleanTenant',
    Command,
    Awaited<ReturnType<typeof handler>>
>;

const handler = async (
    envelope: Envelope<Command>,
    { createCrystallizeClient, credentialsRetriever, tenantEnrollerBuilder, installBoilerplateCommandStore }: Deps,
): Promise<{
    id: string;
    identifier: string;
}> => {
    const { storage, atoms } = installBoilerplateCommandStore;
    const addTraceLog = (log: string) => storage.set(atoms.addTraceLogAtom, log);
    const addTraceError = (log: string) => storage.set(atoms.addTraceErrorAtom, log);

    const { tenant, credentials } = envelope.message;
    const finalCredentials = credentials || (await credentialsRetriever.getCredentials());
    const client = await createCrystallizeClient({
        tenantIdentifier: '',
        accessTokenId: finalCredentials.ACCESS_TOKEN_ID,
        accessTokenSecret: finalCredentials.ACCESS_TOKEN_SECRET,
    });
    const createResult = await client.pimApi(
        `#graphql 
        mutation CREATE_TENANT ($identifier: String!, $name: String!) {
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
    addTraceLog(`Tenant created with id: ${id}.`);
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
    addTraceLog(`Shape cleaned.`);

    // if we have a folder, we check that folder for .crystallize folder and convention
    const { folder } = envelope.message;
    if (!folder) {
        return {
            id,
            identifier,
        };
    }

    const enroller = await tenantEnrollerBuilder(
        {
            tenant: {
                identifier,
                id,
            },
            credentials: finalCredentials,
            folder,
        },
        {
            addTraceLog,
            addTraceError,
        },
    );

    await enroller.runOperations();
    const mapping = await enroller.uploadAssets();
    await enroller.executeMutations(mapping);
    await enroller.ignite();
    return {
        id,
        identifier,
    };
};

export const createCreateCleanTenantHandler = (deps: Deps) => (command: Envelope<Command>) => handler(command, deps);
