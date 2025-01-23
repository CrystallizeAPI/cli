import { Box, render } from 'ink';
import type { CredentialRetriever } from '../contracts/credential-retriever';
import type { Logger } from '../contracts/logger';
import type { PimAuthenticatedUser } from '../contracts/models/authenticated-user';
import type { PimCredentials } from '../contracts/models/credentials';
import { SetupCredentials } from '../../ui/components/setup-credentials';

type Deps = {
    logger: Logger;
    credentialsRetriever: CredentialRetriever;
};
type Args = {
    isInteractive: boolean;
    token_id?: string;
    token_secret?: string;
};
export const createGetAuthenticatedUserWithInteractivityIfPossible =
    ({ logger, credentialsRetriever }: Deps) =>
    async ({
        isInteractive,
        token_id,
        token_secret,
    }: Args): Promise<{
        authenticatedUser: PimAuthenticatedUser;
        credentials: PimCredentials;
    }> => {
        try {
            const credentials = await credentialsRetriever.getCredentials({ token_id, token_secret });
            const authenticatedUser = await credentialsRetriever.checkCredentials(credentials);
            if (!authenticatedUser) {
                throw new Error('Credentials are invalid');
            }
            return { authenticatedUser, credentials };
        } catch (error) {
            if (!isInteractive) {
                throw new Error(
                    'Credentials are invalid. Please run `crystallize login` to setup your credentials or provide correct credentials.',
                );
            }
            logger.setBuffered(true);
            let authenticatedUser: PimAuthenticatedUser | undefined;
            let credentials: PimCredentials | undefined;

            logger.warn('Credentials are invalid. Starting interactive mode...');
            const { waitUntilExit, unmount } = render(
                <Box flexDirection="column" padding={1}>
                    <Box flexDirection="column" marginBottom={1}>
                        <SetupCredentials
                            credentialsRetriever={credentialsRetriever}
                            dispatch={(user: PimAuthenticatedUser, creds: PimCredentials) => {
                                authenticatedUser = user;
                                credentials = creds;
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
            logger.flush();
            logger.setBuffered(false);
            if (!authenticatedUser || !credentials) {
                throw new Error(
                    'Credentials are invalid. Please run `crystallize login` to setup your credentials or provide correct credentials.',
                );
            }
            return { authenticatedUser, credentials };
        }
    };
