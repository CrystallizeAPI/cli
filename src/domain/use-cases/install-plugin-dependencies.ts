import type { CommandHandlerDefinition, Envelope } from 'missive.js';
import { access } from 'node:fs/promises';
import path from 'node:path';
import type { Runner } from '../../core/create-runner';

type Deps = {
    runner: Runner;
};

export type InstallPluginDependenciesCommand = {
    folder: string;
};

export type InstallPluginDependenciesHandlerDefinition = CommandHandlerDefinition<
    'InstallPluginDependencies',
    InstallPluginDependenciesCommand,
    Awaited<ReturnType<typeof handler>>
>;

type PackageManager = 'bun' | 'pnpm' | 'npm' | 'yarn';

const exists = async (file: string): Promise<boolean> => {
    try {
        await access(file);
        return true;
    } catch {
        return false;
    }
};

export const detectPackageManager = async (folder: string): Promise<PackageManager> => {
    if (await exists(path.join(folder, 'bun.lock'))) return 'bun';
    if (await exists(path.join(folder, 'bun.lockb'))) return 'bun';
    if (await exists(path.join(folder, 'pnpm-lock.yaml'))) return 'pnpm';
    if (await exists(path.join(folder, 'package-lock.json'))) return 'npm';
    if (await exists(path.join(folder, 'yarn.lock'))) return 'yarn';
    return 'npm';
};

const handler = async (
    envelope: Envelope<InstallPluginDependenciesCommand>,
    deps: Deps,
): Promise<{ packageManager: PackageManager; exitCode: number }> => {
    const { folder } = envelope.message;
    const packageManager = await detectPackageManager(folder);
    const installArgs: Record<PackageManager, string[]> = {
        bun: ['bun', 'install', '--cwd', folder],
        pnpm: ['pnpm', '--dir', folder, 'install'],
        npm: ['npm', '--prefix', folder, 'install'],
        yarn: ['yarn', '--cwd', folder, 'install'],
    };
    const exitCode = await deps.runner(installArgs[packageManager]);
    return { packageManager, exitCode };
};

export const createInstallPluginDependenciesHandler =
    (deps: Deps) => (command: Envelope<InstallPluginDependenciesCommand>) =>
        handler(command, deps);
