import { Argument, Command, Option } from 'commander';
import { Box, Text, Newline, render } from 'ink';
import { Provider } from 'jotai';
import path from 'node:path';
import { logo } from '../..';
import { pluginSkeletons } from '../../content/plugin-skeletons';
import type { FlySystem } from '../../domain/contracts/fly-system';
import type { Logger } from '../../domain/contracts/logger';
import type { CommandBus, QueryBus } from '../../domain/contracts/bus';
import { ALLOWED_BITS, type AllowedBits } from '../../domain/use-cases/generate-plugin-keypair';
import { writeKeypairFiles } from '../../core/helpers/keypair-files';
import { CreatePluginJourney } from '../../ui/journeys/create-plugin/create-plugin.journey';
import type { CreatePluginStore } from '../../ui/journeys/create-plugin/create-store';

type Deps = {
    logger: Logger;
    flySystem: FlySystem;
    queryBus: QueryBus;
    commandBus: CommandBus;
    createPluginCommandStore: CreatePluginStore;
};

type Flags = {
    name?: string;
    identifier?: string;
    author?: string;
    vendorUrl?: string;
    bits: string;
    kid: string;
    install: boolean; // commander: --no-install => false
    interactive: boolean; // commander: --no-interactive => false
};

const EXIT_INVALID_FLAGS = 2;

const kebab = (value: string) =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const fail = (logger: Logger, code: number, message: string): never => {
    logger.error(message);
    logger.flush();
    process.exit(code);
};

