import { Box, Text } from 'ink';
import { UncontrolledTextInput } from 'ink-text-input';
import { useState } from 'react';
import { useAtom } from 'jotai';
import { colors } from '../../../../core/styles';
import { Select } from '../../../components/select';
import type { CreatePluginStore, KeypairSettings } from '../create-store';

type KeypairSettingsProps = {
    store: CreatePluginStore['atoms'];
};

type BitsOption = 2048 | 3072 | 4096;
type Step = 'bits' | 'kid';

const bitsOptions: { label: string; value: BitsOption }[] = [
    { label: '2048 (default)', value: 2048 },
    { label: '3072', value: 3072 },
    { label: '4096', value: 4096 },
];

export const KeypairSettingsQuestion = ({ store }: KeypairSettingsProps) => {
    const [state] = useAtom(store.stateAtom);
    const [, setKeypair] = useAtom(store.setKeypairAtom);

    const [bits, setBits] = useState<BitsOption>(2048);
    const [currentStep, setCurrentStep] = useState<Step>('bits');

    if (!state.skeleton || !state.info) {
        return null;
    }

    if (state.isKeypairConfigured || state.isDownloaded || state.isKeypairGenerated) {
        return (
            <Text>
                Keypair: <Text color={colors.highlight}>{state.keypair.bits}</Text> bits, kid:{' '}
                <Text color={colors.highlight}>{state.keypair.kid}</Text>
            </Text>
        );
    }

    if (currentStep === 'bits') {
        return (
            <>
                <Text>Select RSA key size for the plugin keypair:</Text>
                <Select<BitsOption>
                    options={bitsOptions}
                    onSelect={(selected: BitsOption) => {
                        setBits(selected);
                        setCurrentStep('kid');
                    }}
                    styles={{ compact: true }}
                />
            </>
        );
    }

    return (
        <Box>
            <Box marginRight={1}>
                <Text>Key ID (kid, default &quot;public&quot;):</Text>
            </Box>
            <UncontrolledTextInput
                placeholder="public"
                onSubmit={(kid: string) => {
                    const finalKeypair: KeypairSettings = {
                        bits,
                        kid: kid.trim() || 'public',
                    };
                    setKeypair(finalKeypair);
                }}
            />
        </Box>
    );
};
