import type { Envelope, QueryHandlerDefinition } from 'missive.js';
import type { Boilerplate } from '../contracts/models/boilerplate';
import { extract } from 'tar';
import type { FlySystem } from '../contracts/fly-system';
import os from 'os';

type Deps = {
    flySystem: FlySystem;
};
type Query = {
    boilerplate: Boilerplate;
    destination: string;
};

export type DownloadBoilerplateArchiveHandlerDefinition = QueryHandlerDefinition<
    'DownloadBoilerplateArchive',
    Query,
    Awaited<ReturnType<typeof handler>>
>;

const handler = async (envelope: Envelope<Query>, deps: Deps) => {
    const tempDir = os.tmpdir();
    const uniqueId = Math.random().toString(36).substring(7);

    const { boilerplate, destination } = envelope.message;
    const { flySystem } = deps;
    const repo = boilerplate.git.replace('https://github.com/', '');
    const tarFileUrl = `https://github.com/${repo}/archive/master.tar.gz`;
    const response = await fetch(tarFileUrl);
    const tarFilePath = `${tempDir}/crystallize-boilerplate-archive-${uniqueId}.tar.gz`;
    await flySystem.saveResponse(tarFilePath, response);
    await extract({
        file: tarFilePath,
        cwd: destination,
        strip: 1,
    });
    await flySystem.removeFile(tarFilePath);
};

export const createDownloadBoilerplateArchiveHandler = (deps: Deps) => (query: Envelope<Query>) => handler(query, deps);
