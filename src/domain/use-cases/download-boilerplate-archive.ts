import type { Envelope, QueryHandlerDefinition } from 'missive.js';
import type { Boilerplate } from '../contracts/models/boilerplate';
import type { FlySystem } from '../contracts/fly-system';

type Deps = {
    flySystem: FlySystem;
};
export type DownloadBoilerplateQuery = {
    boilerplate: Boilerplate;
    destination: string;
};

export type DownloadBoilerplateArchiveHandlerDefinition = QueryHandlerDefinition<
    'DownloadBoilerplateArchive',
    DownloadBoilerplateQuery,
    Awaited<ReturnType<typeof handler>>
>;

const handler = async (envelope: Envelope<DownloadBoilerplateQuery>, deps: Deps) => {
    const { boilerplate, destination } = envelope.message;
    const { flySystem } = deps;
    const repo = boilerplate.git.replace('https://github.com/', '');
    const tarFileUrl = `https://github.com/${repo}/archive/master.tar.gz`;
    const response = await fetch(tarFileUrl);
    if (!response.ok) {
        throw new Error(`Failed to download boilerplate archive (${tarFileUrl}): HTTP ${response.status}`);
    }
    // The GitHub tarball wraps everything in a single top-level "<repo>-<branch>" directory.
    await flySystem.extractArchive(await response.blob(), destination, { strip: 1 });
};

export const createDownloadBoilerplateArchiveHandler = (deps: Deps) => (query: Envelope<DownloadBoilerplateQuery>) =>
    handler(query, deps);
