import type { Envelope, QueryHandlerDefinition } from 'missive.js';
import { extract } from 'tar';
import os from 'os';
import type { FlySystem } from '../contracts/fly-system';
import type { PluginSkeleton } from '../contracts/models/plugin-skeleton';

type Deps = {
    flySystem: FlySystem;
};

export type DownloadPluginSkeletonQuery = {
    skeleton: PluginSkeleton;
    destination: string;
};

export type DownloadPluginSkeletonArchiveHandlerDefinition = QueryHandlerDefinition<
    'DownloadPluginSkeletonArchive',
    DownloadPluginSkeletonQuery,
    Awaited<ReturnType<typeof handler>>
>;

// Exported for unit testing. The GitHub tarball wraps everything in a single
// top-level "<repo>-<branch>" directory, hence the implicit +1 to strip depth.
export const tarOptionsFor = (subfolder: string | undefined) => {
    const cleaned = (subfolder ?? '').replace(/^\/+|\/+$/g, '');
    if (cleaned.length === 0) {
        return {
            strip: 1,
            filter: (_path: string, _entry: unknown) => true,
        };
    }
    const depth = cleaned.split('/').length;
    return {
        strip: 1 + depth,
        filter: (entryPath: string, _entry: unknown) => {
            const segments = entryPath.split('/');
            const afterRoot = segments.slice(1).join('/');
            return afterRoot === cleaned || afterRoot.startsWith(`${cleaned}/`);
        },
    };
};

const handler = async (envelope: Envelope<DownloadPluginSkeletonQuery>, deps: Deps) => {
    const { skeleton, destination } = envelope.message;
    const { flySystem } = deps;
    const tempDir = os.tmpdir();
    const uniqueId = Math.random().toString(36).substring(7);
    const repo = skeleton.git.replace('https://github.com/', '');
    const branch = skeleton.branch ?? 'main';
    const tarFileUrl = `https://github.com/${repo}/archive/${branch}.tar.gz`;
    const response = await fetch(tarFileUrl);
    if (!response.ok) {
        throw new Error(`Failed to download skeleton archive (${tarFileUrl}): HTTP ${response.status}`);
    }
    const tarFilePath = `${tempDir}/crystallize-plugin-skeleton-${uniqueId}.tar.gz`;
    await flySystem.saveResponse(tarFilePath, response);
    const { strip, filter } = tarOptionsFor(skeleton.subfolder);
    await extract({ file: tarFilePath, cwd: destination, strip, filter });
    await flySystem.removeFile(tarFilePath);
};

export const createDownloadPluginSkeletonArchiveHandler =
    (deps: Deps) => (query: Envelope<DownloadPluginSkeletonQuery>) =>
        handler(query, deps);
