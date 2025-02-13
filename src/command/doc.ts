import { Command } from 'commander';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
//@ts-expect-error - This is a workaround to import the changelog file as text. It's working with bun.
import Doc from '../../README.md' with { type: 'text' };
import { logo } from '..';
// @ts-ignore
marked.use(markedTerminal());

export const createDocCommand = (): Command => {
    const command = new Command('doc');
    command.description('Render the doc.');
    command.action(async () => {
        console.log(logo);
        console.log(marked.parse(Doc));
    });
    return command;
};
