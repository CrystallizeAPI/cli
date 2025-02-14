import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import type { Tenant } from '../contracts/models/tenant';
import type { CommandHandlerDefinition, Envelope } from 'missive.js';
import type { PimCredentials } from '../contracts/models/credentials';
import type { AsyncCreateClient, CredentialRetriever } from '../contracts/credential-retriever';
import type { createRunMassOperationHandler, RunMassOperationCommand } from './run-mass-operation';
import type { FlySystem } from '../contracts/fly-system';
import type { Operations } from '@crystallize/schema/mass-operation';
import type { Logger } from '../contracts/logger';
import { getMassOperationBulkTask } from '../../command/mass-operation/run';
import type { InstallBoilerplateStore } from '../../ui/journeys/install-boilerplate/create-store';
import type { createExecuteMutationsHandler, ExecuteMutationsCommand } from './execute-extra-mutations';
import type { createUploadImagesHandler, UploadImagesCommand } from './upload-images';

type Deps = {
    createCrystallizeClient: AsyncCreateClient;
    runMassOperation: ReturnType<typeof createRunMassOperationHandler>;
    credentialsRetriever: CredentialRetriever;
    crystallizeEnvironment: 'staging' | 'production';
    installBoilerplateCommandStore: InstallBoilerplateStore;
    flySystem: FlySystem;
    logger: Logger;
    executeExtraMutations: ReturnType<typeof createExecuteMutationsHandler>;
    uploadImages: ReturnType<typeof createUploadImagesHandler>;
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

const sleep = (second: number) => new Promise((resolve) => setTimeout(resolve, second * 1000));

const handler = async (
    envelope: Envelope<Command>,
    {
        createCrystallizeClient,
        credentialsRetriever,
        runMassOperation,
        flySystem,
        logger,
        crystallizeEnvironment,
        installBoilerplateCommandStore,
        executeExtraMutations,
        uploadImages,
    }: Deps,
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

    const cClient = await createCrystallizeClient({
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
        addTraceLog(`Mass operation task created: ${startedTask?.id}`);
        await sleep(10); // we have an easy 10 sec sleep here to let the task start
        while (startedTask?.status !== 'complete') {
            const get = await cClient.nextPimApi(getMassOperationBulkTask, { id: startedTask?.id });
            if (get.bulkTask.error) {
                throw new Error(get.data.bulkTask.error);
            }
            startedTask = get.bulkTask;
            await sleep(3); // then we check every 3 seconds
        }
    } catch (e) {
        addTraceError(`Failed to run mass operation.`);
        logger.error('Failed to run mass operation', e);
    }
    addTraceLog(`Mass operation completed.`);

    // now we upload the images

    const images: string[] = [];
    for await (const image of flySystem.loopInDirectory(`${crytallizeHiddenFolder}/images`)) {
        images.push(image);
    }
    try {
        addTraceLog(`Uploading ${images.length} images.`);
        const { keys: imageMapping } = await uploadImages({
            message: {
                paths: images,
                tenant: {
                    identifier,
                    id,
                },
                credentials: finalCredentials,
            },
        } as Envelope<UploadImagesCommand>);

        addTraceLog(`${Object.keys(imageMapping).length} images Uploaded.`);
    } catch (e) {
        addTraceError(`Failed to upload images..`);
        logger.error('Failed to upload images');
    }

    // now the extra mutations
    try {
        await executeExtraMutations({
            message: {
                filePath: `${crytallizeHiddenFolder}/extra-mutations.json`,
                tenant: {
                    identifier,
                    id,
                },
                credentials: finalCredentials,
                placeholderMap: {
                    images: imageMapping,
                },
            },
        } as unknown as Envelope<ExecuteMutationsCommand>);
    } catch (e) {
        addTraceError(`Failed to run extra mutations.`);
        logger.error('Failed to run extra mutations', e);
    }

    addTraceLog(`Extra Mutations executed.`);
    addTraceLog(`Starting the index for Discovery API.`);

    // now the index
    await cClient.nextPimApi(`mutation { igniteTenant }`);
    // check the 404

    const discoHost = crystallizeEnvironment === 'staging' ? 'api-dev.crystallize.digital' : 'api.crystallize.com';
    let discoApiPingResponseCode = 404;

    await sleep(15); // easy 15 sec sleep to let the index finish
    do {
        const discoApiPingResponse = await fetch(`https://${discoHost}/${identifier}/discovery`);
        discoApiPingResponseCode = discoApiPingResponse.status;
        sleep(5); // then every 5 seconds
    } while (discoApiPingResponseCode === 404);

    addTraceLog(`Tenant ignited in Discovery API.`);
    return {
        id,
        identifier,
    };
};

export const createCreateCleanTenantHandler = (deps: Deps) => (command: Envelope<Command>) => handler(command, deps);
