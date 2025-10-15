import type { CommandHandlerDefinition, Envelope } from 'missive.js';
import type { PimCredentials } from '../contracts/models/credentials';
import type { AsyncCreateClient } from '../contracts/credential-retriever';
import type { Logger } from '../contracts/logger';
import pc from 'picocolors';
import type { Tenant } from '../contracts/models/tenant';
import { createBinaryFileManager } from '@crystallize/js-api-client';

type Deps = {
    createCrystallizeClient: AsyncCreateClient;
    logger: Logger;
};

export type UploadBinariesCommand = {
    paths: string[];
    credentials: PimCredentials;
    tenant: Tenant;
    type: 'MEDIA' | 'STATIC';
};

export type UploadBinariesHandlerDefinition = CommandHandlerDefinition<
    'UploadBinaries',
    UploadBinariesCommand,
    Awaited<ReturnType<typeof handler>>
>;

const handler = async (envelope: Envelope<UploadBinariesCommand>, deps: Deps) => {
    const { paths, tenant, credentials, type } = envelope.message;
    const { createCrystallizeClient, logger } = deps;

    const apiClient = await createCrystallizeClient({
        tenantIdentifier: tenant.identifier,
        sessionId: credentials.sessionId,
        accessTokenId: credentials.ACCESS_TOKEN_ID,
        accessTokenSecret: credentials.ACCESS_TOKEN_SECRET,
    });
    const results: Record<string, string> = {};
    const manager = createBinaryFileManager(apiClient);

    const getKey = async (path: string, type: UploadBinariesCommand['type']) =>
        type === 'MEDIA' ? await manager.uploadImage(path) : await manager.uploadFile(path);
    for (const file of paths) {
        const cleanPath = file.split('/').slice(-2).join('/');
        logger.debug(`Uploading file: ${pc.yellow(file)}`);
        const key = await getKey(file, type);
        logger.debug(`File uploaded and registered successfully to ${pc.yellow(key)}`);
        results[cleanPath.replaceAll('/', '-').replaceAll('.', '-')] = key;
    }

    return {
        keys: results,
    };
};

export const createUploadBinariesHandler = (deps: Deps) => (command: Envelope<UploadBinariesCommand>) =>
    handler(command, deps);
