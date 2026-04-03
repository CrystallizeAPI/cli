import type { Logger } from '../domain/contracts/logger';
import { Command } from 'commander';
import pc from 'picocolors';

type Deps = {
    logger: Logger;
};

export const createUpdateSkillsCommand = ({ logger }: Deps): Command => {
    const command = new Command('update-skills');
    command.description('Update Crystallize AI skills in your environment.');
    command.action(async () => {
        logger.info(`Updating Crystallize AI skills...`);

        const proc = Bun.spawn([process.execPath, 'x', 'skills', 'update', 'https://github.com/crystallizeapi/ai'], {
            env: { ...process.env, BUN_BE_BUN: '1' },
            stdin: 'inherit',
            stdout: 'inherit',
            stderr: 'inherit',
        });

        await proc.exited;

        if (proc.exitCode === 0) {
            logger.info(pc.green('Crystallize AI skills updated successfully!'));
        } else {
            logger.error('Failed to update Crystallize AI skills.');
            process.exit(proc.exitCode || 1);
        }
    });
    return command;
};
