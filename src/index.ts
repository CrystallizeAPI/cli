#!/usr/bin/env bun

import { Command } from 'commander';
import packageJson from '../package.json';
import pc from 'picocolors';
import { commands, logger } from './core/di';

const program = new Command();
program.version(packageJson.version);
program.name('crystallize');

const helpStyling = {
    styleTitle: (str: string) => pc.bold(str),
    styleCommandText: (str: string) => pc.cyan(str),
    styleCommandDescription: (str: string) => pc.magenta(str),
    styleDescriptionText: (str: string) => pc.italic(str),
    styleOptionText: (str: string) => pc.green(str),
    styleArgumentText: (str: string) => pc.yellow(str),
    styleSubcommandText: (str: string) => pc.cyan(str),
};
program.configureHelp(helpStyling);

const logo: string = `
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
program.description(
    "Crystallize CLI helps you manage your Crystallize tenant(s) and improve your DX.\nWe've got your back(end)!\n        🤜✨🤛.",
);
commands.forEach((command) => {
    command.configureHelp(helpStyling);
    program.addCommand(command);
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
    await program.parseAsync(process.argv);
} catch (exception) {
    logger.flush();
    if (exception instanceof Error) {
        logger.fatal(`[${pc.bold(exception.name)}] ${exception.message} `);
    } else {
        logger.fatal(`Unknown error.`);
    }
    logMemory();
    process.exit(1);
}
logger.flush();
logMemory();
process.exit(0);
