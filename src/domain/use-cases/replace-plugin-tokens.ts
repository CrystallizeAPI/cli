import type { CommandHandlerDefinition, Envelope } from 'missive.js';
import { copyFile, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type ReplacePluginTokensCommand = {
    folder: string;
    tokens: Record<string, string>;
};

export type ReplacePluginTokensHandlerDefinition = CommandHandlerDefinition<
    'ReplacePluginTokens',
    ReplacePluginTokensCommand,
    Awaited<ReturnType<typeof handler>>
>;

const SKIP_DIRS = new Set(['node_modules', '.git']);

// Tokens are applied sequentially; a replacement value that matches a later key will cascade.
const applyTokens = (input: string, tokens: Record<string, string>): string =>
    Object.entries(tokens).reduce((memo, [search, replace]) => memo.split(search).join(replace), input);

const isBinary = (buffer: Buffer): boolean => {
    const sample = buffer.subarray(0, 8000);
    return sample.includes(0);
};

const walk = async (dir: string, tokens: Record<string, string>): Promise<void> => {
    const dirents = await readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
        const current = path.join(dir, dirent.name);
        if (dirent.isSymbolicLink()) {
            continue;
        }
        if (dirent.isDirectory()) {
            if (SKIP_DIRS.has(dirent.name)) {
                continue;
            }
            await walk(current, tokens);
        } else if (dirent.isFile()) {
            const buffer = await readFile(current);
            if (!isBinary(buffer)) {
                const original = buffer.toString('utf8');
                const replaced = applyTokens(original, tokens);
                if (replaced !== original) {
                    await writeFile(current, replaced);
                }
            }
        }
        const renamed = applyTokens(dirent.name, tokens);
        if (renamed !== dirent.name) {
            await rename(current, path.join(dir, renamed));
        }
    }
};

const fileExists = async (file: string): Promise<boolean> => {
    try {
        await readFile(file);
        return true;
    } catch {
        return false;
    }
};

// Copies every `*.dist` template to its final name (e.g. `.env.dist` -> `.env`,
// `dev-payload.config.jsonc.dist` -> `dev-payload.config.jsonc`) without
// overwriting an existing target. Runs before the token walk so the
// materialized files get their tokens substituted too.
const materializeDistTemplates = async (dir: string): Promise<void> => {
    const dirents = await readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
        const current = path.join(dir, dirent.name);
        if (dirent.isSymbolicLink()) {
            continue;
        }
        if (dirent.isDirectory()) {
            if (SKIP_DIRS.has(dirent.name)) {
                continue;
            }
            await materializeDistTemplates(current);
        } else if (dirent.isFile() && dirent.name.endsWith('.dist')) {
            const target = path.join(dir, dirent.name.slice(0, -'.dist'.length));
            if (!(await fileExists(target))) {
                await copyFile(current, target);
            }
        }
    }
};

const handler = async (envelope: Envelope<ReplacePluginTokensCommand>): Promise<{ folder: string }> => {
    const { folder, tokens } = envelope.message;
    await materializeDistTemplates(folder);
    await walk(folder, tokens);
    return { folder };
};

export const createReplacePluginTokensHandler = () => (command: Envelope<ReplacePluginTokensCommand>) =>
    handler(command);
