import { Box, Text } from 'ink';
import { useEffect, useState } from 'react';
import { colors } from '../../../../core/styles';
import { Spinner } from '../../../components/spinner';
import type { InstallBoilerplateStore } from '../create-store';
import { useAtom } from 'jotai';
import type { CommandBus } from '../../../../domain/contracts/bus';
import type { Logger } from '../../../../domain/contracts/logger';

const feedbacks = [
    'Fetching the dependencies...',
    'Still fetching...',
    'Unpacking...',
    'Preparing files for install...',
    'Installing...',
    'Still installing...',
    'Setting up tenant...',
    'Discovering the meaning of life...',
    'Daydreaming...',
    'Indexing...',
    'Growing that node_modules...',
    'Looking for car keys...',
    'Looking for the car...',
];

type ExecuteRecipesProps = {
    store: InstallBoilerplateStore['atoms'];
    commandBus: CommandBus;
    logger: Logger;
};
export const ExecuteRecipes = ({ store, commandBus, logger }: ExecuteRecipesProps) => {
    const [state] = useAtom(store.stateAtom);
    const [, startImport] = useAtom(store.startBoostrappingAtom);
    const [, recipesDone] = useAtom(store.recipesDoneAtom);
    const isVerbose = state.isVerbose;
    const [feedbackIndex, setFeedbackIndex] = useState<number>(0);

    useEffect(() => {
        if (!state.folder || !state.tenant) {
            return;
        }

        (async () => {
            if (state.bootstrapTenant) {
                startImport();
                const createTenantCommand = commandBus.createCommand('CreateCleanTenant', {
                    tenant: state.tenant!,
                    credentials: state.credentials!,
                    folder: state.folder!,
                });
                const tenantResult = await commandBus.dispatch(createTenantCommand);
                logger.debug('Tenant creation succeeded', tenantResult.result);
            }

            const setupBoilerplateCommand = commandBus.createCommand('SetupBoilerplateProject', {
                folder: state.folder!,
                credentials: state.credentials,
                tenant: state.tenant!,
            });
            const setupResult = await commandBus.dispatch(setupBoilerplateCommand);
            logger.debug('Setup boilerplate project succeeded:', setupResult.result);
            recipesDone(setupResult.result?.output || '');
        })();
    }, []);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        timer = setTimeout(() => {
            setFeedbackIndex((feedbackIndex + 1) % feedbacks.length);
        }, 2000);
        return () => {
            clearTimeout(timer);
        };
    }, [feedbackIndex]);

    if (state.isFullfilled) {
        return (
            <Text>
                Project has been <Text color={colors.highlight}>installed</Text>.
            </Text>
        );
    }
    return (
        <>
            <Text>
                <Spinner />
                Setting up the project for you: <Text dimColor>{feedbacks[feedbackIndex]}</Text>
            </Text>
            {state.isBoostrapping && (
                <>
                    <Text>
                        <Spinner />
                        Importing tenant data, it can take several minutes...
                    </Text>
                </>
            )}
            {isVerbose && (state.trace.logs.length > 0 || state.trace.errors.length > 0) && (
                <Box
                    borderStyle="single"
                    marginLeft={0}
                    marginRight={4}
                    marginTop={4}
                    borderColor="white"
                    flexDirection="column"
                >
                    <Text>{'Trace: '}</Text>
                    {state.trace.logs.slice(-10).map((line: string, index: number) => (
                        <Text key={`output${index}`} dimColor>
                            {line}
                        </Text>
                    ))}
                    {state.trace.errors.slice(-10).map((line: string, index: number) => (
                        <Text key={`error${index}`} dimColor color={colors.warning}>
                            {line}
                        </Text>
                    ))}
                </Box>
            )}
        </>
    );
};
