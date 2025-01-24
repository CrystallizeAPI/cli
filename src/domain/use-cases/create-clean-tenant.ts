import type { createClient } from '@crystallize/js-api-client';
import { jsonToGraphQLQuery, VariableType } from 'json-to-graphql-query';
import type { Tenant } from '../contracts/models/tenant';
import type { CommandHandlerDefinition, Envelope } from 'missive.js';
import type { PimCredentials } from '../contracts/models/credentials';
import type { CredentialRetriever } from '../contracts/credential-retriever';
import type { createRunMassOperationHandler, RunMassOperationCommand } from './run-mass-operation';
import type { FlySystem } from '../contracts/fly-system';
import type { Operations } from '@crystallize/schema/mass-operation';
import type { Logger } from '../contracts/logger';
import { getMassOperationBulkTask } from '../../command/mass-operation/run';

type Deps = {
    createCrystallizeClient: typeof createClient;
    runMassOperation: ReturnType<typeof createRunMassOperationHandler>;
    credentialsRetriever: CredentialRetriever;
    flySystem: FlySystem;
    logger: Logger;
};
type Command = {
    tenant: Tenant;
    credentials: PimCredentials;
    folder: string;
};

export type CreateCleanTenantHandlerDefinition = CommandHandlerDefinition<
    'CreateCleanTenant',
    Command,
    Awaited<ReturnType<typeof handler>>
>;

const handler = async (
    envelope: Envelope<Command>,
    { createCrystallizeClient, credentialsRetriever, runMassOperation, flySystem, logger }: Deps,
): Promise<{
    id: string;
    identifier: string;
}> => {
    const { folder, tenant, credentials } = envelope.message;
    const finalCredentials = credentials || (await credentialsRetriever.getCredentials());
    const client = createCrystallizeClient({
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

    const cClient = createCrystallizeClient({
        tenantIdentifier: tenant.identifier,
        tenantId: id,
        accessTokenId: finalCredentials.ACCESS_TOKEN_ID,
        accessTokenSecret: finalCredentials.ACCESS_TOKEN_SECRET,
    });

    // now lets run the mass operation
    const crytallizeHiddenFolder = `${folder}/.crystallize`;
    try {
        const massOperationFile = `${crytallizeHiddenFolder}/content-model.json`;
        const operations = await flySystem.loadJsonFile<Operations>(massOperationFile);
        let { task: startedTask } = await runMassOperation({
            message: {
                tenantIdentifier: tenant.identifier,
                operations,
                credentials: finalCredentials,
            },
        } as Envelope<RunMassOperationCommand>);
        logger.debug('Mass operation task created', startedTask);
        while (startedTask?.status !== 'complete') {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const get = await cClient.nextPimApi(getMassOperationBulkTask, { id: startedTask?.id });
            if (get.bulkTask.error) {
                throw new Error(get.data.bulkTask.error);
            }
            startedTask = get.bulkTask;
        }
    } catch (e) {
        logger.error('Failed to run mass operation', e);
    }

    try {
        const results = await cClient.pimApi(`#graphql
            query { 
                tenant {
                    get(id:"${id}") {
                        rootItemId
                        vatTypes {
                            id
                        }
                    }
                }
            }`);

        const { rootItemId, vatTypes } = results.tenant.get;
        const defaultVat = vatTypes[0].id;

        const extraMutationsFile = `${crytallizeHiddenFolder}/extra-mutations.json`;
        const extraMutationsContent = await flySystem.loadFile(extraMutationsFile);
        const extraMutations = JSON.parse(
            extraMutationsContent
                .replaceAll('##TENANT_ID##', id)
                .replaceAll('##TENANT_DEFAULT_VATTYPE_ID##', defaultVat)
                .replaceAll('##TENANT_ROOT_ID##', rootItemId),
        ) as {
            mutation: string;
            sets: Record<string, VariableType>[];
        }[];

        for (const { mutation, sets } of Object.values(extraMutations)) {
            await Promise.all([
                sets.map(async (set) => {
                    await cClient.pimApi(mutation, set);
                }),
            ]);
        }
    } catch (e) {
        logger.error('Failed to run extra mutations', e);
    }
    return {
        id,
        identifier,
    };
};

export const createCreateCleanTenantHandler = (deps: Deps) => (command: Envelope<Command>) => handler(command, deps);
