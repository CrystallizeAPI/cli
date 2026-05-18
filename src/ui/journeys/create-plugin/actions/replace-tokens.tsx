import { Box, Text } from 'ink';
import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { colors } from '../../../../core/styles';
import { Spinner } from '../../../components/spinner';
import type { CreatePluginStore } from '../create-store';
import type { CommandBus } from '../../../../domain/contracts/bus';

type ReplaceTokensProps = {
    store: CreatePluginStore['atoms'];
    commandBus: CommandBus;
};

export const ReplaceTokens = ({ store, commandBus }: ReplaceTokensProps) => {
    const [state] = useAtom(store.stateAtom);
    const [, setTokensReplaced] = useAtom(store.setTokensReplacedAtom);
    const [, setError] = useAtom(store.setErrorAtom);

    useEffect(() => {
        if (state.isTokensReplaced) {
            return;
        }
        if (!state.folder || !state.info || !state.publicJwkCompact || !state.privateJwkCompact) {
            return;
        }
        const command = commandBus.createCommand('ReplacePluginTokens', {
            folder: state.folder,
            tokens: {
                '{{plugin_name}}': state.info.name,
                '{{plugin_identifier}}': state.info.identifier,
                '{{author_name}}': state.info.author,
                '{{vendor_url}}': state.info.vendorUrl,
                '{{public_jwk}}': state.publicJwkCompact,
                '{{private_jwk}}': state.privateJwkCompact,
                '{{kid}}': state.keypair.kid,
            },
        });
        commandBus
            .dispatch(command)
            .then(() => setTokensReplaced(true))
            .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    }, [state.publicJwkCompact]);

    if (state.isTokensReplaced) {
        return (
            <Text>
                Project files have been <Text color={colors.highlight}>personalized</Text>.
            </Text>
        );
    }

    return (
        <Box>
            <Text>
                <Spinner />
                Personalizing the project...
            </Text>
        </Box>
    );
};
