import type { CommandHandlerDefinition, Envelope } from 'missive.js';
import type { PimCredentials } from '../contracts/models/credentials';
import type { AsyncCreateClient } from '../contracts/credential-retriever';
import type { Logger } from '../contracts/logger';
import type { S3Uploader } from '../contracts/s3-uploader';
import type { FlySystem } from '../contracts/fly-system';
import pc from 'picocolors';

type Deps = {
    createCrystallizeClient: AsyncCreateClient;
    logger: Logger;
    s3Uploader: S3Uploader;
    flySystem: FlySystem;
};

export type UploadImagesCommand = {
    paths: string[];
    credentials: PimCredentials;
    tenant: {
        id?: string;
        identifier: string;
    };
};

export type UploadImagesHandlerDefinition = CommandHandlerDefinition<
    'UploadImages',
    UploadImagesCommand,
    Awaited<ReturnType<typeof handler>>
>;

const handler = async (envelope: Envelope<UploadImagesCommand>, deps: Deps) => {
    const { paths, tenant, credentials } = envelope.message;
    const { createCrystallizeClient, logger, s3Uploader, flySystem } = deps;

    const apiClient = await createCrystallizeClient({
        tenantIdentifier: tenant.identifier,
        tenantId: tenant.id,
        accessTokenId: credentials.ACCESS_TOKEN_ID,
        accessTokenSecret: credentials.ACCESS_TOKEN_SECRET,
    });

    const results: Record<string, string> = {};

    for (const file of paths) {
        const binaryFile = await flySystem.loadBinaryFile(file);
        const cleanPath = file.split('/').slice(-2).join('/');
        const register = await apiClient.nextPimApi(generatePresignedUploadRequest, {
            file: cleanPath,
            type: binaryFile.type,
        });
        if (register.generatePresignedUploadRequest.error) {
            throw new Error(register.generatePresignedUploadRequest.error);
        }
        const uploadRequest = register.generatePresignedUploadRequest;
        logger.debug(`Upload request generated successfully.`);
        const key = await s3Uploader(uploadRequest, binaryFile.content);
        logger.debug(`File uploaded successfully to ${pc.yellow(key)}`);
        await apiClient.pimApi(registerImage, { key, tenantId: apiClient.config.tenantId });
        logger.debug(`File registered successfully.`);
        results[cleanPath.replaceAll('/', '-').replaceAll('.', '-')] = key;
    }

    return {
        keys: results,
    };
};

export const createUploadImagesHandler = (deps: Deps) => (command: Envelope<UploadImagesCommand>) =>
    handler(command, deps);

const generatePresignedUploadRequest = `#graphql
    mutation GET_URL($file: String!, $type: String!) {
    generatePresignedUploadRequest(
        filename: $file
        contentType: $type
        type: MEDIA
    ) {
        ... on PresignedUploadRequest {
          url
          fields {
            name
            value
          }
          maxSize
          lifetime
        }
        ... on BasicError {
          error: message
        }
    }
}`;

const registerImage = `#graphql
mutation REGISTER_IMAGE($key: String!, $tenantId: ID!) {
  image {
    registerImage(key: $key, tenantId: $tenantId) {
      key
    }
  }
}`;
