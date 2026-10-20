import type { Envelope, QueryHandlerDefinition } from 'missive.js';
import type { ExtractArchiveOptions, FlySystem } from '../contracts/fly-system';
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
export const tarOptionsFor = (subfolder: string | undefined): ExtractArchiveOptions => {
    const cleaned = (subfolder ?? '').replace(/^\/+|\/+$/g, '');
    if (cleaned.length === 0) {
        return { strip: 1 };
    }
    return {
        strip: 1 + cleaned.split('/').length,
        glob: `*/${cleaned}/**`,
    };
};

const handler = async (envelope: Envelope<DownloadPluginSkeletonQuery>, deps: Deps) => {
    const { skeleton, destination } = envelope.message;
    const { flySystem } = deps;
    const repo = skeleton.git.replace('https://github.com/', '');
    const branch = skeleton.branch ?? 'main';
    const tarFileUrl = `https://github.com/${repo}/archive/${branch}.tar.gz`;
    const response = await fetch(tarFileUrl);
    if (!response.ok) {
        throw new Error(`Failed to download skeleton archive (${tarFileUrl}): HTTP ${response.status}`);
    }
    await flySystem.extractArchive(await response.blob(), destination, tarOptionsFor(skeleton.subfolder));
};

export const createDownloadPluginSkeletonArchiveHandler =
    (deps: Deps) => (query: Envelope<DownloadPluginSkeletonQuery>) =>
        handler(query, deps);
