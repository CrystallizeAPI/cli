import { Command, Argument, Option } from 'commander';
import { addInteractiveAndTokenOption } from '../../core/helpers/add-iteractive-and-token-option';
import type { Logger } from '../../domain/contracts/logger';
import type { QueryBus } from '../../domain/contracts/bus';
import type { GetAuthenticatedUser } from '../../domain/contracts/get-authenticated-user';

type Deps = {
    logger: Logger;
    queryBus: QueryBus;
    getAuthenticatedUserWithInteractivityIfPossible: GetAuthenticatedUser;
};
export const createGetShopAuthTokenCommand = ({
    getAuthenticatedUserWithInteractivityIfPossible,
    queryBus,
    logger,
}: Deps): Command => {
    const command = new Command('shop');
    command.description('Get the Shop API Auth Token.');
    command.addArgument(new Argument('<tenant-identifier>', 'The tenant identifier to get the token from.'));
    command.addOption(new Option('--scopes <scopes...>', 'The scopes to give the token.').default(['cart']));
    command.addOption(new Option('--expiry <expiry>', 'Number of hours of validity for the token.').default(6));
    addInteractiveAndTokenOption(command);
    command.action(async (tenantIdentifier: string, flags) => {
        const { credentials } = await getAuthenticatedUserWithInteractivityIfPossible({
            isInteractive: !flags.noInteractive,
            token_id: flags.token_id,
            token_secret: flags.token_secret,
        });
        const scopes = flags.scopes.flatMap((scope: string) => scope.split(','));
        const intent = queryBus.createQuery('GetShopAuthToken', {
            tenantIdentifier,
            credentials,
            scopes,
            expiresIn: (flags.expiry || 6) * 60 * 60,
        });
        const { result } = await queryBus.dispatch(intent);
        if (!result) {
            throw new Error('Failed to get Shop Api token.');
        }
        logger.success(`{  "Authorization": "bearer ${result.token}" } `);
    });
    return command;
};
