import { Box, Newline, Text, useApp } from 'ink';
import { useEffect, useState } from 'react';
import { colors } from '../../core/styles';
import { Spinner } from './spinner';
import Markdown from './markdown';

type SuccessProps = {
    children: string;
};

export const Success = ({ children }: SuccessProps) => {
    const { exit } = useApp();
    const [showSpinnerWaiter, setShowSpinnerWaiter] = useState(true);
    useEffect(() => {
        const timeout = setTimeout(() => {
            setShowSpinnerWaiter(false);
            exit();
        }, 1500);
        return () => {
            clearTimeout(timeout);
        };
    }, []);
    return (
        <>
            <Newline />
            <Box
                flexDirection="column"
                borderColor={colors.info}
                borderStyle={'bold'}
                alignItems="center"
                width={100}
                marginLeft={2}
            >
                <Text bold>Go fast and prosper.</Text>
                <Text dimColor>The milliseconds are with you!</Text>
                {showSpinnerWaiter ? <Spinner name="aesthetic" /> : <Text>▰▰▰▰▰▰▰</Text>}
                <Box flexDirection="row" width={90}>
                    <Markdown>{children}</Markdown>
                </Box>

                {showSpinnerWaiter ? <Spinner name="fistBump" /> : <Text>🤜✨🤛</Text>}
                <Newline />
            </Box>
        </>
    );
};
