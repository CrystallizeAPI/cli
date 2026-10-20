import { Argument, Command, Option } from 'commander';
import { Box, render, Text } from 'ink';
import path from 'node:path';
import pc from 'picocolors';
import { logo } from '..';
import { codingAgents } from '../content/coding-agents';
import type { CommandBus, QueryBus } from '../domain/contracts/bus';
import type { FlySystem } from '../domain/contracts/fly-system';
import type { Logger } from '../domain/contracts/logger';
import type { DetectedCodingAgent } from '../domain/contracts/models/coding-agent';
import type { SuperfastShop } from '../domain/contracts/models/superfast-shop';
import { Select, type Props as SelectProps } from '../ui/components/select';
import { SuperfastShopChoice } from '../ui/components/superfast-shop-choice';

type Deps = {
    logger: Logger;
    flySystem: FlySystem;
    queryBus: QueryBus;
    commandBus: CommandBus;
};

type Flags = {
    agent?: string;
};

const fail = (logger: Logger, message: string): never => {
    logger.error(message);
    logger.flush();
    process.exit(1);
};

// resolves with undefined when the user leaves with Ctrl+C
const pick = async <T,>(question: string, options: SelectProps<T>['options'], compact = false) => {
    let selected: T | undefined;
    const { waitUntilExit, unmount } = render(
        <Box flexDirection="column" padding={1}>
            <Text>{question}</Text>
            <Select<T>
                options={options}
                styles={{ compact }}
                onSelect={(value: T) => {
                    selected = value;
                    unmount();
                }}
            />
        </Box>,
        { exitOnCtrlC: true },
    );
    await waitUntilExit();
    return selected;
};

export const createSuperfastShopCommand = ({ logger, flySystem, queryBus, commandBus }: Deps): Command => {
    const command = new Command('superfast-shop');
    command.alias('sfs');
    command.description('Build your own shop from a Superfast Shop demo, with your coding agent.');
    command.addArgument(new Argument('<folder>', 'Folder to build the shop in (must be empty or not exist).'));
    command.addArgument(new Argument('[shop-identifier]', 'The Superfast Shop demo to start from.'));
    command.addOption(
        new Option('--agent <agent>', 'The coding agent to hand over to.').choices(
            codingAgents.map((agent) => agent.identifier),
        ),
    );

    command.action(async (folder: string, shopIdentifier: string | undefined, flags: Flags) => {
        if (!process.stdin.isTTY || !process.stdout.isTTY) {
            fail(
                logger,
                'superfast-shop hands your terminal over to a coding agent: run it in an interactive terminal.',
            );
        }
        await flySystem.createDirectoryOrFail(folder, 'Please provide an empty folder for your shop.');
        console.log(logo);

        const { result: fetched } = await queryBus.dispatch(queryBus.createQuery('FetchSuperfastShops', {}));
        const shops = fetched?.shops ?? [];
        if (shops.length === 0) {
            fail(logger, 'No Superfast Shop is available right now.');
        }
        const shop =
            shops.find((shop) => shop.id === shopIdentifier) ??
            (await pick<SuperfastShop>(
                'Which Superfast Shop do you want to start from?',
                shops.map((shop) => ({
                    label: shop.name,
                    value: shop,
                    render: () => <SuperfastShopChoice shop={shop} />,
                })),
            ));
        if (!shop) {
            return;
        }

        const { result: detected } = await queryBus.dispatch(
            queryBus.createQuery('DetectCodingAgents', { only: flags.agent }),
        );
        const agents = detected?.agents ?? [];
        if (agents.length === 0) {
            const requested = codingAgents.find((agent) => agent.identifier === flags.agent);
            if (requested) {
                fail(logger, `${requested.name} is not installed: ${pc.bold(requested.binary)} is not in your PATH.`);
            }
            logger.warn('No supported coding agent found.');
            logger.info(
                `Open a coding agent in ${pc.bold(folder)} and give it the ${shop.name} prompt: ${pc.cyan(shop.promptUrl)}`,
            );
            logger.info(
                `Supported agents: ${codingAgents.map((agent) => `${agent.name} (${agent.binary})`).join(', ')}.`,
            );
            return;
        }
        const agent =
            agents.length === 1
                ? agents[0]
                : await pick<DetectedCodingAgent>(
                      'Which coding agent should build it?',
                      agents.map((agent) => ({ label: `${agent.name} (${agent.path})`, value: agent })),
                      true,
                  );
        if (!agent) {
            return;
        }

        logger.info(`Starting ${agent.name} in ${pc.bold(folder)} with the ${shop.name} prompt…`);
        if (agent.asksToTrustFolder) {
            logger.info(`${agent.name} will ask whether you trust this folder: answer yes.`);
        }
        logger.flush();
        try {
            const { result: launched } = await commandBus.dispatch(
                commandBus.createCommand('LaunchCodingAgent', { agent, shop, folder: path.resolve(folder) }),
            );
            process.exit(launched?.exitCode ?? 1);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            fail(
                logger,
                `Could not start ${agent.name}: ${message}. You can give it the prompt from ${shop.promptUrl}`,
            );
        }
    });
    return command;
};
