import type { Boilerplate } from './models/boilerplate';
import type { PimCredentials } from './models/credentials';
import type { Tenant } from './models/tenant';

type Deps = {
    addTraceLog: (log: string, code: number) => void;
    addTraceError: (log: string, code: number) => void;
};

type Args = {
    tenant: Tenant;
    credentials?: PimCredentials;
    folder: string;
};

export type TenantEnroller = {
    downloadArchive: (boilerplate: Boilerplate) => Promise<void>;
    runOperations: () => Promise<void>;
    uploadAssets: () => Promise<Record<string, string>>;
    executeMutations: (imageMapping: Record<string, string>) => Promise<void>;
    ignite: () => Promise<void>;
};
export type TenantEnrollerBuilder = (args: Args, deps: Deps) => Promise<TenantEnroller>;
