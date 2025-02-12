import { Argument, Command, Option } from 'commander';
import type { Logger } from '../../domain/contracts/logger';
import type { CommandBus } from '../../domain/contracts/bus';
import type { Operation, Operations } from '@crystallize/schema/mass-operation';
import type { AsyncCreateClient, CredentialRetriever } from '../../domain/contracts/credential-retriever';
import pc from 'picocolors';
import { ZodError } from 'zod';
import type { GetAuthenticatedUser } from '../../domain/contracts/get-authenticated-user';
import { addInteractiveAndTokenOption } from '../../core/helpers/add-iteractive-and-token-option';

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

            let startedTask = result?.task;
            if (!startedTask) {
                throw new Error('Task not started. Please check the logs for more information.');
            }

            const crystallizeClient = await createCrystallizeClient({
                tenantIdentifier,
                accessTokenId: credentials.ACCESS_TOKEN_ID,
                accessTokenSecret: credentials.ACCESS_TOKEN_SECRET,
            });

            logger.info(`Now, Waiting for task ${pc.yellow(startedTask.id)} to complete...`);
            while (startedTask?.status !== 'complete') {
                logger.info(`Task status: ${pc.yellow(startedTask?.status)}`);
                await new Promise((resolve) => setTimeout(resolve, 1000));
                const get = await crystallizeClient.nextPimApi(getMassOperationBulkTask, { id: startedTask?.id });
                if (get.bulkTask.error) {
                    throw new Error(get.data.bulkTask.error);
                }
                startedTask = get.bulkTask;
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
