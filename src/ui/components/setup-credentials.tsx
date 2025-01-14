import { useEffect, useState } from 'react';
import { Text, Box, Newline } from 'ink';
import { Select } from './select';
import { UncontrolledTextInput } from 'ink-text-input';
import React from 'react';
import type { PimAuthenticatedUser } from '../../domain/contracts/models/authenticated-user';
import type { PimCredentials } from '../../domain/contracts/models/credentials';
import { colors } from '../../core/styles';
import type { CredentialRetriever } from '../../domain/contracts/credential-retriever';

type YesOrNo = 'yes' | 'no';
type UseExistingCredentials = YesOrNo | 'remove';
type SaveCredentials = YesOrNo;

type SetupCredentialsProps = {
    dispatch: (authenticatedUser: PimAuthenticatedUser, credentials: PimCredentials) => void;
    credentialsRetriever: CredentialRetriever;
};
export const SetupCredentials = ({ dispatch, credentialsRetriever }: SetupCredentialsProps) => {
    const [user, setUser] = useState<PimAuthenticatedUser | null>(null);
    const [credentials, setCredentials] = useState<PimCredentials>();
    const [askForInput, setAskForInput] = useState(false);
    const [askForSaving, setAskForSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const credentials = await credentialsRetriever.getCredentials();
                setCredentials(credentials);
            } catch {
                setAskForInput(true);
                return;
            }
        })();
    }, []);

    useEffect(() => {
        if (!credentials || user) {
            return;
        }
        (async () => {
            const authicatedUser = await credentialsRetriever.checkCredentials(credentials);
            if (!authicatedUser) {
                setAskForInput(true);
                return;
            }
            setUser(authicatedUser);
        })();
    }, [credentials]);

    if (user && !askForInput && !askForSaving) {
        return (
            <ShouldWeUsedExistingTokenQuestion
                user={user}
                onAnswer={(answer: UseExistingCredentials) => {
                    switch (answer) {
                        case 'remove':
                            credentialsRetriever.removeCredentials();
                            setAskForInput(true);
                            setUser(null);
                            break;
                        case 'no':
                            setAskForInput(true);
                            setUser(null);
                            break;
                        case 'yes':
                            dispatch(user, credentials!);
                            return;
                    }
                }}
            />
        );
    }

    if (askForInput) {
        return (
            <AskForCredentials
                credentialsRetriever={credentialsRetriever}
                onValidCredentials={(credentials: PimCredentials, user: PimAuthenticatedUser) => {
                    setCredentials(credentials);
                    setUser(user);
                    setAskForSaving(true);
                    setAskForInput(false);
                }}
            />
        );
    }

    if (askForSaving) {
        return (
            <AskToSaveCredentials
                credentialsRetriever={credentialsRetriever}
                credentials={credentials!}
                user={user!}
                onAnswered={() => {
                    dispatch(user!, credentials!);
                }}
            />
        );
    }

    return <Text dimColor>Verifying Crystallize Access Tokens...</Text>;
};

const ShouldWeUsedExistingTokenQuestion: React.FC<{
    user: PimAuthenticatedUser;
    onAnswer: (answer: UseExistingCredentials) => void;
}> = ({ onAnswer, user }) => {
    return (
        <Box flexDirection="column">
            <Text>
                Hello{' '}
                <Text color={colors.highlight}>
                    {user.firstName} {user.lastName}
                </Text>{' '}
                <Text dimColor color={colors.highlight}>
                    ({user.email})
                </Text>
            </Text>
            <Text>We found existing valid Crystallize Access Tokens. Want to use it?</Text>
            <Select<UseExistingCredentials>
                styles={{ compact: true }}
                onSelect={onAnswer}
                options={[
                    {
                        value: 'yes',
                        label: 'Yes',
                    },
                    {
                        value: 'no',
                        label: 'No',
                    },
                    {
                        value: 'remove',
                        label: 'Wait, what? Remove the stored access tokens please',
                    },
                ]}
            />
        </Box>
    );
};

