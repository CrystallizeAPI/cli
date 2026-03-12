import { Argument, Command, Option } from 'commander';
import type { Logger } from '../../domain/contracts/logger';
import type { CommandBus } from '../../domain/contracts/bus';
import type { Operation, Operations } from '@crystallize/schema/mass-operation';
import type { AsyncCreateClient, CredentialRetriever } from '../../domain/contracts/credential-retriever';
import pc from 'picocolors';
import { ZodError } from 'zod';
import type { GetAuthenticatedUser } from '../../domain/contracts/get-authenticated-user';
import { addInteractiveAndTokenOption } from '../../core/helpers/add-iteractive-and-token-option';

type MassOperationBulkTaskError = { error: string };
type MassOperationBulkTaskSuccess = { id: string; status: string };
export type MassOperationBulkTaskResponse = {
    bulkTask: MassOperationBulkTaskError | MassOperationBulkTaskSuccess;
};

type OperationLogNode = { id: string; input: string; output: string; message: string; status: string; statusCode: number };
type OperationLogsResponse = {
    operationLogs: {
        pageInfo: { endCursor: string; hasNextPage: boolean };
        edges: { node: OperationLogNode }[];
    };
};

type Deps = {
    logger: Logger;
    commandBus: CommandBus;
    credentialsRetriever: CredentialRetriever;
    createCrystallizeClient: AsyncCreateClient;
    getAuthenticatedUserWithInteractivityIfPossible: GetAuthenticatedUser;
};

export const createRunMassOperationCommand = ({
    logger,
    commandBus,
    createCrystallizeClient,
    getAuthenticatedUserWithInteractivityIfPossible: getAuthenticatedUser,
}: Deps): Command => {
    const command = new Command('run');
    command.description('Upload and start an Mass Operation Task in your tenant.');
    command.addArgument(new Argument('<tenant-identifier>', 'The tenant identifier to use.'));
    command.addArgument(new Argument('<file>', 'The file that contains the Operations.'));
    command.addOption(new Option('--legacy-spec', 'Use legacy spec format.'));
    addInteractiveAndTokenOption(command);

    command.action(async (tenantIdentifier: string, file: string, flags) => {
        let operationsContent: Operations;
        if (flags.legacySpec) {
            logger.warn(`Using legacy spec... Converting to operations file...`);
            const spec = await Bun.file(file).json();
            operationsContent = {
                version: '0.0.1',
                operations: (spec.shapes || []).map((shape: any): Operation => {
                    return {
                        intent: 'shape/upsert',
                        identifier: shape.identifier,
                        type: shape.type,
                        name: shape.name,
                        components: shape.components.map((component: any) => {
                            return {
                                id: component.id,
                                name: component.name,
                                description: '',
                                type: component.type,
                                config: component.config || {},
                            };
                        }),
                    };
                }),
            };
        } else {
            operationsContent = await Bun.file(file).json();
            logger.note(`Operations file found.`);
        }

        try {
            const { credentials } = await getAuthenticatedUser({
                isInteractive: !flags.noInteractive,
                token_id: flags.token_id,
                token_secret: flags.token_secret,
            });
            const intent = commandBus.createCommand('RunMassOperation', {
                tenantIdentifier,
                operations: operationsContent,
                credentials,
            });
            const { result } = await commandBus.dispatch(intent);

            let startedTask: MassOperationBulkTaskSuccess | undefined = result?.task;
            if (!startedTask) {
                throw new Error('Task not started. Please check the logs for more information.');
            }

            const crystallizeClient = await createCrystallizeClient({
                tenantIdentifier,
                sessionId: credentials.sessionId,
                accessTokenId: credentials.ACCESS_TOKEN_ID,
                accessTokenSecret: credentials.ACCESS_TOKEN_SECRET,
            });

            const fetchAndDisplayLogs = async (
                taskId: string,
                cursor: string | null,
            ): Promise<{ cursor: string | null; hasNextPage: boolean }> => {
                const res = await crystallizeClient.nextPimApi<OperationLogsResponse>(getOperationLogs, {
                    operationId: taskId,
                    after: cursor || '',
                    first: 100,
                });
                const { operationLogs } = res;
                if (!operationLogs?.edges) {
                    return { cursor, hasNextPage: false };
                }
                for (const { node } of operationLogs.edges) {
                    const colorFn =
                        node.statusCode >= 200 && node.statusCode < 300
                            ? pc.green
                            : node.statusCode >= 400
                                ? pc.red
                                : pc.yellow;
                    logger.info(`${colorFn(`[${node.statusCode}]`)} ${node.status} - Operation ${node.id}: ${node.message}`);
                    if (node.input) {
                        logger.debug(`  Input: ${JSON.stringify(node.input)}`);
                    }
                    if (node.output) {
                        logger.debug(`  Output: ${JSON.stringify(node.output)}`);
                    }
                }
                return {
                    cursor: operationLogs.pageInfo.endCursor || cursor,
                    hasNextPage: operationLogs.pageInfo.hasNextPage,
                };
            };

            logger.info(`Now, Waiting for task ${pc.yellow(startedTask.id)} to complete...`);
            let logCursor: string | null = null;

            while (startedTask.status !== 'complete') {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                const results: [MassOperationBulkTaskResponse, { cursor: string | null; hasNextPage: boolean }] =
                    await Promise.all([
                        crystallizeClient.nextPimApi<MassOperationBulkTaskResponse>(getMassOperationBulkTask, {
                            id: startedTask.id,
                        }),
                        fetchAndDisplayLogs(startedTask.id, logCursor),
                    ]);
                const [taskRes, logResult] = results;
                logCursor = logResult.cursor;
                // Drain all available log pages before continuing
                while (logResult.hasNextPage) {
                    const next = await fetchAndDisplayLogs(startedTask.id, logCursor);
                    logCursor = next.cursor;
                    logResult.hasNextPage = next.hasNextPage;
                }
                const { bulkTask } = taskRes;
                if ('error' in bulkTask) {
                    throw new Error(bulkTask.error);
                }
                startedTask = bulkTask;
            }

            // Drain remaining logs
            let hasMoreLogs = true;
            while (hasMoreLogs) {
                const logResult = await fetchAndDisplayLogs(startedTask.id, logCursor);
                logCursor = logResult.cursor;
                hasMoreLogs = logResult.hasNextPage;
            }

            logger.success(`Task completed successfully. Task ID: ${pc.yellow(startedTask.id)}`);
        } catch (error) {
            if (error instanceof ZodError) {
                for (const issue of error.issues) {
                    logger.error(`[${issue.path.join('.')}]: ${issue.message}`);
                }
            }
            throw error;
        }
    });
    return command;
};

export const getMassOperationBulkTask = `#graphql
query GET($id:ID!) {
  bulkTask(id:$id) {
    ... on BulkTaskMassOperation {
      id
      type
      status
      key
    }
    ... on BasicError {
      error: message
    }
  }
}`;

const getOperationLogs = `#graphql
query GET_OPERATION_LOGS($operationId: ID!, $after: String, $first: Int) {
  operationLogs(after: $after, first: $first, filter: { operationId: $operationId }) {
    ... on OperationLogConnection {
      pageInfo { endCursor hasNextPage }
      edges { node { id input output message status statusCode } }
    }
  }
}`;
