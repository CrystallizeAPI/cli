import { Box, Text } from 'ink';
import { useEffect } from 'react';
import { colors } from '../../../../core/styles';
import { Spinner } from '../../../components/spinner';
import type { InstallBoilerplateStore } from '../create-store';
import { useAtom } from 'jotai';
import type { QueryBus } from '../../../../domain/contracts/bus';

type DownloadProjectProps = {
    store: InstallBoilerplateStore['atoms'];
    queryBus: QueryBus;
};
export const DownloadProject = ({ store, queryBus }: DownloadProjectProps) => {
    const [state] = useAtom(store.stateAtom);
    const [, boilerplateDownloaded] = useAtom(store.setDownloadedAtom);
    const [isWizardFullfilled] = useAtom(store.isWizardFullfilledAtom);

    useEffect(() => {
        if (state.boilerplate) {
            const query = queryBus.createQuery('DownloadBoilerplateArchive', {
                boilerplate: state.boilerplate,
                destination: state.folder!,
            });
            queryBus.dispatch(query).then(() => boilerplateDownloaded(true));
        }
    }, []);

    if (state.isDownloaded) {
        return (
            <Text>
                The boilerplate has been successfully <Text color={colors.highlight}>downloaded</Text>.
            </Text>
        );
    }

    if (!isWizardFullfilled) {
        return null;
    }

    return (
        <>
            <Box>
                <Text>
                    <Spinner />
                    Downloading the {state.boilerplate!.name} boilerplate...
                </Text>
            </Box>
        </>
    );
};
