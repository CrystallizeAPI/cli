import { DownloadProject } from './actions/download-project';
import { SelectBoilerplate } from './questions/select-boilerplate';
import { SelectTenant } from './questions/select-tenant';
import { ExecuteRecipes } from './actions/execute-recipes';
import { Text } from 'ink';
import { colors } from '../../../core/styles';
import { SetupCredentials } from '../../components/setup-credentials';
import type { PimAuthenticatedUser } from '../../../domain/contracts/models/authenticated-user';
import type { PimCredentials } from '../../../domain/contracts/models/credentials';
import { Messages } from '../../components/messages';
import { Tips } from '../../components/tips';
import { Success } from '../../components/success';
import type { InstallBoilerplateStore } from './create-store';
import { useAtom } from 'jotai';
import type { CredentialRetriever } from '../../../domain/contracts/credential-retriever';
import type { CommandBus, QueryBus } from '../../../domain/contracts/bus';
import type { Logger } from '../../../domain/contracts/logger';
import type { FetchAvailableTenantIdentifier } from '../../../domain/contracts/fetch-available-tenant-identifier';

type InstallBoilerplateJourneyProps = {
    store: InstallBoilerplateStore['atoms'];
    credentialsRetriever: CredentialRetriever;
    queryBus: QueryBus;
    logger: Logger;
    commandBus: CommandBus;
    fetchAvailableTenantIdentifier: FetchAvailableTenantIdentifier;
};
export const InstallBoilerplateJourney = ({
    store,
    credentialsRetriever,
    queryBus,
    commandBus,
    logger,
    fetchAvailableTenantIdentifier,
}: InstallBoilerplateJourneyProps) => {
    const [state] = useAtom(store.stateAtom);
    const [, changeTenant] = useAtom(store.changeTenantAtom);
    const [, setCredentials] = useAtom(store.setCredentialsAtom);
    const [isWizardFullfilled] = useAtom(store.isWizardFullfilledAtom);

    const fetchTips = async () => {
        const query = queryBus.createQuery('FetchTips', {});
        const results = await queryBus.dispatch(query);
        return results.result?.tips || [];
    };
    return (
        <>
            <Text>
                Install will happen in directory: <Text color={colors.highlight}>{state.folder}</Text>
            </Text>
            <SelectBoilerplate store={store} />
            {state.boilerplate && <SelectTenant store={store} />}
            {state.boilerplate && state.tenant?.identifier && state.bootstrapTenant && !state.credentials && (
                <SetupCredentials
                    credentialsRetriever={credentialsRetriever}
                    dispatch={(_: PimAuthenticatedUser, credentials: PimCredentials) => {
                        fetchAvailableTenantIdentifier(credentials, state.tenant!.identifier).then(
                            (newIdentifier: string) => {
                                changeTenant({
                                    identifier: newIdentifier,
                                });
                                setCredentials(credentials);
                            },
                        );
                    }}
                />
            )}
            {isWizardFullfilled && <DownloadProject store={store} queryBus={queryBus} />}
            {state.isDownloaded && <ExecuteRecipes store={store} commandBus={commandBus} logger={logger} />}
            <Messages messages={state.messages} />

            {!isWizardFullfilled && <Tips fetchTips={fetchTips} />}
            {isWizardFullfilled && state.isFullfilled && <Success>{state.readme || ''}</Success>}
        </>
    );
};
