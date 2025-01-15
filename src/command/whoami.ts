import type { CredentialRetriever } from '../domain/contracts/credential-retriever';
import type { Logger } from '../domain/contracts/logger';
import { Command } from 'commander';

type Deps = {
    credentialsRetriever: CredentialRetriever;
    logger: Logger;
};

export const createWhoAmICommand = ({ logger, credentialsRetriever }: Deps): Command => {
    const command = new Command('whoami');
    command.description('Check your Crystallize credentials are valid.');
    command.action(async () => {
        try {
            const credentials = await credentialsRetriever.getCredentials();
            const authenticatedUser = await credentialsRetriever.checkCredentials(credentials);
            if (authenticatedUser) {
                logger.success(`You are authenticated as ${authenticatedUser.email}`);
            } else {
                logger.warn('Credentials are invalid. Please run `crystallize login` to setup your credentials.');
            }
        } catch {
            logger.warn('No credentials found. Please run `crystallize login` to setup your credentials.');
        }
    });
    return command;
};
