import { Command } from 'commander';
import packageJson from '../../package.json';
import type { Updater } from '../core/create-updater';

type Deps = {
    updater: Updater;
};

export const createUpdateCommand = ({ updater }: Deps): Command => {
    const command = new Command('update');
    command.description('Update the Crystallize CLI to the latest version.');
    command.action(async () => {
        await updater.update(packageJson.version);
    });
    return command;
};
