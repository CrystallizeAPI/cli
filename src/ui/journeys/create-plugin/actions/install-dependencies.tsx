import { Box, Text } from 'ink';
import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { colors } from '../../../../core/styles';
import { Spinner } from '../../../components/spinner';
import type { CreatePluginStore } from '../create-store';
import type { CommandBus } from '../../../../domain/contracts/bus';

type InstallDependenciesProps = {
    store: CreatePluginStore['atoms'];
    commandBus: CommandBus;
};

export const InstallDependencies = ({ store, commandBus }: InstallDependenciesProps) => {
    const [state] = useAtom(store.stateAtom);
    const [, setInstalled] = useAtom(store.setInstalledAtom);
    const [, setError] = useAtom(store.setErrorAtom);

    useEffect(() => {
        if (!state.folder) {
            return;
        }
        if (state.skipInstall) {
            setInstalled();
            return;
        }
        const command = commandBus.createCommand('InstallPluginDependencies', {
            folder: state.folder,
        });
        commandBus
            .dispatch(command)
            .then(() => setInstalled())
            .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    }, []);

    if (state.isInstalled) {
        return (
            <Text>
                Dependencies have been{' '}
                <Text color={colors.highlight}>{state.skipInstall ? 'skipped' : 'installed'}</Text>.
            </Text>
        );
    }

    return (
        <Box>
            <Text>
                <Spinner />
                Installing dependencies (this can take a moment)...
            </Text>
        </Box>
    );
};
