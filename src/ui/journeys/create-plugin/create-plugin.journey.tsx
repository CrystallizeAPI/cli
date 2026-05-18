import { Text } from 'ink';
import { useAtom } from 'jotai';
import { colors } from '../../../core/styles';
import { Messages } from '../../components/messages';
import { Success } from '../../components/success';
import { SelectSkeleton } from './questions/select-skeleton';
import { CollectPluginInfo } from './questions/collect-plugin-info';
import { KeypairSettingsQuestion } from './questions/keypair-settings';
import { DownloadSkeleton } from './actions/download-skeleton';
import { GenerateKeypair } from './actions/generate-keypair';
import { ReplaceTokens } from './actions/replace-tokens';
import { InstallDependencies } from './actions/install-dependencies';
import type { CreatePluginStore } from './create-store';
import type { CommandBus, QueryBus } from '../../../domain/contracts/bus';
import type { FlySystem } from '../../../domain/contracts/fly-system';
import type { Logger } from '../../../domain/contracts/logger';

type CreatePluginJourneyProps = {
    store: CreatePluginStore['atoms'];
    queryBus: QueryBus;
    commandBus: CommandBus;
    flySystem: FlySystem;
    logger: Logger;
};

export const CreatePluginJourney = ({ store, queryBus, commandBus, flySystem, logger }: CreatePluginJourneyProps) => {
    const [state] = useAtom(store.stateAtom);
    const [isWizardFullfilled] = useAtom(store.isWizardFullfilledAtom);

    if (state.error) {
        return (
            <>
                <Text color={colors.error}>Plugin scaffolding failed: {state.error}</Text>
                <Text dimColor>
                    The folder <Text color={colors.warning}>{state.folder ?? '(unknown location)'}</Text> was left in
                    place for inspection.
                </Text>
            </>
        );
    }

    return (
        <>
            <Text>
                Creating plugin in: <Text color={colors.highlight}>{state.folder ?? '…'}</Text>
            </Text>
            <SelectSkeleton store={store} />
            {state.skeleton && <CollectPluginInfo store={store} />}
            {state.skeleton && state.info && <KeypairSettingsQuestion store={store} />}
            {isWizardFullfilled && state.isKeypairConfigured && <DownloadSkeleton store={store} queryBus={queryBus} />}
            {state.isDownloaded && (
                <GenerateKeypair store={store} commandBus={commandBus} flySystem={flySystem} logger={logger} />
            )}
            {state.isKeypairGenerated && <ReplaceTokens store={store} commandBus={commandBus} />}
            {state.isTokensReplaced && <InstallDependencies store={store} commandBus={commandBus} />}
            <Messages messages={state.messages} />
            {state.isFullfilled && (
                <Success>{`## Plugin "${state.info?.name}" is ready!\n\nYour plugin has been scaffolded in \`${state.folder}\`.\n\n> **Keep \`private.jwk.json\` secret** — it is gitignored and must never be committed or shared.\n\n### Next steps\n\n- Register the plugin revision in Crystallize using the generated \`public.jwk.json\`.\n- Test payload decryption locally with \`crystallize plugin decrypt-payload\`.\n- See the Crystallize plugins docs at https://crystallize.com/learn/concepts/plugins\n`}</Success>
            )}
        </>
    );
};
