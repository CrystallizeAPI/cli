import { Argument, Command, Option } from 'commander';
import { addInteractiveAndTokenOption } from '../../core/helpers/add-iteractive-and-token-option';
import type { GetAuthenticatedUser } from '../../domain/contracts/get-authenticated-user';
import type { Logger } from '../../domain/contracts/logger';
import type { FlySystem } from '../../domain/contracts/fly-system';
import { ZodError } from 'zod';
import type { QueryBus } from '../../domain/contracts/bus';
import { OperationsSchema } from '@crystallize/schema/mass-operation';

type Deps = {
    logger: Logger;
    flySystem: FlySystem;
    queryBus: QueryBus;
    getAuthenticatedUserWithInteractivityIfPossible: GetAuthenticatedUser;
};

export const createDumpContentModelMassOperationCommand = ({
    logger,
    flySystem,
    queryBus,
    getAuthenticatedUserWithInteractivityIfPossible: getAuthenticatedUser,
}: Deps): Command => {
    const command = new Command('dump-content-model');
    command.description('Create a valid Mass Operation file on your machine.');
    command.addArgument(new Argument('<tenant-identifier>', 'The tenant identifier to use.'));
    command.addArgument(new Argument('<file>', 'The file that will contains the Operations.'));
    command.addOption(new Option('-f, --force', 'Force and override the file it it exits.'));
    addInteractiveAndTokenOption(command);

    command.action(async (tenantIdentifier: string, inputFile: string, flags) => {
        if ((await flySystem.isFileExists(inputFile)) && !flags.force) {
            throw new Error(`File ${inputFile} already exist.`);
        }
        try {
            const { credentials } = await getAuthenticatedUser({
                isInteractive: !flags.noInteractive,
                token_id: flags.token_id,
                token_secret: flags.token_secret,
            });

            const intent = queryBus.createQuery('CreateContentModelMassOperationFile', {
                tenantIdentifier,
                credentials,
            });
            const { result } = await queryBus.dispatch(intent);
            if (!result) {
                throw new Error('Failed to create the Mass Operation file.');
            }
            // console.dir(result.content, { depth: null });
            const operations = OperationsSchema.parse(result.content);
            await flySystem.saveFile(inputFile, JSON.stringify(operations, null, 2) + `\r\n`);
            logger.success(`Mass Operation file created at ${inputFile}.`);
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
