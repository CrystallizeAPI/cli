import cliSpinners from 'cli-spinners';
import type { Spinner as TSpinner } from 'cli-spinners';
import { Text } from 'ink';
import { useEffect, useState } from 'react';
import { colors } from '../../core/styles';

type SpinnerProps = {
    name?: keyof typeof cliSpinners;
};
export const Spinner = ({ name = 'dots' }: SpinnerProps) => {
    const [frame, setFrame] = useState(0);
    const spinner: TSpinner = cliSpinners[name] as TSpinner;
    useEffect(() => {
        const timer = setInterval(() => {
            setFrame((previousFrame) => {
                const isLastFrame = previousFrame === spinner.frames.length - 1;
                return isLastFrame ? 0 : previousFrame + 1;
            });
        }, spinner.interval);
        return () => {
            clearInterval(timer);
        };
    }, [spinner]);
    return (
        <Text bold color={colors.highlight}>
            {spinner.frames[frame]}{' '}
        </Text>
    );
};
