import type { QueryBus as MissiveQueryBus, CommandBus as MissiveCommandBus } from 'missive.js';
import type { CreateCleanTenantHandlerDefinition } from '../use-cases/create-clean-tenant';
import type { DownloadBoilerplateArchiveHandlerDefinition } from '../use-cases/download-boilerplate-archive';
import type { FetchTipsHandlerDefinition } from '../use-cases/fetch-tips';
import type { SetupBoilerplateProjectHandlerDefinition } from '../use-cases/setup-boilerplate-project';
import type { RunMassOperationHandlerDefinition } from '../use-cases/run-mass-operation';
import type { CreateTenantInviteTokenHandlerDefinition } from '../use-cases/create-invite-token';

export type QueryDefinitions = DownloadBoilerplateArchiveHandlerDefinition & FetchTipsHandlerDefinition;
export type QueryBus = MissiveQueryBus<QueryDefinitions>;

export type CommandDefinitions = CreateCleanTenantHandlerDefinition &
    SetupBoilerplateProjectHandlerDefinition &
    RunMassOperationHandlerDefinition &
    CreateTenantInviteTokenHandlerDefinition;
export type CommandBus = MissiveCommandBus<CommandDefinitions>;
