import type { FlySystem } from '../contracts/fly-system';
import type { PimCredentials } from '../contracts/models/credentials';
import type { CommandHandlerDefinition, Envelope } from 'missive.js';
import { MutationsInputSchema } from '../contracts/models/mutations';
import type { AsyncCreateClient } from '../contracts/credential-retriever';
import type { Tenant } from '../contracts/models/tenant';

type Deps = {
    flySystem: FlySystem;
    createCrystallizeClient: AsyncCreateClient;
};

export type ExecuteMutationsCommand = {
    filePath: string;
    tenant: Tenant;
    credentials: PimCredentials;
    placeholderMap?: Record<string, any | any[]>;
};

export type ExecuteMutationsHandlerDefinition = CommandHandlerDefinition<
    'ExecuteMutations',
    ExecuteMutationsCommand,
    Awaited<ReturnType<typeof handler>>
>;

const handler = async (envelope: Envelope<ExecuteMutationsCommand>, { flySystem, createCrystallizeClient }: Deps) => {
    const { filePath, tenant, credentials, placeholderMap } = envelope.message;

    const apiClient = await createCrystallizeClient({
        tenantIdentifier: tenant.identifier,
        sessionId: credentials.sessionId,
        accessTokenId: credentials.ACCESS_TOKEN_ID,
        accessTokenSecret: credentials.ACCESS_TOKEN_SECRET,
    });

    const results = await apiClient.pimApi(`#graphql
            query { 
                tenant {
                    get(id:"${apiClient.config.tenantId}") {
                        rootItemId
                        vatTypes {
                            id
                        }
                    }
                }
            }`);

    const { rootItemId, vatTypes } = results.tenant.get;
    const defaultVat = vatTypes[0].id;

    // we have to use any here... because the placeholderMap is dynamic
    let map: Record<string, any | any[]> = {
        ...placeholderMap,
        root: {
            TENANT_ID: apiClient.config.tenantId,
            TENANT_DEFAULT_VATTYPE_ID: defaultVat,
            TENANT_ROOT_ID: rootItemId,
        },
    };

    const extraMutationsContent = await flySystem.loadFile(filePath);
    const extraMutationsIntent = JSON.parse(extraMutationsContent);
    const extraMutations = MutationsInputSchema.parse(extraMutationsIntent);
    for (const [identifier, { mutation, target, sets }] of Object.entries(extraMutations)) {
        map[identifier] = [];
        const caller = target === 'pim' ? apiClient.pimApi : apiClient.nextPimApi;
        for (const set of sets) {
            try {
                const apiResults = await caller(mutation, resolvePlaceholders(set, map));
                map[identifier].push(apiResults);
            } catch (e) {
                map[identifier].push(e);
            }
        }
    }

    return {
        results: map,
    };
};

export const createExecuteMutationsHandler = (deps: Deps) => (command: Envelope<ExecuteMutationsCommand>) =>
    handler(command, deps);

const resolvePlaceholders = (obj: any, lookup: Record<string, any>): any => {
    if (typeof obj === 'string') {
        return obj.replace(/\$([a-zA-Z0-9_-]+(?:\[\d+])*)\.(.+?)(?=\s|$)/g, (_, key, path) => {
            const keyParts = key.match(/([a-zA-Z0-9_-]+)|(\[\d+])/g); // Split keys and indices separately
            if (!keyParts) return obj;

            let target: any = lookup;
            for (const part of keyParts) {
                if (part.startsWith('[')) {
                    // Convert "[0]" to actual index
                    const index = Number(part.slice(1, -1));
                    if (!Array.isArray(target)) return obj;
                    target = target[index];
                } else {
                    target = target?.[part];
                }
                if (target === undefined) return obj;
            }

            return (
                path.split('.').reduce((acc: any, part: any) => {
                    if (acc === undefined) return undefined;
                    const arrayMatch = part.match(/^(.+?)\[(\d+)]$/);
                    if (arrayMatch) {
                        const prop = arrayMatch[1];
                        const index = Number(arrayMatch[2]);
                        return Array.isArray(acc[prop]) ? acc[prop][index] : undefined;
                    }
                    return acc[part];
                }, target) ?? obj
            );
        });
    }
    if (Array.isArray(obj)) {
        return obj.map((item) => resolvePlaceholders(item, lookup));
    }
    if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, resolvePlaceholders(value, lookup)]));
    }
    return obj;
};
