import { Command, Option } from 'commander';

export const addInteractiveAndTokenOption = (command: Command) => {
    command.addOption(new Option('--token_id <token_id>', 'Your access token id.'));
    command.addOption(new Option('--token_secret <token_secret>', 'Your access token secret.'));
    command.addOption(new Option('--no-interactive', 'Disable the interactive mode.'));
};
