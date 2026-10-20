import { readdir, mkdir, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ExtractArchiveOptions, FlySystem } from '../domain/contracts/fly-system';
import type { Logger } from '../domain/contracts/logger';

type Deps = {
    logger: Logger;
};
export const createFlySystem = ({ logger }: Deps): FlySystem => {
    const isDirectoryEmpty = async (path: string): Promise<boolean> => {
        try {
            const files = await readdir(path);
            return files.length === 0;
        } catch {
            return true;
        }
    };

    const loopInDirectory = async function* (path: string): AsyncGenerator<string> {
        try {
            const files = await readdir(path);
            if (files.length > 0) {
                for (const file of files) {
                    yield `${path.replace(/\/$/, '')}/${file}`;
                }
            }
        } catch {
            // nothing to do
        }
    };

    const makeDirectory = async (path: string): Promise<boolean> => {
        logger.debug(`Creating directory: ${path}`);
        mkdir(path, { recursive: true });
        return true;
    };

    const createDirectoryOrFail = async (path: string, message: string): Promise<true> => {
        if (!path || path.length === 0) {
            throw new Error(message);
        }
        if (!(await isDirectoryEmpty(path))) {
            throw new Error(`The folder "${path}" is not empty.`);
        }
        await makeDirectory(path);
        return true;
    };

    const isFileExists = async (path: string): Promise<boolean> => {
        const file = Bun.file(path);
        return await file.exists();
    };

    const loadFile = async (path: string): Promise<string> => {
        const file = Bun.file(path);
        return await file.text();
    };

    const loadJsonFile = async <T>(path: string): Promise<T> => {
        const file = Bun.file(path);
        return await file.json();
    };

    const loadBinaryFile = async (
        path: string,
    ): Promise<{
        type: string;
        content: ArrayBuffer;
    }> => {
        const file = Bun.file(path);
        return {
            type: file.type,
            content: await file.arrayBuffer(),
        };
    };

    const removeFile = async (path: string): Promise<void> => {
        logger.debug(`Removing file: ${path}`);
        return await unlink(path);
    };

    const saveFile = async (path: string, content: string): Promise<void> => {
        logger.debug(`Writing Content in file: ${path}`);
        await writeFile(path, content);
    };

    const replaceInFile = async (path: string, keyValues: { search: string; replace: string }[]): Promise<void> => {
        const file = Bun.file(path);
        const content = await file.text();
        const newContent = keyValues.reduce((memo: string, keyValue: { search: string; replace: string }) => {
            return memo.replaceAll(keyValue.search, keyValue.replace);
        }, content);
        await saveFile(path, newContent);
    };

    const extractArchive = async (
        archive: Blob,
        destination: string,
        { strip = 0, glob }: ExtractArchiveOptions = {},
    ): Promise<void> => {
        logger.debug(`Extracting archive in: ${destination}`);
        // reading the bytes first makes any Blob work, Bun.Archive cannot read a file-backed one like Bun.file()
        const tarball = new Bun.Archive(await archive.bytes());
        const extractOptions = glob ? { glob } : undefined;
        if (strip === 0) {
            await tarball.extract(destination, extractOptions);
            return;
        }
        // Bun.Archive cannot strip path segments: we extract in a work directory inside the destination
        // (same filesystem, so `rename` works) and move up the entries found `strip` levels deep.
        const workDirectory = join(destination, `.crystallize-archive-${Math.random().toString(36).substring(7)}`);
        const moveEntries = async (from: string, depth: number): Promise<void> => {
            for (const entry of await readdir(from, { withFileTypes: true })) {
                const path = join(from, entry.name);
                if (depth > 0) {
                    if (entry.isDirectory()) {
                        await moveEntries(path, depth - 1);
                    }
                    continue;
                }
                await rename(path, join(destination, entry.name));
            }
        };
        try {
            await tarball.extract(workDirectory, extractOptions);
            await moveEntries(workDirectory, strip);
        } finally {
            await rm(workDirectory, { recursive: true, force: true });
        }
    };

    return {
        isDirectoryEmpty,
        makeDirectory,
        loopInDirectory,
        loadBinaryFile,
        createDirectoryOrFail,
        isFileExists,
        loadFile,
        loadJsonFile,
        removeFile,
        saveFile,
        extractArchive,
        replaceInFile,
    };
};
