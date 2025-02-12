import { Command, Argument, Option } from 'commander';
import { addInteractiveAndTokenOption } from '../../core/helpers/add-iteractive-and-token-option';
import type { Logger } from '../../domain/contracts/logger';
import type { CommandBus } from '../../domain/contracts/bus';
import type { GetAuthenticatedUser } from '../../domain/contracts/get-authenticated-user';

type Deps = {
    logger: Logger;
    commandBus: CommandBus;
    getAuthenticatedUserWithInteractivityIfPossible: GetAuthenticatedUser;
};
export const createCreateInviteTokenCommand = ({
    getAuthenticatedUserWithInteractivityIfPossible,
    commandBus,
    logger,
}: Deps): Command => {
    const command = new Command('invite');
    command.description('Generate invite(s) for new users.');
    command.addArgument(new Argument('<tenant-identifier>', 'The tenant identifier to invite on.'));
    command.addOption(new Option('--role <role>', 'The role to assign to the new user.').default('tenantAdmin'));
    command.addOption(new Option('--expiry <expiry>', 'Number of hours of validity for the invite(s).').default(6));
    command.addOption(new Option('--number <number>', 'Number of invites to generate.').default(1));
    addInteractiveAndTokenOption(command);
    command.action(async (tenantIdentifier: string, flags) => {
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * (flags.expiry || 6));
        const role = flags.role || 'tenantAdmin';
        const number = flags.number || 1;

        const { credentials } = await getAuthenticatedUserWithInteractivityIfPossible({
            isInteractive: !flags.noInteractive,
            token_id: flags.token_id,
            token_secret: flags.token_secret,
        });

        const intent = commandBus.createCommand('CreateTenantInviteToken', {
            expiresAt,
            tenantIdentifier,
            credentials,
            number,
            role,
        });
        const { result } = await commandBus.dispatch(intent);
        if (!result) {
            throw new Error('Failed to create invite token.');
        }

        logger.success(`Invite token(s) created for ${tenantIdentifier}`);
        result.tokens.forEach((token) => {
            logger.complete(`\t - https://app.crystallize.com/get-access?token=${token}`);
        });
    });
    return command;
};
