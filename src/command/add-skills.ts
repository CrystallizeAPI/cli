import type { Logger } from '../domain/contracts/logger';
import { Command } from 'commander';
import pc from 'picocolors';

type Deps = {
    logger: Logger;
};

export const createAddSkillsCommand = ({ logger }: Deps): Command => {
    const command = new Command('add-skills');
    command.description('Add Crystallize AI skills to your environment.');
    command.action(async () => {
        logger.info(`Adding Crystallize AI skills...`);

        const proc = Bun.spawn([process.execPath, 'x', 'skills', 'add', 'https://github.com/crystallizeapi/ai'], {
            env: { ...process.env, BUN_BE_BUN: '1' },
            stdin: 'inherit',
            stdout: 'inherit',
            stderr: 'inherit',
        });

        await proc.exited;

        if (proc.exitCode === 0) {
            logger.info(pc.green('Crystallize AI skills added successfully!'));
        } else {
            logger.error('Failed to add Crystallize AI skills.');
            process.exit(proc.exitCode || 1);
        }
    });
    return command;
};
