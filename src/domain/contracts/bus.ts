import type { QueryBus as MissiveQueryBus, CommandBus as MissiveCommandBus } from 'missive.js';
import type { CreateCleanTenantHandlerDefinition } from '../use-cases/create-clean-tenant';
import type { DownloadBoilerplateArchiveHandlerDefinition } from '../use-cases/download-boilerplate-archive';
import type { FetchTipsHandlerDefinition } from '../use-cases/fetch-tips';
import type { SetupBoilerplateProjectHandlerDefinition } from '../use-cases/setup-boilerplate-project';
import type { RunMassOperationHandlerDefinition } from '../use-cases/run-mass-operation';
import type { CreateTenantInviteTokenHandlerDefinition } from '../use-cases/create-invite-token';
import type { GetStaticAuthTokenHandlerDefinition } from '../use-cases/get-static-token';
import type { GetShopAuthTokenHandlerDefinition } from '../use-cases/get-shop-token';
import type { CreateContentModelMassOperationFileHandlerDefinition } from '../use-cases/create-content-model-mass-operation';

export type QueryDefinitions = DownloadBoilerplateArchiveHandlerDefinition &
    FetchTipsHandlerDefinition &
    GetStaticAuthTokenHandlerDefinition &
    GetShopAuthTokenHandlerDefinition &
    CreateContentModelMassOperationFileHandlerDefinition;

export type QueryBus = MissiveQueryBus<QueryDefinitions>;

export type CommandDefinitions = CreateCleanTenantHandlerDefinition &
    SetupBoilerplateProjectHandlerDefinition &
    RunMassOperationHandlerDefinition &
    CreateTenantInviteTokenHandlerDefinition;
export type CommandBus = MissiveCommandBus<CommandDefinitions>;
