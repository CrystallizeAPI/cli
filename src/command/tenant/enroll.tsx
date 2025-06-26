import { Command, Argument, Option } from 'commander';
import { addInteractiveAndTokenOption } from '../../core/helpers/add-iteractive-and-token-option';
import type { Logger } from '../../domain/contracts/logger';
import type { CommandBus } from '../../domain/contracts/bus';
import type { GetAuthenticatedUser } from '../../domain/contracts/get-authenticated-user';
import { Box, render, Text } from 'ink';
import type { Boilerplate } from '../../domain/contracts/models/boilerplate';
import { Select } from '../../ui/components/select';
import { BoilerplateChoice } from '../../ui/components/boilerplate-choice';
import { boilerplates } from '../../content/boilerplates';
import pc from 'picocolors';

type Deps = {
    logger: Logger;
    commandBus: CommandBus;
    getAuthenticatedUserWithInteractivityIfPossible: GetAuthenticatedUser;
};
export const createEnrollTenantCommand = ({
    getAuthenticatedUserWithInteractivityIfPossible,
    commandBus,
    logger,
}: Deps): Command => {
    const command = new Command('enroll');
    command.description('Bring the Shapes, Items and Images from a boilerplate.');
    command.addArgument(new Argument('<tenant-identifier>', 'The tenant identifier to address.'));
    command.addArgument(
        new Argument('[boilerplate-identifier]', 'The boilerplate identifier to get the package from.'),
    );
    command.addOption(new Option('--ignite', 'Ignite the tenant in Discovery API.'));
    addInteractiveAndTokenOption(command);
    command.action(async (tenantIdentifier: string, identifier: string, flags) => {
        const isInteractive = !flags.noInteractive;

        const { credentials } = await getAuthenticatedUserWithInteractivityIfPossible({
            isInteractive,
            token_id: flags.token_id,
            token_secret: flags.token_secret,
        });

        let boilerplate: Boilerplate | undefined = boilerplates.find((b) => b.identifier === identifier);
        if (!isInteractive && !boilerplate) {
            throw new Error('You must provide a boilerplate identifier when not running interactively.');
        }
        if (isInteractive && !boilerplate) {
            const { waitUntilExit, unmount } = render(
                <Box flexDirection="column" padding={1}>
                    <Box flexDirection="column" marginBottom={1}>
                        <Text>Please select a boilerplate to enroll your tenant for:</Text>
                        <Select<Boilerplate>
                            options={boilerplates.map((boilerplate: Boilerplate) => {
                                return {
                                    label: boilerplate.name,
                                    value: boilerplate,
                                    render: () => <BoilerplateChoice boilerplate={boilerplate} />,
                                };
                            })}
                            onSelect={(boiler: Boilerplate) => {
                                boilerplate = boiler;
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
        }

        if (!boilerplate) {
            throw new Error('No boilerplate selected.');
        }
        const intent = commandBus.createCommand('EnrollTenantWithBoilerplatePackage', {
            tenantIdentifier,
            credentials,
            boilerplate,
            doIgnite: flags.ignite,
        });
        const { result } = await commandBus.dispatch(intent);
        if (!result) {
            throw new Error('Failed to enroll the tenant.');
        }

        logger.success(`Package ${pc.yellow(boilerplate.name)} installed on ${pc.yellow(tenantIdentifier)}.`);
    });
    return command;
};
