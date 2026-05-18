import path from 'node:path';
import { Box, Text } from 'ink';
import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { colors } from '../../../../core/styles';
import { Spinner } from '../../../components/spinner';
import type { CreatePluginStore } from '../create-store';
import type { CommandBus } from '../../../../domain/contracts/bus';
import type { FlySystem } from '../../../../domain/contracts/fly-system';
import type { Logger } from '../../../../domain/contracts/logger';
import { writeKeypairFiles } from '../../../../core/helpers/keypair-files';

type GenerateKeypairProps = {
    store: CreatePluginStore['atoms'];
    commandBus: CommandBus;
    flySystem: FlySystem;
    logger: Logger;
};

export const GenerateKeypair = ({ store, commandBus, flySystem, logger }: GenerateKeypairProps) => {
    const [state] = useAtom(store.stateAtom);
    const [, setKeypairGenerated] = useAtom(store.setKeypairGeneratedAtom);
    const [, setError] = useAtom(store.setErrorAtom);

    useEffect(() => {
        if (!state.folder) {
            return;
        }
        const folder = state.folder;

        (async () => {
            try {
                const command = commandBus.createCommand('GeneratePluginKeypair', {
                    bits: state.keypair.bits,
                    kid: state.keypair.kid,
                });
                const { result } = await commandBus.dispatch(command);
                if (!result) {
                    throw new Error('failed to generate RSA JWK keypair');
                }
                await writeKeypairFiles({
                    flySystem,
                    logger,
                    pair: result,
                    publicPath: path.join(folder, 'public.jwk.json'),
                    privatePath: path.join(folder, 'private.jwk.json'),
                    autoGitignore: true,
                });
                // Compact (single-line) JSON — used as literal {{public_jwk}} / {{private_jwk}} template tokens.
                setKeypairGenerated({
                    publicJwkCompact: JSON.stringify(result.publicJwk),
                    privateJwkCompact: JSON.stringify(result.privateJwk),
                });
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : String(e));
            }
        })();
    }, []);

    if (state.isKeypairGenerated) {
        return (
            <Text>
                RSA JWK keypair has been <Text color={colors.highlight}>generated</Text>: public.jwk.json &
                private.jwk.json written.
            </Text>
        );
    }

    return (
        <Box>
            <Text>
                <Spinner />
                Generating RSA JWK keypair...
            </Text>
        </Box>
    );
};
