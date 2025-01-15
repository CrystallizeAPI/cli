import { Command } from 'commander';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
//@ts-expect-error - This is a workaround to import the changelog file as text. It's working with bun.
import Changelog from '../../CHANGELOG.md' with { type: 'text' };
// @ts-ignore
marked.use(markedTerminal());

export const createChangelogCommand = (): Command => {
    const command = new Command('changelog');
    command.description('Render the changelog.');
    command.action(async () => {
        console.log(marked.parse(Changelog));
    });
    return command;
};
