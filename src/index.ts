#!/usr/bin/env bun

import { Argument, Command, Option } from 'commander';
import packageJson from '../package.json';
import pc from 'picocolors';
import { buildServices } from './core/di';
import { installCompletion } from './domain/use-cases/install-completion';
import { checkForUpdate } from './core/check-for-update';

const services = buildServices();
const { logger, commands } = services;

const program = new Command();
program.allowExcessArguments(false);
program.allowUnknownOption(false);
program.version(packageJson.version);
program.name('crystallize');
program.addOption(new Option('--install-completion', 'Install the completion').hideHelp());
program.addOption(new Option('--uninstall-completion', 'Install the completion').hideHelp());

const helpStyling = {
    styleTitle: (str: string) => pc.bold(str),
    styleCommandText: (str: string) => pc.cyan(str),
    styleCommandDescription: (str: string) => pc.magenta(str),
    styleDescriptionText: (str: string) => pc.italic(str),
    styleOptionText: (str: string) => pc.green(str),
    styleArgumentText: (str: string) => pc.yellow(str),
    styleSubcommandText: (str: string) => pc.cyan(str),
};

export const logo: string = `
            /\\
         /\\/  \\
     _  / /    \\
    / \\/ /      \\
    \\ / /       /__
     \\ /       /  /
      \\       /  /
       \\     /  /
        \\___/__/  

 Crystallize CLI ${pc.italic(pc.yellow(packageJson.version))}
`;
program.addHelpText('beforeAll', pc.cyanBright(logo));
const genericCommandOption = (command: Command) => {
    command.configureHelp(helpStyling);
    command.allowExcessArguments(false);
    command.allowUnknownOption(false);
    command.configureOutput({
        writeErr: (str) => logger.error(str),
    });
};

program.description(
    "Crystallize CLI helps you manage your Crystallize tenant(s) and improve your DX.\nWe've got your back(end)!\n        🤜✨🤛.",
);

program.action(async () => {
    const shell = Bun.env.SHELL || '/bin/bash';
    await installCompletion(shell, { logger });
    program.help();
});
genericCommandOption(program);

commands.root.commands.forEach((command) => {
    genericCommandOption(command);
    program.addCommand(command);
});

Object.keys(commands).forEach((key) => {
    if (key === 'root') return;
    const group = new Command(key);
    const description = commands[key as keyof typeof commands].description;
    if (description) {
        group.description(description);
    }
    commands[key as keyof typeof commands].commands.forEach((command) => {
        genericCommandOption(command);
        group.addCommand(command);
        group.addArgument(new Argument(`[${command.name()}]`, command.description()));
    });

    genericCommandOption(group);
    program.addCommand(group);
});

const logMemory = () => {
    const used = process.memoryUsage();
    logger.debug(
        `${pc.bold('Memory usage:')} ${Object.keys(used)
            .map((key) => `${key} ${Math.round((used[key as keyof typeof used] / 1024 / 1024) * 100) / 100} MB`)
            .join(', ')}`,
    );
};

try {
    await checkForUpdate(logger, packageJson.version);
    await program.parseAsync(process.argv);
} catch (exception) {
    logger.flush();
    if (exception instanceof Error) {
        logger.fatal(`[${pc.bold(exception.name)}] ${exception.message} `);
    } else if (typeof exception === 'string') {
        logger.fatal(exception);
    } else if (exception instanceof Object && 'message' in exception) {
        logger.fatal(exception.message);
    } else {
        logger.fatal(`Unknown error.`);
    }
    logger.debug(exception);
    logMemory();
    process.exit(1);
}
logger.flush();
logMemory();
process.exit(0);
