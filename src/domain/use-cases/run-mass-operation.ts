import type { CommandHandlerDefinition, Envelope } from 'missive.js';
import { OperationsSchema, type Operations } from '@crystallize/schema/mass-operation';
import type { Logger } from '../contracts/logger';
import pc from 'picocolors';
import type { PimCredentials } from '../contracts/models/credentials';
import type { AsyncCreateClient } from '../contracts/credential-retriever';
import { uploadMassOperationFileContent } from '../core/upload-mass-operation-file-content';

type Deps = {
    logger: Logger;
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
    { logger, createCrystallizeClient }: Deps,
): Promise<{
    task: {
        id: string;
        status: string;
    };
}> => {
    const { tenantIdentifier, operations: operationsContent } = envelope.message;

    const crystallizeClient = await createCrystallizeClient({
        tenantIdentifier,
        sessionId: envelope.message.credentials.sessionId,
        accessTokenId: envelope.message.credentials.ACCESS_TOKEN_ID,
        accessTokenSecret: envelope.message.credentials.ACCESS_TOKEN_SECRET,
    });
    const operations = OperationsSchema.parse(operationsContent);
    logger.debug(
        `Operations file parsed successfully. ${pc.bold(pc.yellow(operations.operations.length))} operation(s) found.`,
    );

    const key = await uploadMassOperationFileContent(JSON.stringify(operationsContent), {
        crystallizeClient,
        logger,
    });

    const create = await crystallizeClient.nextPimApi<{
        createMassOperationBulkTask: { error?: string; id: never } | { id: string; error?: never };
    }>(createMassOperationBulkTask, { key });
    if (create.createMassOperationBulkTask.error) {
        throw new Error(create.createMassOperationBulkTask.error);
    }
    const task = create.createMassOperationBulkTask;
    logger.debug(`Task created successfully. Task ID: ${pc.yellow(task.id)}`);
    const start = await crystallizeClient.nextPimApi<{
        startMassOperationBulkTask:
            | { error: string; id: never; status: never }
            | { error?: never; id: string; status: string };
    }>(startMassOperationBulkTask, { id: task.id });
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
        }
        ... on BasicError {
          error: message
        }
      }
    }
`;
