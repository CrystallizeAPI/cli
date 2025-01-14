import { Argument, Command } from 'commander';
import type { Logger } from '../domain/contracts/logger';
import type { CommandBus } from '../domain/contracts/bus';
import type { Operation, Operations } from '@crystallize/schema/mass-operation';
import type { CredentialRetriever } from '../domain/contracts/credential-retriever';
import pc from 'picocolors';
import { ZodError } from 'zod';
import type { createClient } from '@crystallize/js-api-client';

type Deps = {
    logger: Logger;
    commandBus: CommandBus;
    credentialsRetriever: CredentialRetriever;
    createCrystallizeClient: typeof createClient;
};

export const createRunMassOperationCommand = ({
    logger,
    commandBus,
    credentialsRetriever,
    createCrystallizeClient,
}: Deps): Command => {
    const command = new Command('run-mass-operation');
    command.description('Upload and start an Mass Operation Task in your tenant.');
    command.addArgument(new Argument('<tenant-identifier>', 'The tenant identifier to use.'));
    command.addArgument(new Argument('<file>', 'The file that contains the Operations.'));
    command.option('--token_id <token_id>', 'Your access token id.');
    command.option('--token_secret <token_secret>', 'Your access token secret.');
    command.option('--legacy-spec', 'Use legacy spec format.');

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
            const credentials = await credentialsRetriever.getCredentials({
                token_id: flags.token_id,
                token_secret: flags.token_secret,
            });
            const authenticatedUser = await credentialsRetriever.checkCredentials(credentials);
            if (!authenticatedUser) {
                throw new Error(
                    'Credentials are invalid. Please run `crystallize login` to setup your credentials or provide correct credentials.',
                );
            }
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

            const crystallizeClient = createCrystallizeClient({
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
                process.exit(1);
            }
            throw error;
        }
    });
    return command;
};

const getMassOperationBulkTask = `#graphql
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
