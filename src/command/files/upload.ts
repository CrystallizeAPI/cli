import { Command, Argument, Option } from 'commander';
import { addInteractiveAndTokenOption } from '../../core/helpers/add-iteractive-and-token-option';
import type { Logger } from '../../domain/contracts/logger';
import type { CommandBus } from '../../domain/contracts/bus';
import type { GetAuthenticatedUser } from '../../domain/contracts/get-authenticated-user';
import type { FlySystem } from '../../domain/contracts/fly-system';
import type { AsyncCreateClient } from '../../domain/contracts/credential-retriever';
import pc from 'picocolors';

type Deps = {
    logger: Logger;
    commandBus: CommandBus;
    flySystem: FlySystem;
    getAuthenticatedUserWithInteractivityIfPossible: GetAuthenticatedUser;
    createCrystallizeClient: AsyncCreateClient;
};
export const createFileUploadCommand = ({
    getAuthenticatedUserWithInteractivityIfPossible,
    commandBus,
    logger,
    flySystem,
}: Deps): Command => {
    const command = new Command('upload');
    command.description('Upload file(s) to a Tenant.');
    command.addArgument(new Argument('<tenant-identifier>', 'The tenant identifier to upload on.'));
    command.addArgument(new Argument('<file>', 'The file or the folder that contains the Files.'));
    command.addArgument(new Argument('[output-file]', 'An optional file that will contain the mapping path:key.'));
    command.addOption(new Option('-f, --force', 'Force and override the output-file if it exits.'));

    addInteractiveAndTokenOption(command);
    command.action(async (tenantIdentifier: string, file: string, outputFile: string, flags) => {
        if (outputFile && (await flySystem.isFileExists(outputFile)) && !flags.force) {
            throw new Error(`File ${outputFile} already exist.`);
        }

        const { credentials } = await getAuthenticatedUserWithInteractivityIfPossible({
            isInteractive: !flags.noInteractive,
            token_id: flags.token_id,
            token_secret: flags.token_secret,
        });

        const images: string[] = [];
        if (await flySystem.isFileExists(file)) {
            images.push(file);
        }

        for await (const image of flySystem.loopInDirectory(file)) {
            images.push(image);
        }

        const intent = commandBus.createCommand('UploadBinaries', {
            paths: images,
            credentials,
            type: 'STATIC',
            tenant: {
                identifier: tenantIdentifier,
            },
        });
        const { result } = await commandBus.dispatch(intent);

        if (!result) {
            logger.error(`Failed to upload files.`);
            return;
        }
        logger.success(`Files uploaded.`);
        if (!outputFile) {
            for (const [path, key] of Object.entries(result.keys)) {
                logger.complete(`\t - ${path} -> ${pc.yellowBright(key)}`);
            }
            return;
        }

        await flySystem.saveFile(outputFile, JSON.stringify(result.keys, null, 2) + `\r\n`);
        logger.complete(`Mapping saved at ${outputFile}`);
        return;
    });

    return command;
};
