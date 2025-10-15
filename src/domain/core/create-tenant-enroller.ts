import { type Operations } from '@crystallize/schema/mass-operation';
import type { AsyncCreateClient, CredentialRetriever } from '../contracts/credential-retriever';
import type { Envelope } from 'missive.js';
import type { createRunMassOperationHandler, RunMassOperationCommand } from '../use-cases/run-mass-operation';
import type { Logger } from '../contracts/logger';
import type { FlySystem } from '../contracts/fly-system';
import type { createExecuteMutationsHandler, ExecuteMutationsCommand } from '../use-cases/execute-extra-mutations';
import { getMassOperationBulkTask, type MassOperationBulkTaskResponse } from '../../command/mass-operation/run';
import type {
    createDownloadBoilerplateArchiveHandler,
    DownloadBoilerplateQuery,
} from '../use-cases/download-boilerplate-archive';
import type { TenantEnrollerBuilder } from '../contracts/tenant-enroller';
import type { Boilerplate } from '../contracts/models/boilerplate';
import { MessageCode } from '../contracts/message-codes';
import type { createUploadBinariesHandler, UploadBinariesCommand } from '../use-cases/upload-binaries';

type Deps = {
    credentialsRetriever: CredentialRetriever;
    createCrystallizeClient: AsyncCreateClient;
    logger: Logger;
    runMassOperation: ReturnType<typeof createRunMassOperationHandler>;
    downloadBoilerplateArchive: ReturnType<typeof createDownloadBoilerplateArchiveHandler>;
    crystallizeEnvironment: 'staging' | 'production';
    flySystem: FlySystem;
    executeExtraMutations: ReturnType<typeof createExecuteMutationsHandler>;
    uploadBinaries: ReturnType<typeof createUploadBinariesHandler>;
};

