import type { CommandHandlerDefinition, Envelope } from 'missive.js';
import type { FlySystem } from '../contracts/fly-system';
import type { Tenant } from '../contracts/models/tenant';
import type { PimCredentials } from '../contracts/models/credentials';
import type { Logger } from '../contracts/logger';
import type { Runner } from '../../core/create-runner';
import type { InstallBoilerplateStore } from '../../ui/journeys/install-boilerplate/create-store';
import type { CredentialRetriever } from '../contracts/credential-retriever';

type Deps = {
    flySystem: FlySystem;
    logger: Logger;
    runner: Runner;
    installBoilerplateCommandStore: InstallBoilerplateStore;
    credentialsRetriever: CredentialRetriever;
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
    const { flySystem, logger, runner, installBoilerplateCommandStore } = deps;
    const { folder, tenant, credentials } = envelope.message;
    const { storage, atoms } = installBoilerplateCommandStore;
    const addTraceLog = (log: string) => storage.set(atoms.addTraceLogAtom, log);
    const addTraceError = (log: string) => storage.set(atoms.addTraceErrorAtom, log);

    const finalCredentials = credentials || (await deps.credentialsRetriever.getCredentials());

    logger.log(`Setting up boilerplate project in ${folder} for tenant ${tenant.identifier}`);
    if (await flySystem.isFileExists(`${folder}/provisioning/clone/.env.dist`)) {
        try {
            await flySystem.replaceInFile(`${folder}/provisioning/clone/.env.dist`, [
                {
                    search: '##STOREFRONT_IDENTIFIER##',
                    replace: `storefront-${tenant.identifier}`,
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
            ]);
        } catch (e) {
            logger.warn(`Could not replace values in provisioning/clone/.env.dist file from the boilerplate.`);
        }
    } else {
        logger.warn(`Could not find provisioning/clone/.env.dist file from the boilerplate.`);
    }

    let readme = 'cd appplication && npm run dev';
    if (await flySystem.isFileExists(`${folder}/provisioning/clone/success.md`)) {
        try {
            readme = await flySystem.loadFile(`${folder}/provisioning/clone/success.md`);
        } catch (e) {
            logger.warn(
                `Could not load provisioning/clone/success.md file from the boilerplate. Using default readme.`,
            );
            readme = 'cd appplication && npm run dev';
        }
    }
    logger.debug(`> .env.dist replaced.`);
    await runner(
        ['bash', `${folder}/provisioning/clone/setup.bash`],
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
