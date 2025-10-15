import { Argument, Command } from 'commander';
import { addInteractiveAndTokenOption } from '../../core/helpers/add-iteractive-and-token-option';
import type { GetAuthenticatedUser } from '../../domain/contracts/get-authenticated-user';
import type { Logger } from '../../domain/contracts/logger';
import type { FlySystem } from '../../domain/contracts/fly-system';
import { ZodError } from 'zod';
import type { CommandBus } from '../../domain/contracts/bus';

type Deps = {
    logger: Logger;
    flySystem: FlySystem;
    commandBus: CommandBus;
    getAuthenticatedUserWithInteractivityIfPossible: GetAuthenticatedUser;
};

export const createExecuteMutationsCommand = ({
    logger,
    flySystem,
    commandBus,
    getAuthenticatedUserWithInteractivityIfPossible: getAuthenticatedUser,
}: Deps): Command => {
    const command = new Command('execute-mutations');
    command.description('Execute mutations with different set (client-side).');
    command.addArgument(new Argument('<tenant-identifier>', 'The tenant identifier to use.'));
    command.addArgument(new Argument('<file>', 'The file that contains the Mutations.'));
    command.addArgument(new Argument('[image-mapping-file]', 'An optional file for images mapping. Use - to skip'));
    command.addArgument(new Argument('[file-mapping-file]', 'An optional file for files mapping.'));
    addInteractiveAndTokenOption(command);

    command.action(
        async (
            tenantIdentifier: string,
            inputFile: string,
            imageMappingFile: string,
            fileMappingFile: string,
            flags,
        ) => {
            if (!(await flySystem.isFileExists(inputFile))) {
                throw new Error(`File ${inputFile} was not found.`);
            }

            try {
                const { credentials } = await getAuthenticatedUser({
                    isInteractive: !flags.noInteractive,
                    token_id: flags.token_id,
                    token_secret: flags.token_secret,
                });

                let imageMapping: Record<string, string> = {};
                if (imageMappingFile && imageMappingFile !== '-') {
                    imageMapping = await flySystem.loadJsonFile<Record<string, string>>(imageMappingFile);
                }

                let fileMapping: Record<string, string> = {};
                if (fileMappingFile && fileMappingFile !== '-') {
                    fileMapping = await flySystem.loadJsonFile<Record<string, string>>(fileMappingFile);
                }

                const intent = commandBus.createCommand('ExecuteMutations', {
                    filePath: inputFile,
                    tenant: {
                        identifier: tenantIdentifier,
                    },
                    credentials,
                    placeholderMap: {
                        images: imageMapping,
                        files: fileMapping,
                    },
                });
                const { result } = await commandBus.dispatch(intent);
                if (!result) {
                    throw new Error('Failed to execute the Mutations file.');
                }
                // console.dir({ result }, { depth: null });
                logger.success(`Mutations executed.`);
            } catch (error) {
                if (error instanceof ZodError) {
                    for (const issue of error.issues) {
                        logger.error(`[${issue.path.join('.')}]: ${issue.message}`);
                    }
                }
                throw error;
            }
        },
    );
    return command;
};
