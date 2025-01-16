import { Command } from 'commander';
import { addInteractiveAndTokenOption } from '../../core/helpers/add-iteractive-and-token-option';
import type { Logger } from '../../domain/contracts/logger';
import type { GetAuthenticatedUser } from '../../domain/contracts/get-authenticated-user';

type Deps = {
    logger: Logger;
    getAuthenticatedUserWithInteractivityIfPossible: GetAuthenticatedUser;
};
export const createGetPimAuthTokenCommand = ({
    getAuthenticatedUserWithInteractivityIfPossible,
    logger,
}: Deps): Command => {
    const command = new Command('pim');
    command.description('Get the Pim Auth Token.');
    addInteractiveAndTokenOption(command);
    command.action(async (flags) => {
        const { credentials } = await getAuthenticatedUserWithInteractivityIfPossible({
            isInteractive: !flags.noInteractive,
            token_id: flags.token_id,
            token_secret: flags.token_secret,
        });

        logger.success(
            `{  "X-Crystallize-Access-Token-Id": "${credentials.ACCESS_TOKEN_ID}", "X-Crystallize-Access-Token-Secret": "${credentials.ACCESS_TOKEN_SECRET}" } `,
        );
    });
    return command;
};
