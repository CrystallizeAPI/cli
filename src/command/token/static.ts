import { Command, Argument } from 'commander';
import { addInteractiveAndTokenOption } from '../../core/helpers/add-iteractive-and-token-option';
import type { Logger } from '../../domain/contracts/logger';
import type { QueryBus } from '../../domain/contracts/bus';
import type { GetAuthenticatedUser } from '../../domain/contracts/get-authenticated-user';
import type { createClient } from '@crystallize/js-api-client';

type Deps = {
    logger: Logger;
    queryBus: QueryBus;
    getAuthenticatedUserWithInteractivityIfPossible: GetAuthenticatedUser;
    createCrystallizeClient: typeof createClient;
};
export const createGetStaticAuthTokenCommand = ({
    getAuthenticatedUserWithInteractivityIfPossible,
    queryBus,
    logger,
}: Deps): Command => {
    const command = new Command('static');
    command.description('Get the Static Auth Token.');
    command.addArgument(new Argument('<tenant-identifier>', 'The tenant identifier to get the token from.'));
    addInteractiveAndTokenOption(command);
    command.action(async (tenantIdentifier: string, flags) => {
        const { credentials } = await getAuthenticatedUserWithInteractivityIfPossible({
            isInteractive: !flags.noInteractive,
            token_id: flags.token_id,
            token_secret: flags.token_secret,
        });
        const intent = queryBus.createQuery('GetStaticAuthToken', {
            tenantIdentifier,
            credentials,
        });
        const { result } = await queryBus.dispatch(intent);
        if (!result) {
            throw new Error('Failed to get static auth token.');
        }
        logger.success(`{  "X-Crystallize-Static-Auth-Token": "${result.token}" } `);
    });
    return command;
};
