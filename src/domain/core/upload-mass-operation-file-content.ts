import { createBinaryFileManager, type ClientInterface } from '@crystallize/js-api-client';
import type { Logger } from '../contracts/logger';
import pc from 'picocolors';
import { tmpdir } from 'os';

type Deps = {
    crystallizeClient: ClientInterface;
    logger: Logger;
};

export const uploadMassOperationFileContent = async (content: string, { crystallizeClient, logger }: Deps) => {
    const uniquId = Math.random().toString(36).substring(7);
    const file = `/${tmpdir()}/mass-operation-${uniquId}.json`;
    await Bun.write(file, content);
    const manager = createBinaryFileManager(crystallizeClient);
    const key = await manager.uploadMassOperationFile(file);
    logger.debug(`File uploaded successfully to ${pc.yellow(key)}`);
    return key;
};
