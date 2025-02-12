import type { CommandHandlerDefinition, Envelope } from 'missive.js';
import { OperationsSchema, type Operations } from '@crystallize/schema/mass-operation';
import type { Logger } from '../contracts/logger';
import pc from 'picocolors';
import type { PimCredentials } from '../contracts/models/credentials';
import type { S3Uploader } from '../contracts/s3-uploader';
import type { AsyncCreateClient } from '../contracts/credential-retriever';

type Deps = {
    logger: Logger;
    s3Uploader: S3Uploader;
    createCrystallizeClient: AsyncCreateClient;
};

export type RunMassOperationCommand = {
    tenantIdentifier: string;
    operations: Operations;
    credentials: PimCredentials;
};
export type RunMassOperationCommandResult = Awaited<ReturnType<typeof handler>>;

export type RunMassOperationHandlerDefinition = CommandHandlerDefinition<
    'RunMassOperation',
    RunMassOperationCommand,
    RunMassOperationCommandResult
>;

const handler = async (
    envelope: Envelope<RunMassOperationCommand>,
    { logger, s3Uploader, createCrystallizeClient }: Deps,
): Promise<{
    task: {
        id: string;
        status: string;
    };
}> => {
    const { tenantIdentifier, operations: operationsContent } = envelope.message;

    const crystallizeClient = await createCrystallizeClient({
        tenantIdentifier,
        accessTokenId: envelope.message.credentials.ACCESS_TOKEN_ID,
        accessTokenSecret: envelope.message.credentials.ACCESS_TOKEN_SECRET,
    });
    const operations = OperationsSchema.parse(operationsContent);
    logger.debug(
        `Operations file parsed successfully. ${pc.bold(pc.yellow(operations.operations.length))} operation(s) found.`,
    );

    const uniquId = Math.random().toString(36).substring(7);
    const file = `mass-operation-${uniquId}.json`;
    const register = await crystallizeClient.nextPimApi(generatePresignedUploadRequest, { file });

    if (register.generatePresignedUploadRequest.error) {
        throw new Error(register.generatePresignedUploadRequest.error);
    }
    const uploadRequest = register.generatePresignedUploadRequest;
    logger.debug(`Upload request generated successfully.`);

    const key = await s3Uploader(uploadRequest, JSON.stringify(operationsContent));
    logger.debug(`File uploaded successfully to ${pc.yellow(key)}`);

    const create = await crystallizeClient.nextPimApi(createMassOperationBulkTask, { key });
    if (create.createMassOperationBulkTask.error) {
        throw new Error(create.createMassOperationBulkTask.error);
    }
    const task = create.createMassOperationBulkTask;
    logger.debug(`Task created successfully. Task ID: ${pc.yellow(task.id)}`);

    const start = await crystallizeClient.nextPimApi(startMassOperationBulkTask, { id: task.id });
    if (start.startMassOperationBulkTask.error) {
        throw new Error(start.startMassOperationBulkTask.error);
    }
    const startedTask = start.startMassOperationBulkTask;

    return {
        task: startedTask,
    };
};

export const createRunMassOperationHandler = (deps: Deps) => (command: Envelope<RunMassOperationCommand>) =>
    handler(command, deps);

const startMassOperationBulkTask = `#graphql
mutation START($id: ID!) {
  startMassOperationBulkTask(id: $id) {
    ... on BulkTaskMassOperation {
      id
      type
      status
    }
    ... on BasicError {
      error: message
    }
  }
}`;

const createMassOperationBulkTask = `#graphql
    mutation REGISTER($key: String!) {
      createMassOperationBulkTask(input: {key: $key, autoStart: false}) {
        ... on BulkTaskMassOperation {
          id
          status
          type
        }
        ... on BasicError {
          error: message
        }
      }
    }
`;
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
