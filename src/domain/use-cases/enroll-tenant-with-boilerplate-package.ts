import type { Envelope, CommandHandlerDefinition } from 'missive.js';
import type { Boilerplate } from '../contracts/models/boilerplate';
import type { PimCredentials } from '../contracts/models/credentials';
import type { Logger } from '../contracts/logger';
import type { TenantEnrollerBuilder } from '../contracts/tenant-enroller';
import os from 'os';
import type { FlySystem } from '../contracts/fly-system';
import type { FeedbackPiper } from '../contracts/feedback-piper';

type Deps = {
    logger: Logger;
    tenantEnrollerBuilder: TenantEnrollerBuilder;
    flySystem: FlySystem;
    feedbackPiper: FeedbackPiper;
};
type Command = {
    boilerplate: Boilerplate;
    credentials: PimCredentials;
    tenantIdentifier: string;
    doIgnite?: boolean;
};

export type EnrollTenantWithBoilerplatePackageHandlerDefinition = CommandHandlerDefinition<
    'EnrollTenantWithBoilerplatePackage',
    Command,
    Awaited<ReturnType<typeof handler>>
>;

const handler = async (envelope: Envelope<Command>, deps: Deps) => {
    const { boilerplate, tenantIdentifier, credentials, doIgnite } = envelope.message;
    const { tenantEnrollerBuilder, logger, flySystem, feedbackPiper } = deps;
    const uniquId = Math.random().toString(36).substring(7);
    const folder = os.tmpdir() + `/crystallize-boilerplate-${uniquId}`;
    await flySystem.createDirectoryOrFail(folder, 'Failed to create temporary directory for boilerplate enrollment.');
    const enroller = await tenantEnrollerBuilder(
        {
            tenant: {
                identifier: tenantIdentifier,
            },
            credentials,
            folder,
        },
        {
            addTraceLog: (log: string) => {
                logger.info(log);
                feedbackPiper.info(log);
            },
            addTraceError: (log: string) => {
                logger.error(log);
                feedbackPiper.error(log);
            },
        },
    );

    await enroller.downloadArchive(boilerplate);
    await enroller.runOperations();
    const mapping = await enroller.uploadAssets();
    await enroller.executeMutations(mapping);
    if (doIgnite) {
        await enroller.ignite();
    }
    return {
        folder,
    };
};

export const createEnrollTenantWithBoilerplatePackageHandler = (deps: Deps) => (command: Envelope<Command>) =>
    handler(command, deps);
