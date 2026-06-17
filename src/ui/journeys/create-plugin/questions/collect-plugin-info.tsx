import { Box, Text } from 'ink';
import { UncontrolledTextInput } from 'ink-text-input';
import { useState } from 'react';
import { useAtom } from 'jotai';
import { colors } from '../../../../core/styles';
import { deriveReverseDns, isValidReverseDns, REVERSE_DNS_HINT } from '../../../../core/helpers/plugin-identifier';
import { DEFAULT_PLUGIN_URL, type CreatePluginStore, type PluginInfo } from '../create-store';

type CollectPluginInfoProps = {
    store: CreatePluginStore['atoms'];
};

type Field = 'name' | 'identifier' | 'author' | 'pluginUrl';

export const CollectPluginInfo = ({ store }: CollectPluginInfoProps) => {
    const [state] = useAtom(store.stateAtom);
    const [, setInfo] = useAtom(store.setInfoAtom);

    const [name, setName] = useState('');
    const [identifier, setIdentifier] = useState('');
    const [author, setAuthor] = useState('');
    const [currentField, setCurrentField] = useState<Field>('name');
    const [identifierError, setIdentifierError] = useState<string>();

    if (state.info) {
        return (
            <Text>
                Plugin: <Text color={colors.highlight}>{state.info.name}</Text> (
                <Text color={colors.highlight}>{state.info.identifier}</Text>) by{' '}
                <Text color={colors.highlight}>{state.info.author}</Text> — {state.info.pluginUrl}
            </Text>
        );
    }

    const derivedIdentifier = deriveReverseDns(name);

    const handleSubmit = (value: string) => {
        if (currentField === 'name') {
            setName(value);
            setCurrentField('identifier');
        } else if (currentField === 'identifier') {
            const candidate = value.trim() || derivedIdentifier;
            if (!isValidReverseDns(candidate)) {
                setIdentifierError(`"${value.trim()}" is not valid — use ${REVERSE_DNS_HINT}.`);
                return;
            }
            setIdentifierError(undefined);
            setIdentifier(candidate);
            setCurrentField('author');
        } else if (currentField === 'author') {
            setAuthor(value);
            setCurrentField('pluginUrl');
        } else if (currentField === 'pluginUrl') {
            const finalInfo: PluginInfo = {
                name,
                identifier,
                author,
                pluginUrl: value.trim() || DEFAULT_PLUGIN_URL,
            };
            setInfo(finalInfo);
        }
    };

    const fieldLabel = (): string => {
        if (currentField === 'name') return 'Plugin name:';
        if (currentField === 'identifier') return `Identifier (${REVERSE_DNS_HINT}, default "${derivedIdentifier}"):`;
        if (currentField === 'author') return 'Author:';
        return `Plugin URL (default "${DEFAULT_PLUGIN_URL}"):`;
    };

    return (
        <Box flexDirection="column">
            {name && (
                <Text dimColor>
                    Name: <Text color={colors.highlight}>{name}</Text>
                </Text>
            )}
            {identifier && currentField !== 'identifier' && (
                <Text dimColor>
                    Identifier: <Text color={colors.highlight}>{identifier}</Text>
                </Text>
            )}
            {author && currentField === 'pluginUrl' && (
                <Text dimColor>
                    Author: <Text color={colors.highlight}>{author}</Text>
                </Text>
            )}
            {currentField === 'identifier' && identifierError && <Text color={colors.error}>{identifierError}</Text>}
            <Box>
                <Box marginRight={1}>
                    <Text>{fieldLabel()}</Text>
                </Box>
                <UncontrolledTextInput key={`${currentField}-${identifierError ?? ''}`} onSubmit={handleSubmit} />
            </Box>
        </Box>
    );
};
