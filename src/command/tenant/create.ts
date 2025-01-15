import { Argument, Command, Option } from 'commander';
import type { Logger } from '../../domain/contracts/logger';
import type { CommandBus } from '../../domain/contracts/bus';
import type { GetAuthenticatedUser } from '../../domain/contracts/get-authenticated-user';
import type { FetchAvailableTenantIdentifier } from '../../domain/contracts/fetch-available-tenant-identifier';
import { addInteractiveAndTokenOption } from '../../core/helpers/add-iteractive-and-token-option';

type Deps = {
    logger: Logger;
    commandBus: CommandBus;
    getAuthenticatedUserWithInteractivityIfPossible: GetAuthenticatedUser;
    fetchAvailableTenantIdentifier: FetchAvailableTenantIdentifier;
};

export const createCreateTenantCommand = ({
    logger,
    commandBus,
    fetchAvailableTenantIdentifier,
    getAuthenticatedUserWithInteractivityIfPossible,
}: Deps): Command => {
    const command = new Command('create');
    command.description('Create a tenant in Crystallize');
    command.addArgument(new Argument('<tenant-identifier>', 'The tenant identifier that you would like.'));
    command.addOption(
        new Option('--fail-if-not-available', 'Stop execution if the tenant identifier is not available.'),
    );
    addInteractiveAndTokenOption(command);
    command.action(async (tenantIdentifier: string, flags) => {
        const { credentials } = await getAuthenticatedUserWithInteractivityIfPossible({
            isInteractive: !flags.noInteractive,
            token_id: flags.token_id,
            token_secret: flags.token_secret,
        });
        const finalTenantIdentifier = await fetchAvailableTenantIdentifier(credentials, tenantIdentifier);
        if (flags.failIfNotAvailable && finalTenantIdentifier !== tenantIdentifier) {
            throw new Error(
                `The tenant identifier ${tenantIdentifier} is not available. Suggestion: ${finalTenantIdentifier}.`,
            );
        }
        const intent = commandBus.createCommand('CreateCleanTenant', {
            credentials,
            tenant: {
                identifier: finalTenantIdentifier,
            },
        });
        const { result } = await commandBus.dispatch(intent);
        if (!result) {
            throw new Error('Failed to create tenant.');
        }
        if (result.identifier !== tenantIdentifier) {
            logger.note(`Please note we change the identifier for you as the requested one was taken.`);
        }
        logger.success(`Tenant created with identifier: ${result.identifier}`);
    });
    return command;
};
