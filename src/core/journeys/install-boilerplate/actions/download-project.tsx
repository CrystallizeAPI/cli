import { Box, Text } from 'ink';
import { useEffect } from 'react';
import { colors } from '../../../styles';
import { Spinner } from '../../../../ui/components/spinner';
import { createQuery, dispatchQuery } from '../../../di';
import type { InstallBoilerplateStore } from '../create-store';
import { useAtom } from 'jotai';

type DownloadProjectProps = {
    store: InstallBoilerplateStore['atoms'];
};
export const DownloadProject = ({ store }: DownloadProjectProps) => {
    const [state] = useAtom(store.stateAtom);
    const [, boilerplateDownloaded] = useAtom(store.setDownloadedAtom);
    const [isWizardFullfilled] = useAtom(store.isWizardFullfilledAtom);

    useEffect(() => {
        if (state.boilerplate) {
            const query = createQuery('DownloadBoilerplateArchive', {
                boilerplate: state.boilerplate,
                destination: state.folder!,
            });
            dispatchQuery(query).then(() => boilerplateDownloaded(true));
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