const AskForCredentials: React.FC<{
    onValidCredentials: (credentials: PimCredentials, user: PimAuthenticatedUser) => void;
    credentialsRetriever: CredentialRetriever;
}> = ({ onValidCredentials, credentialsRetriever }) => {
    const [inputCredentials, setInputCredentials] = useState<Partial<PimCredentials>>();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!inputCredentials?.ACCESS_TOKEN_SECRET) {
            return;
        }
        (async () => {
            const authenticatedUser = await credentialsRetriever.checkCredentials({
                ACCESS_TOKEN_ID: inputCredentials?.ACCESS_TOKEN_ID || '',
                ACCESS_TOKEN_SECRET: inputCredentials?.ACCESS_TOKEN_SECRET || '',
            });
            if (!authenticatedUser) {
                setError('⚠️ Invalid tokens supplied. Please try again ⚠️');
                setInputCredentials({});
                return;
            }
            onValidCredentials(inputCredentials as PimCredentials, authenticatedUser);
        })();
    }, [inputCredentials]);

    const isLoading = !!inputCredentials?.ACCESS_TOKEN_ID && !!inputCredentials?.ACCESS_TOKEN_SECRET;

    return (
        <>
            <Box flexDirection="column" marginBottom={1}>
                <Text>
                    Please provide Access Tokens to bootstrap the tenant
                    <Newline />
                    <Text dimColor>
                        Learn about access tokens: https://crystallize.com/learn/developer-guides/access-tokens
                    </Text>
                </Text>
            </Box>
            {error && (
                <Box flexDirection="column" marginBottom={1}>
                    <Text color={colors.highlight}>{error}</Text>
                </Box>
            )}
            <Box flexDirection="column">
                {!isLoading && !inputCredentials?.ACCESS_TOKEN_ID && (
                    <>
                        <Text>Access Token ID: </Text>
                        <UncontrolledTextInput
                            key="access-token-id"
                            placeholder="access-token-id"
                            mask="*"
                            onSubmit={(value: string) =>
                                setInputCredentials({
                                    ACCESS_TOKEN_ID: value,
                                })
                            }
                        />
                    </>
                )}
                {!isLoading && inputCredentials?.ACCESS_TOKEN_ID && !inputCredentials?.ACCESS_TOKEN_SECRET && (
                    <>
                        <Text>
                            Access Token ID: <Text dimColor>***</Text>
                        </Text>
                        <Text>Access Token Secret: </Text>
                        <UncontrolledTextInput
                            key="access-token-secret"
                            placeholder="access-token-secret"
                            mask="*"
                            onSubmit={(value: string) =>
                                setInputCredentials({
                                    ...inputCredentials,
                                    ACCESS_TOKEN_SECRET: value,
                                })
                            }
                        />
                    </>
                )}
                {isLoading && <Text>Verifying Crystallize Access Tokens...</Text>}
            </Box>
        </>
    );
};

const AskToSaveCredentials: React.FC<{
    credentials: PimCredentials;
    user: PimAuthenticatedUser;
    credentialsRetriever: CredentialRetriever;
    onAnswered: () => void;
}> = ({ credentials, user, onAnswered, credentialsRetriever }) => {
    return (
        <Box flexDirection="column">
            <Text>
                Hello {user.firstName} {user.lastName} ({user.email})
            </Text>
            <Text>Would you like to save the access tokens for future use?</Text>
            <Select<SaveCredentials>
                styles={{ compact: true }}
                onSelect={(answer) => {
                    if (answer === 'yes') {
                        credentialsRetriever.saveCredentials(credentials);
                    }
                    onAnswered();
                }}
                options={[
                    {
                        value: 'yes',
                        label: 'Yes, please',
                    },
                    {
                        value: 'no',
                        label: 'No, thanks',
                    },
                ]}
            />
        </Box>
    );
};
