import { asFunction, asValue, createContainer, InjectionMode } from 'awilix';
import type { Logger } from '../domain/contracts/logger';
import { createCommandBus, createQueryBus, type LoggerInterface } from 'missive.js';
import type { CommandBus, CommandDefinitions, QueryBus, QueryDefinitions } from '../domain/contracts/bus';
import { createInstallBoilerplateCommand } from '../command/install-boilerplate';
import type { Command } from 'commander';
import { createLogger } from './create-logger';
import type { FlySystem } from '../domain/contracts/fly-system';
import { createFlySystem } from './create-flysystem';
import { createCreateCleanTenantHandler } from '../domain/use-cases/create-clean-tenant';
import { createDownloadBoilerplateArchiveHandler } from '../domain/use-cases/download-boilerplate-archive';
import { createFetchTipsHandler } from '../domain/use-cases/fetch-tips';
import { createCredentialsRetriever } from './create-credentials-retriever';
import type { CredentialRetriever } from '../domain/contracts/credential-retriever';
import { createSetupBoilerplateProjectHandler } from '../domain/use-cases/setup-boilerplate-project';
import { createInstallBoilerplateCommandStore } from './journeys/install-boilerplate/create-store';
import { createRunner } from './create-runner';
import { createLoginCommand } from '../command/login';
import { createWhoAmICommand } from '../command/whoami';
import { createS3Uploader } from './create-s3-uploader';
import os from 'os';
import { createRunMassOperationHandler } from '../domain/use-cases/run-mass-operation';
import { createRunMassOperationCommand } from '../command/run-mass-operation';
import type { createClient } from '@crystallize/js-api-client';
import { createCrystallizeClientBuilder } from './create-crystallize-client-builder';

export const buildServices = () => {
    const logLevels = (
        `${Bun.env.LOG_LEVELS}` === 'no-output' ? [] : ['info', ...`${Bun.env.LOG_LEVELS}`.split(',')]
    ) as ('info' | 'debug')[];
    const crystallizeEnvironment = `${Bun.env.CRYSTALLIZE_ENVIRONMENT}` === 'staging' ? 'staging' : 'production';
    const logger = createLogger('cli', logLevels);
    const container = createContainer<{
        logLevels: ('info' | 'debug')[];
        crystallizeEnvironment: 'staging' | 'production';
        logger: Logger;
        queryBus: QueryBus;
        commandBus: CommandBus;
        flySystem: FlySystem;
        credentialsRetriever: CredentialRetriever;
        createCrystallizeClient: typeof createClient;
        runner: ReturnType<typeof createRunner>;
        s3Uploader: ReturnType<typeof createS3Uploader>;
        // use cases
        createCleanTenant: ReturnType<typeof createCreateCleanTenantHandler>;
        downloadBoilerplateArchive: ReturnType<typeof createDownloadBoilerplateArchiveHandler>;
        fetchTips: ReturnType<typeof createFetchTipsHandler>;
        setupBoilerplateProject: ReturnType<typeof createSetupBoilerplateProjectHandler>;
        runMassOperation: ReturnType<typeof createRunMassOperationHandler>;
        // stores
        installBoilerplateCommandStore: ReturnType<typeof createInstallBoilerplateCommandStore>;
        // commands
        installBoilerplateCommand: Command;
        loginCommand: Command;
        whoAmICommand: Command;
        runMassOperationCommand: Command;
    }>({
        injectionMode: InjectionMode.PROXY,
        strict: true,
    });
    container.register({
        logLevels: asValue(logLevels),
        crystallizeEnvironment: asValue(crystallizeEnvironment),
        logger: asValue(logger),
        queryBus: asFunction(() => createQueryBus<QueryDefinitions>()).singleton(),
        commandBus: asFunction(() => createCommandBus<CommandDefinitions>()).singleton(),
        flySystem: asFunction(createFlySystem).singleton(),
        credentialsRetriever: asFunction(createCredentialsRetriever)
            .inject(() => ({
                fallbackFile: `${os.homedir()}/.crystallize/credentials${crystallizeEnvironment !== 'production' ? '-' + crystallizeEnvironment : ''}.json`,
                options: undefined,
            }))
            .singleton(),
        createCrystallizeClient: asFunction(createCrystallizeClientBuilder).singleton(),
        runner: asFunction(createRunner).singleton(),
        s3Uploader: asFunction(createS3Uploader).singleton(),

        // Use Cases
        createCleanTenant: asFunction(createCreateCleanTenantHandler).singleton(),
        downloadBoilerplateArchive: asFunction(createDownloadBoilerplateArchiveHandler).singleton(),
        fetchTips: asFunction(createFetchTipsHandler).singleton(),
        setupBoilerplateProject: asFunction(createSetupBoilerplateProjectHandler).singleton(),
        runMassOperation: asFunction(createRunMassOperationHandler).singleton(),
        // Stores
        installBoilerplateCommandStore: asFunction(createInstallBoilerplateCommandStore).singleton(),

        // Commands
        installBoilerplateCommand: asFunction(createInstallBoilerplateCommand).singleton(),
        loginCommand: asFunction(createLoginCommand).singleton(),
        whoAmICommand: asFunction(createWhoAmICommand).singleton(),
        runMassOperationCommand: asFunction(createRunMassOperationCommand).singleton(),
    });
    container.cradle.commandBus.register('CreateCleanTenant', container.cradle.createCleanTenant);
    container.cradle.queryBus.register('DownloadBoilerplateArchive', container.cradle.downloadBoilerplateArchive);
    container.cradle.queryBus.register('FetchTips', container.cradle.fetchTips);
    container.cradle.commandBus.register('SetupBoilerplateProject', container.cradle.setupBoilerplateProject);
    container.cradle.commandBus.register('RunMassOperation', container.cradle.runMassOperation);

    const proxyLogger: LoggerInterface = {
        log: (...args) => logger.debug(...args),
        error: (...args) => logger.debug(...args),
    };
    container.cradle.queryBus.useLoggerMiddleware({ logger: proxyLogger });
    container.cradle.commandBus.useLoggerMiddleware({ logger: proxyLogger });
    return {
        logger,
        createCommand: container.cradle.commandBus.createCommand,
        dispatchCommand: container.cradle.commandBus.dispatch,
        createQuery: container.cradle.queryBus.createQuery,
        dispatchQuery: container.cradle.queryBus.dispatch,
        runner: container.cradle.runner,
        commands: [
            container.cradle.installBoilerplateCommand,
            container.cradle.loginCommand,
            container.cradle.whoAmICommand,
            container.cradle.runMassOperationCommand,
        ],
    };
};
