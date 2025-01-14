import type { CredentialRetriever } from '../domain/contracts/credential-retriever';
import type { Logger } from '../domain/contracts/logger';
import { Command } from 'commander';
import { Box, render } from 'ink';
import { SetupCredentials } from '../ui/components/setup-credentials';
import type { PimAuthenticatedUser } from '../domain/contracts/models/authenticated-user';

type Deps = {
    credentialsRetriever: CredentialRetriever;
    logger: Logger;
};

export const createLoginCommand = ({ logger, credentialsRetriever }: Deps): Command => {
    const command = new Command('login');
    command.description('Check and propose to setup your Crystallize credentials.');
    command.action(async () => {
        logger.setBuffered(true);
        const { waitUntilExit, unmount } = render(
            <Box flexDirection="column" padding={1}>
                <Box flexDirection="column" marginBottom={1}>
                    <SetupCredentials
                        credentialsRetriever={credentialsRetriever}
                        dispatch={(authenticatedUser: PimAuthenticatedUser) => {
                            logger.log(`Setting up credentials for ${authenticatedUser.email}`);
                            unmount();
                        }}
                    />
                </Box>
            </Box>,
            {
                exitOnCtrlC: true,
            },
        );
        await waitUntilExit();
    });
    logger.flush();
    return command;
};
