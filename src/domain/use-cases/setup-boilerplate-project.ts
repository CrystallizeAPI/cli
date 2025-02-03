import type { CommandHandlerDefinition, Envelope } from 'missive.js';
import type { FlySystem } from '../contracts/fly-system';
import type { Tenant } from '../contracts/models/tenant';
import type { PimCredentials } from '../contracts/models/credentials';
import type { Logger } from '../contracts/logger';
import type { Runner } from '../../core/create-runner';
import type { InstallBoilerplateStore } from '../../ui/journeys/install-boilerplate/create-store';
import type { CredentialRetriever } from '../contracts/credential-retriever';
import type { createClient } from '@crystallize/js-api-client';

type Deps = {
    flySystem: FlySystem;
    logger: Logger;
    runner: Runner;
    installBoilerplateCommandStore: InstallBoilerplateStore;
    credentialsRetriever: CredentialRetriever;
    createCrystallizeClient: typeof createClient;
};

type Command = {
    folder: string;
    tenant: Tenant;
    credentials?: PimCredentials;
};

export type SetupBoilerplateProjectHandlerDefinition = CommandHandlerDefinition<
    'SetupBoilerplateProject',
    Command,
    Awaited<ReturnType<typeof handler>>
>;

const handler = async (envelope: Envelope<Command>, deps: Deps) => {
    const { flySystem, logger, runner, installBoilerplateCommandStore, createCrystallizeClient } = deps;
    const { folder, tenant, credentials } = envelope.message;
    const { storage, atoms } = installBoilerplateCommandStore;

    const crytallizeHiddenFolder = `${folder}/.crystallize`;

    const addTraceLog = (log: string) => storage.set(atoms.addTraceLogAtom, log);
    const addTraceError = (log: string) => storage.set(atoms.addTraceErrorAtom, log);

    const finalCredentials = credentials || (await deps.credentialsRetriever.getCredentials());

    logger.log(`Setting up boilerplate project in ${folder} for tenant ${tenant.identifier}`);
    const apiClient = createCrystallizeClient({
        tenantIdentifier: tenant.identifier,
        accessTokenId: finalCredentials?.ACCESS_TOKEN_ID,
        accessTokenSecret: finalCredentials?.ACCESS_TOKEN_SECRET,
    });

    // let's get the Tenant Id
    const tenantInfo = await apiClient.nextPimApi(
        `query { tenant(identifier:"${tenant.identifier}") { ... on Tenant { id } } }`,
    );
    const tenantId = tenantInfo.tenant.id;

    if (await flySystem.isFileExists(`${crytallizeHiddenFolder}/env`)) {
        try {
            await flySystem.replaceInFile(`${crytallizeHiddenFolder}/env`, [
                {
                    search: '##STOREFRONT_IDENTIFIER##',
                    replace: `storefront-${tenant.identifier}`,
                },
                {
                    search: '##CRYSTALLIZE_TENANT_ID##',
                    replace: tenantId,
                },
                {
                    search: '##CRYSTALLIZE_TENANT_IDENTIFIER##',
                    replace: tenant.identifier,
                },
                {
                    search: '##CRYSTALLIZE_ACCESS_TOKEN_ID##',
                    replace: finalCredentials?.ACCESS_TOKEN_ID || '',
                },
                {
                    search: '##CRYSTALLIZE_ACCESS_TOKEN_SECRET##',
                    replace: finalCredentials?.ACCESS_TOKEN_SECRET || '',
                },
                {
                    search: '##JWT_SECRET##',
                    replace: crypto.randomUUID(),
                },
                {
                    search: '##AUTH_SECRET##',
                    replace: crypto.randomUUID(),
                },
            ]);
        } catch (e) {
            logger.warn(`Could not replace values in env file from the boilerplate.`);
        }
    } else {
        logger.warn(`Could not find env file from the boilerplate.`);
    }

    let readme = 'npm run dev';
    if (await flySystem.isFileExists(`${crytallizeHiddenFolder}/success.md`)) {
        try {
            readme = await flySystem.loadFile(`${crytallizeHiddenFolder}/success.md`);
        } catch (e) {
            logger.warn(`Could not load success.md file from the boilerplate. Using default readme.`);
        }
    }
    await runner(
        ['bash', `${crytallizeHiddenFolder}/setup.bash`],
        (data) => {
            logger.debug(data.toString());
            addTraceLog(data.toString());
        },
        (error) => {
            logger.error(error.toString());
            addTraceError(error.toString());
        },
    );
    return {
        output: readme,
    };
};

export const createSetupBoilerplateProjectHandler = (deps: Deps) => (command: Envelope<Command>) =>
    handler(command, deps);
