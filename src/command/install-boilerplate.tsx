import { Newline, render } from 'ink';
import { Box, Text } from 'ink';
import { InstallBoilerplateJourney } from '../core/journeys/install-boilerplate/install-boilerplate.journey';
import { Argument, Command, Option } from 'commander';
import { boilerplates } from '../content/boilerplates';
import type { FlySystem } from '../domain/contracts/fly-system';
import type { InstallBoilerplateStore } from '../core/journeys/install-boilerplate/create-store';
import { Provider } from 'jotai';
import type { CredentialRetriever } from '../domain/contracts/credential-retriever';
import type { Logger } from '../domain/contracts/logger';
import type { QueryBus } from '../domain/contracts/bus';

type Deps = {
    logLevels: ('info' | 'debug')[];
    flySystem: FlySystem;
    installBoilerplateCommandStore: InstallBoilerplateStore;
    credentialsRetriever: CredentialRetriever;
    logger: Logger;
    queryBus: QueryBus;
};

export const createInstallBoilerplateCommand = ({
    logger,
    flySystem,
    installBoilerplateCommandStore,
    credentialsRetriever,
    queryBus,
    logLevels,
}: Deps): Command => {
    const command = new Command('install-boilerplate');
    command.description('Install a boilerplate into a folder.');
    command.addArgument(new Argument('<folder>', 'The folder to install the boilerplate into.'));
    command.addArgument(new Argument('[tenant-identifier]', 'The tenant identifier to use.'));
    command.addArgument(new Argument('[boilerplate-identifier]', 'The boilerplate identifier to use.'));
    command.addOption(new Option('-b, --bootstrap-tenant', 'Bootstrap the tenant with initial data.'));

    command.action(async (...args) => {
        const [folder, tenantIdentifier, boilerplateIdentifier, flags] = args;
        logger.setBuffered(true);
        await flySystem.createDirectoryOrFail(
            folder,
            `Please provide an empty folder to install the boilerplate into.`,
        );
        const boilerplate = boilerplates.find((boiler) => boiler.identifier === boilerplateIdentifier);
        const { storage, atoms } = installBoilerplateCommandStore;

        storage.set(atoms.setFolderAtom, folder);

        if (boilerplate) {
            storage.set(atoms.setBoilerplateAtom, boilerplate);
        }

        if (tenantIdentifier) {
            storage.set(atoms.setTenantAtom, { identifier: tenantIdentifier });
        }

        storage.set(atoms.setBootstrapTenantAtom, !!flags.bootstrapTenant);
        storage.set(atoms.setVerbosity, logLevels.length > 0);

        logger.log('Starting install boilerplate journey.');
        const { waitUntilExit } = render(
            <Box flexDirection="column" padding={1}>
                <Box flexDirection="column" marginBottom={1}>
                    <Text>
                        Hi you, let's make something awesome! <Newline />
                    </Text>
                    <Provider store={storage}>
                        <InstallBoilerplateJourney
                            queryBus={queryBus}
                            store={atoms}
                            credentialsRetriever={credentialsRetriever}
                        />
                    </Provider>
                </Box>
            </Box>,
            {
                exitOnCtrlC: true,
            },
        );
        await waitUntilExit();
    });
    return command;
};
