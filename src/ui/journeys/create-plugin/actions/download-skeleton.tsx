import { Box, Text } from 'ink';
import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { colors } from '../../../../core/styles';
import { Spinner } from '../../../components/spinner';
import type { CreatePluginStore } from '../create-store';
import type { QueryBus } from '../../../../domain/contracts/bus';

type DownloadSkeletonProps = {
    store: CreatePluginStore['atoms'];
    queryBus: QueryBus;
};

export const DownloadSkeleton = ({ store, queryBus }: DownloadSkeletonProps) => {
    const [state] = useAtom(store.stateAtom);
    const [, setDownloaded] = useAtom(store.setDownloadedAtom);
    const [, setError] = useAtom(store.setErrorAtom);

    useEffect(() => {
        if (state.skeleton && state.folder) {
            const query = queryBus.createQuery('DownloadPluginSkeletonArchive', {
                skeleton: state.skeleton,
                destination: state.folder,
            });
            queryBus
                .dispatch(query)
                .then(() => setDownloaded(true))
                .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
        }
    }, []);

    if (!state.skeleton || !state.folder) {
        return null;
    }

    if (state.isDownloaded) {
        return (
            <Text>
                The plugin skeleton has been successfully <Text color={colors.highlight}>downloaded</Text>.
            </Text>
        );
    }

    return (
        <Box>
            <Text>
                <Spinner />
                Downloading the {state.skeleton.name} skeleton...
            </Text>
        </Box>
    );
};