export const createPluginCreateCommand = ({
    logger,
    flySystem,
    queryBus,
    commandBus,
    createPluginCommandStore,
}: Deps): Command => {
    const command = new Command('create');
    command.description('Scaffold a new Crystallize plugin from a skeleton.');
    command.addArgument(new Argument('<folder>', 'Target folder (must be empty or not exist).'));
    command.addArgument(new Argument('[skeleton-identifier]', 'Skeleton identifier to use.'));
    command.addOption(new Option('--name <name>', 'Plugin display name.'));
    command.addOption(new Option('--identifier <id>', 'Plugin identifier (kebab-case).'));
    command.addOption(new Option('--author <author>', 'Author name.'));
    command.addOption(new Option('--vendor-url <url>', 'Vendor URL.'));
    command.addOption(new Option('--bits <n>', 'RSA modulus length.').default('2048'));
    command.addOption(new Option('--kid <kid>', 'Key id.').default('public'));
    command.addOption(new Option('--no-install', 'Skip dependency installation.'));
    command.addOption(new Option('--no-interactive', 'Run headless (all inputs via flags).'));

    command.action(async (folder: string, skeletonIdentifier: string | undefined, flags: Flags, cmd: Command) => {
        await flySystem.createDirectoryOrFail(folder, 'Please provide an empty folder for the plugin.');

        const bits = Number(flags.bits);
        if (!Number.isInteger(bits) || !ALLOWED_BITS.includes(bits as AllowedBits)) {
            fail(
                logger,
                EXIT_INVALID_FLAGS,
                `invalid --bits: ${flags.bits}. must be one of ${ALLOWED_BITS.join(', ')}`,
            );
        }
        const skeleton =
            pluginSkeletons.find((s) => s.identifier === skeletonIdentifier) ??
            (skeletonIdentifier
                ? fail(logger, EXIT_INVALID_FLAGS, `unknown skeleton "${skeletonIdentifier}"`)
                : undefined);

        const headless = flags.interactive === false || !process.stdin.isTTY;

        if (headless) {
            if (!skeleton) fail(logger, EXIT_INVALID_FLAGS, 'non-interactive mode requires a [skeleton-identifier]');
            if (!flags.name) fail(logger, EXIT_INVALID_FLAGS, 'non-interactive mode requires --name');
            if (!flags.author) fail(logger, EXIT_INVALID_FLAGS, 'non-interactive mode requires --author');
            if (!flags.vendorUrl) fail(logger, EXIT_INVALID_FLAGS, 'non-interactive mode requires --vendor-url');
            // Assign to typed locals so the try block retains non-optional types.
            // tsc does not propagate narrowing from `if (!x) fail(...)` into subsequent const assignments
            // (known limitation), so one `!` per local is required here.
            const resolvedSkeleton = skeleton!;
            const resolvedName = flags.name!;
            const resolvedAuthor = flags.author!;
            const resolvedVendorUrl = flags.vendorUrl!;
            const identifier = kebab(flags.identifier || resolvedName);

            try {
                const dlQuery = queryBus.createQuery('DownloadPluginSkeletonArchive', {
                    skeleton: resolvedSkeleton,
                    destination: folder,
                });
                await queryBus.dispatch(dlQuery);
                logger.info('skeleton downloaded');

                const kpCmd = commandBus.createCommand('GeneratePluginKeypair', {
                    bits: bits as AllowedBits,
                    kid: flags.kid,
                });
                const { result: pair } = await commandBus.dispatch(kpCmd);
                if (!pair) fail(logger, 1, 'failed to generate keypair');
                // pair is narrowed to non-undefined here; assign to a const so tsc retains that inside the try block.
                const resolvedPair = pair!;
                await writeKeypairFiles({
                    flySystem,
                    logger,
                    pair: resolvedPair,
                    publicPath: path.join(folder, 'public.jwk.json'),
                    privatePath: path.join(folder, 'private.jwk.json'),
                    autoGitignore: true,
                });
                logger.info('keypair generated');

                const rtCmd = commandBus.createCommand('ReplacePluginTokens', {
                    folder,
                    tokens: {
                        '{{plugin_name}}': resolvedName,
                        '{{plugin_identifier}}': identifier,
                        '{{author_name}}': resolvedAuthor,
                        '{{vendor_url}}': resolvedVendorUrl,
                        '{{public_jwk}}': JSON.stringify(resolvedPair.publicJwk),
                        '{{private_jwk}}': JSON.stringify(resolvedPair.privateJwk),
                        '{{kid}}': flags.kid,
                    },
                });
                await commandBus.dispatch(rtCmd);
                logger.info('tokens substituted');

                if (flags.install !== false) {
                    const inCmd = commandBus.createCommand('InstallPluginDependencies', { folder });
                    await commandBus.dispatch(inCmd);
                    logger.info('dependencies installed');
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                fail(logger, 1, `plugin scaffolding failed: ${message}. the folder ${folder} was left in place.`);
            }
            logger.success(`plugin created in ${folder}`);
            logger.flush();
            return;
        }

        logger.setBuffered(true);
        const { storage, atoms } = createPluginCommandStore;
        storage.set(atoms.setFolderAtom, folder);
        if (skeleton) storage.set(atoms.setSkeletonAtom, skeleton);
        if (flags.install === false) storage.set(atoms.setSkipInstallAtom, true);
        if (cmd.getOptionValueSource('bits') === 'cli' || cmd.getOptionValueSource('kid') === 'cli') {
            storage.set(atoms.setKeypairAtom, { bits: bits as AllowedBits, kid: flags.kid });
        }
        if (flags.name && flags.author && flags.vendorUrl) {
            storage.set(atoms.setInfoAtom, {
                name: flags.name,
                identifier: kebab(flags.identifier || flags.name),
                author: flags.author,
                vendorUrl: flags.vendorUrl,
            });
        }

        console.log(logo);
        const { waitUntilExit } = render(
            <Box flexDirection="column" padding={1}>
                <Box flexDirection="column" marginBottom={1}>
                    <Text>
                        Let's create your Crystallize plugin! <Newline />
                    </Text>
                    <Provider store={storage}>
                        <CreatePluginJourney
                            store={atoms}
                            queryBus={queryBus}
                            commandBus={commandBus}
                            flySystem={flySystem}
                            logger={logger}
                        />
                    </Provider>
                </Box>
            </Box>,
            { exitOnCtrlC: true },
        );
        await waitUntilExit();
    });

    return command;
};
