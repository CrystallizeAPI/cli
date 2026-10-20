import { Command } from 'commander';
//@ts-expect-error - This is a workaround to import the changelog file as text. It's working with bun.
import Doc from '../../README.md' with { type: 'text' };
import { logo } from '..';

export const createDocCommand = (): Command => {
    const command = new Command('doc');
    command.description('Render the doc.');
    command.action(async () => {
        console.log(logo);
        console.log(Bun.markdown.ansi(Doc));
    });
    return command;
};
