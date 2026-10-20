import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
    chmod,
    lstat,
    mkdir,
    mkdtemp,
    readdir,
    readFile,
    readlink,
    rm,
    stat,
    symlink,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createFlySystem } from './create-flysystem';
import { createLogger } from './create-logger';

const flySystem = createFlySystem({ logger: createLogger([]) });

const tree = async (dir: string) => (await readdir(dir, { recursive: true })).sort();

let workDir: string;
let destination: string;
let tarball: string;

// Mimics a GitHub tarball: everything is wrapped in a single "<repo>-<branch>" directory.
const buildTarball = async () => {
    const source = path.join(workDir, 'source');
    const plugin = path.join(source, 'repo-main/plugins/hello');
    await mkdir(path.join(plugin, 'bin'), { recursive: true });
    await writeFile(path.join(source, 'repo-main/README.md'), 'readme');
    await writeFile(path.join(source, 'repo-main/.gitignore'), 'node_modules');
    await writeFile(path.join(plugin, 'index.ts'), 'hello');
    await writeFile(path.join(plugin, 'bin/run.sh'), '#!/bin/sh\necho hello\n');
    await chmod(path.join(plugin, 'bin/run.sh'), 0o755);
    await symlink('index.ts', path.join(plugin, 'link.ts'));

    const file = path.join(workDir, 'repo.tar.gz');
    const result = spawnSync('tar', ['-czf', file, '-C', source, 'repo-main'], {
        // prevents macOS tar from adding AppleDouble "._*" entries
        env: { ...process.env, COPYFILE_DISABLE: '1' },
    });
    expect(result.status).toBe(0);
    return file;
};

beforeEach(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'crystallize-flysystem-'));
    destination = path.join(workDir, 'destination');
    await mkdir(destination);
    tarball = await buildTarball();
});

afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
});

describe('flySystem.extractArchive', () => {
    test('extracts every entry as-is without strip', async () => {
        await flySystem.extractArchive(Bun.file(tarball), destination);
        expect(await tree(destination)).toEqual([
            'repo-main',
            'repo-main/.gitignore',
            'repo-main/README.md',
            'repo-main/plugins',
            'repo-main/plugins/hello',
            'repo-main/plugins/hello/bin',
            'repo-main/plugins/hello/bin/run.sh',
            'repo-main/plugins/hello/index.ts',
            'repo-main/plugins/hello/link.ts',
        ]);
    });

    test('strip removes the leading directory and leaves no work directory behind', async () => {
        await flySystem.extractArchive(Bun.file(tarball), destination, { strip: 1 });
        expect(await tree(destination)).toEqual([
            '.gitignore',
            'README.md',
            'plugins',
            'plugins/hello',
            'plugins/hello/bin',
            'plugins/hello/bin/run.sh',
            'plugins/hello/index.ts',
            'plugins/hello/link.ts',
        ]);
        expect(await readFile(path.join(destination, 'README.md'), 'utf8')).toBe('readme');
    });

    test('strip with a glob only extracts the matching subfolder at the top level', async () => {
        await flySystem.extractArchive(Bun.file(tarball), destination, { strip: 3, glob: '*/plugins/hello/**' });
        expect(await tree(destination)).toEqual(['bin', 'bin/run.sh', 'index.ts', 'link.ts']);
    });

    test('keeps executable permissions and symlinks when stripping', async () => {
        await flySystem.extractArchive(Bun.file(tarball), destination, { strip: 3, glob: '*/plugins/hello/**' });
        expect((await stat(path.join(destination, 'bin/run.sh'))).mode & 0o111).not.toBe(0);
        expect((await lstat(path.join(destination, 'link.ts'))).isSymbolicLink()).toBe(true);
        expect(await readlink(path.join(destination, 'link.ts'))).toBe('index.ts');
    });

    test('accepts an in-memory blob like a fetch response', async () => {
        const blob = new Blob([await Bun.file(tarball).bytes()]);
        await flySystem.extractArchive(blob, destination, { strip: 1 });
        expect(await tree(destination)).toContain('plugins/hello/index.ts');
    });

    test('rejects a corrupt archive and cleans up the work directory', async () => {
        await expect(
            flySystem.extractArchive(new Blob(['not a tarball']), destination, { strip: 1 }),
        ).rejects.toThrow();
        expect(await tree(destination)).toEqual([]);
    });
});
