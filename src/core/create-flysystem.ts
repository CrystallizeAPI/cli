import { readdir, mkdir, unlink, writeFile } from 'node:fs/promises';
import type { FlySystem } from '../domain/contracts/fly-system';
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
            return memo.replace(keyValue.search, keyValue.replace);
        }, content);
        await saveFile(path, newContent);
    };

    const saveResponse = async (path: string, response: Response): Promise<void> => {
        logger.debug(`Writing Response in file: ${path}`);
        await Bun.write(path, response);
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
        saveResponse,
        replaceInFile,
    };
};
