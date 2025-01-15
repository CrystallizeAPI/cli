import os from 'os';
import type { Logger } from '../contracts/logger';
//@ts-expect-error - This is a workaround to import the completion file as text. It's working with bun.
import Completion from '../../content/completion_file.bash' with { type: 'text' };

type Deps = {
    logger: Logger;
};
export const installCompletion = async (shell: string, { logger }: Deps): Promise<void> => {
    const shellName = shell.split('/').pop();
    let rcFile;
    if (shellName === 'bash') {
        rcFile = `${os.homedir()}/.bashrc`;
    } else if (shellName === 'zsh') {
        rcFile = `${os.homedir()}/.zshrc`;
    } else {
        logger.warn(`Unsupported shell: ${shellName}. Completion file was not installed.`);
        return;
    }
    const dest = `${os.homedir()}/.crystallize/completion_file`;
    const fileRc = Bun.file(rcFile);
    if (!fileRc.exists()) {
        logger.warn(`The rc file ${rcFile} does not exist. Completion file was not installed.`);
        return;
    }

    const completionLine = `[ -s "${dest}" ] && source "${dest}"`;
    const fileContent = await fileRc.text();
    // we always write the new completion
    await Bun.write(dest, Completion);
    if (fileContent.includes(completionLine)) {
        logger.debug(`Completion is already set up in ${rcFile}`);
        return;
    }
    await Bun.write(rcFile, `${fileContent}# Crystallize CLI completion\n${completionLine}\n`);
    logger.success(`Installing completion file in ${rcFile}`);
};
