import type { ClientInterface } from '@crystallize/js-api-client';
import type { S3Uploader } from '../contracts/s3-uploader';
import type { Logger } from '../contracts/logger';
import pc from 'picocolors';

type Deps = {
    crystallizeClient: ClientInterface;
    s3Uploader: S3Uploader;
    logger: Logger;
};

export const uploadMassOperationFileContent = async (
    content: string,
    { crystallizeClient, s3Uploader, logger }: Deps,
) => {
    const uniquId = Math.random().toString(36).substring(7);
    const file = `mass-operation-${uniquId}.json`;
    const register = await crystallizeClient.nextPimApi(generatePresignedUploadRequest, { file });

    if (register.generatePresignedUploadRequest.error) {
        throw new Error(register.generatePresignedUploadRequest.error);
    }
    const uploadRequest = register.generatePresignedUploadRequest;
    logger.debug(`Upload request generated successfully.`);

    const key = await s3Uploader(uploadRequest, content);
    logger.debug(`File uploaded successfully to ${pc.yellow(key)}`);
    return key;
};

const generatePresignedUploadRequest = `#graphql
    mutation GET_URL($file: String!) {
    generatePresignedUploadRequest(
        filename: $file
        contentType: "application/json"
        type: MASS_OPERATIONS
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
