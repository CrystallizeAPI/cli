import path from 'node:path';
import { chmod } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import type { FlySystem } from '../../domain/contracts/fly-system';
import type { Logger } from '../../domain/contracts/logger';
import type { PluginJwkPair } from '../../domain/use-cases/generate-plugin-keypair';

export const findGitRoot = (cwd: string): string | null => {
    const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (result.status !== 0) return null;
    const output = result.stdout.trim();
    return output.length > 0 ? output : null;
};

export const gitignoreContains = (content: string, name: string): boolean =>
    content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .some((line) => line === name || line === `/${name}` || line === `./${name}`);

type WriteKeypairOptions = {
    flySystem: FlySystem;
    logger: Logger;
    pair: PluginJwkPair;
    publicPath: string;
    privatePath: string;
    autoGitignore: boolean;
};

export const writeKeypairFiles = async ({
    flySystem,
    logger,
    pair,
    publicPath,
    privatePath,
    autoGitignore,
}: WriteKeypairOptions): Promise<void> => {
    await flySystem.saveFile(publicPath, JSON.stringify(pair.publicJwk, null, 2) + '\n');
    await flySystem.saveFile(privatePath, JSON.stringify(pair.privateJwk, null, 2) + '\n');
    try {
        await chmod(privatePath, 0o600);
    } catch (error) {
        logger.debug(`unable to chmod 0600 on ${privatePath}: ${error}`);
    }
    if (!autoGitignore) {
        return;
    }
    const gitRoot = findGitRoot(path.dirname(publicPath));
    const gitignorePath = path.join(gitRoot ?? path.dirname(publicPath), '.gitignore');
    try {
        const existing = (await flySystem.isFileExists(gitignorePath)) ? await flySystem.loadFile(gitignorePath) : '';
        if (!gitignoreContains(existing, 'private.jwk.json')) {
            const suffix = existing.endsWith('\n') || existing.length === 0 ? '' : '\n';
            await flySystem.saveFile(gitignorePath, existing + suffix + 'private.jwk.json\n');
            logger.debug(`added private.jwk.json to ${gitignorePath}`);
        }
    } catch (error) {
        logger.debug(`skipped .gitignore update: ${error}`);
    }
};
