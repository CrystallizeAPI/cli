import { Command } from 'commander';
//@ts-expect-error - This is a workaround to import the changelog file as text. It's working with bun.
import Changelog from '../../CHANGELOG.md' with { type: 'text' };

export const createChangelogCommand = (): Command => {
    const command = new Command('changelog');
    command.description('Render the changelog.');
    command.action(async () => {
        console.log(Bun.markdown.ansi(Changelog));
    });
    return command;
};