export const createTenantEnrollerBuilder = ({
    credentialsRetriever,
    runMassOperation,
    createCrystallizeClient,
    downloadBoilerplateArchive,
    crystallizeEnvironment,
    executeExtraMutations,
    uploadBinaries,
    flySystem,
    logger,
}: Deps): TenantEnrollerBuilder => {
    const sleep = (second: number) => new Promise((resolve) => setTimeout(resolve, second * 1000));
    return async ({ tenant, credentials, folder }, { addTraceError, addTraceLog }) => {
        const crytallizeHiddenFolder = `${folder}/.crystallize`;
        const finalCredentials = credentials || (await credentialsRetriever.getCredentials());

        const cClient = await createCrystallizeClient({
            tenantIdentifier: tenant.identifier,
            sessionId: finalCredentials.sessionId,
            accessTokenId: finalCredentials.ACCESS_TOKEN_ID,
            accessTokenSecret: finalCredentials.ACCESS_TOKEN_SECRET,
        });

        const downloadArchive = async (boilerplate: Boilerplate) => {
            await downloadBoilerplateArchive({
                message: {
                    boilerplate,
                    destination: folder,
                },
            } as Envelope<DownloadBoilerplateQuery>);
        };

        const runOperations = async () => {
            const massOperationFile = `${crytallizeHiddenFolder}/content-model.json`;
            const operations = await flySystem.loadJsonFile<Operations>(massOperationFile);
            try {
                let { task: startedTask } = await runMassOperation({
                    message: {
                        tenantIdentifier: tenant.identifier,
                        operations,
                        credentials: finalCredentials,
                    },
                } as Envelope<RunMassOperationCommand>);
                logger.debug('Mass operation task created', startedTask);
                addTraceLog(`Mass operation task created: ${startedTask?.id}`, MessageCode.MASS_OPERATION_CREATED);
                await sleep(10); // we have an easy 10 sec sleep here to let the task start
                while (startedTask?.status !== 'complete') {
                    const res: MassOperationBulkTaskResponse = await cClient.nextPimApi<MassOperationBulkTaskResponse>(
                        getMassOperationBulkTask,
                        { id: startedTask?.id },
                    );
                    const { bulkTask } = res;
                    if ('error' in bulkTask) {
                        throw new Error(bulkTask.error);
                    }
                    startedTask = bulkTask;
                    await sleep(3); // then we check every 3 seconds
                }
            } catch (e) {
                addTraceError(`Failed to run mass operation.`, MessageCode.MASS_OPERATION_FAILED);
                logger.error('Failed to run mass operation', e);
            }
            addTraceLog(`Mass operation completed.`, MessageCode.MASS_OPERATION_COMPLETED);
        };

        const uploadAssets = async () => {
            let imageMapping: Record<string, string> = {};
            const images: string[] = [];

            for await (const image of flySystem.loopInDirectory(`${crytallizeHiddenFolder}/images`)) {
                images.push(image);
            }
            try {
                addTraceLog(`Uploading ${images.length} images.`, MessageCode.ASSET_UPLOAD_STARTED);
                const imagResults = await uploadBinaries({
                    message: {
                        paths: images,
                        tenant,
                        type: 'MEDIA',
                        credentials: finalCredentials,
                    },
                } as Envelope<UploadBinariesCommand>);

                imageMapping = imagResults.keys;
                addTraceLog(`${Object.keys(imageMapping).length} images Uploaded.`, MessageCode.ASSET_UPLOAD_COMPLETED);
            } catch (e) {
                addTraceError(`Failed to upload images..`, MessageCode.ASSET_UPLOAD_FAILED);
                logger.error('Failed to upload images');
            }

            let fileMapping: Record<string, string> = {};
            const files: string[] = [];
            for await (const file of flySystem.loopInDirectory(`${crytallizeHiddenFolder}/files`)) {
                files.push(file);
            }
            try {
                addTraceLog(`Uploading ${files.length} files.`, MessageCode.ASSET_UPLOAD_STARTED);
                const fileResults = await uploadBinaries({
                    message: {
                        paths: files,
                        tenant,
                        type: 'STATIC',
                        credentials: finalCredentials,
                    },
                } as Envelope<UploadBinariesCommand>);

                fileMapping = fileResults.keys;
                addTraceLog(`${Object.keys(fileMapping).length} files Uploaded.`, MessageCode.ASSET_UPLOAD_COMPLETED);
            } catch (e) {
                addTraceError(`Failed to upload files..`, MessageCode.ASSET_UPLOAD_FAILED);
                logger.error('Failed to upload files');
            }

            return {
                images: imageMapping,
                files: fileMapping,
            };
        };

        const executeMutations = async (mapping: { images: Record<string, string>; files: Record<string, string> }) => {
            try {
                await executeExtraMutations({
                    message: {
                        filePath: `${crytallizeHiddenFolder}/extra-mutations.json`,
                        tenant,
                        credentials: finalCredentials,
                        placeholderMap: mapping,
                    },
                } as unknown as Envelope<ExecuteMutationsCommand>);
            } catch (e) {
                addTraceError(`Failed to run extra mutations.`, MessageCode.MUTATIONS_FAILED);
                logger.error('Failed to run extra mutations', e);
            }

            addTraceLog(`Extra Mutations executed.`, MessageCode.MUTATIONS_EXECUTED);
        };
        const ignite = async () => {
            addTraceLog(`Starting the index for Discovery API.`, MessageCode.DISCOVERY_API_START);
            await cClient.nextPimApi(`mutation { igniteTenant }`);
            // check the 404

            const discoHost =
                crystallizeEnvironment === 'staging' ? 'api-dev.crystallize.digital' : 'api.crystallize.com';
            let discoApiPingResponseCode = 404;

            await sleep(15); // easy 15 sec sleep to let the index finish
            do {
                const discoApiPingResponse = await fetch(`https://${discoHost}/${tenant.identifier}/discovery`);
                discoApiPingResponseCode = discoApiPingResponse.status;
                sleep(5); // then every 5 seconds
            } while (discoApiPingResponseCode === 404);
            addTraceLog(`Tenant ignited in Discovery API.`, MessageCode.DISCOVERY_API_IGNITED);
        };

        return {
            downloadArchive,
            runOperations,
            uploadAssets,
            executeMutations,
            ignite,
        };
    };
};
