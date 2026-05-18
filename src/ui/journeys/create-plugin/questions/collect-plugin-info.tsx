import { Box, Text } from 'ink';
import { UncontrolledTextInput } from 'ink-text-input';
import { useState } from 'react';
import { useAtom } from 'jotai';
import { colors } from '../../../../core/styles';
import type { CreatePluginStore, PluginInfo } from '../create-store';

type CollectPluginInfoProps = {
    store: CreatePluginStore['atoms'];
};

type Field = 'name' | 'identifier' | 'author' | 'vendorUrl';

const toKebab = (value: string): string =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

export const CollectPluginInfo = ({ store }: CollectPluginInfoProps) => {
    const [state] = useAtom(store.stateAtom);
    const [, setInfo] = useAtom(store.setInfoAtom);

    const [name, setName] = useState('');
    const [identifier, setIdentifier] = useState('');
    const [author, setAuthor] = useState('');
    const [currentField, setCurrentField] = useState<Field>('name');

    if (state.info) {
        return (
            <Text>
                Plugin: <Text color={colors.highlight}>{state.info.name}</Text> (
                <Text color={colors.highlight}>{state.info.identifier}</Text>) by{' '}
                <Text color={colors.highlight}>{state.info.author}</Text> — {state.info.vendorUrl}
            </Text>
        );
    }

    const derivedIdentifier = toKebab(identifier || name) || 'my-plugin';

    const handleSubmit = (value: string) => {
        if (currentField === 'name') {
            setName(value);
            setCurrentField('identifier');
        } else if (currentField === 'identifier') {
            setIdentifier(value);
            setCurrentField('author');
        } else if (currentField === 'author') {
            setAuthor(value);
            setCurrentField('vendorUrl');
        } else if (currentField === 'vendorUrl') {
            const finalInfo: PluginInfo = {
                name,
                identifier: derivedIdentifier,
                author,
                vendorUrl: value,
            };
            setInfo(finalInfo);
        }
    };

    const fieldLabel = (): string => {
        if (currentField === 'name') return 'Plugin name:';
        if (currentField === 'identifier') return `Identifier (kebab-case, default "${toKebab(name) || 'my-plugin'}"):`;
        if (currentField === 'author') return 'Author:';
        return 'Vendor URL:';
    };

    return (
        <Box flexDirection="column">
            {name && (
                <Text dimColor>
                    Name: <Text color={colors.highlight}>{name}</Text>
                </Text>
            )}
            {currentField !== 'identifier' && currentField !== 'name' && (
                <Text dimColor>
                    Identifier: <Text color={colors.highlight}>{derivedIdentifier}</Text>
                </Text>
            )}
            {author && currentField === 'vendorUrl' && (
                <Text dimColor>
                    Author: <Text color={colors.highlight}>{author}</Text>
                </Text>
            )}
            <Box>
                <Box marginRight={1}>
                    <Text>{fieldLabel()}</Text>
                </Box>
                <UncontrolledTextInput key={currentField} onSubmit={handleSubmit} />
            </Box>
        </Box>
    );
};
