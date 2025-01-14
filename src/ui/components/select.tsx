import { useState } from 'react';
import { Text, useInput, Box, Newline } from 'ink';
import { colors } from '../../core/styles';

/**
 * Due to terminals not always being that large, we need
 * to cap the max amount of options to display to a low
 * number.
 */
const maxOptionsToDisplay = 3;

type Option<T> = {
    label: string;
    value: T;
    render?: () => JSX.Element;
};

type Styles = {
    compact?: boolean;
};

export type Props<T> = {
    options: Option<T>[];
    onSelect: (value: T) => void;
    styles?: Styles;
    defaultSelectedIndex?: number;
};

export function Select<T>({ options, onSelect, styles, defaultSelectedIndex = 0 }: Props<T>) {
    const [selectedIndex, setSelectedIndex] = useState(defaultSelectedIndex);

    const optionsToDisplay = (() => {
        if (selectedIndex === 0) {
            return options.slice(selectedIndex, maxOptionsToDisplay);
        }

        if (selectedIndex === options.length - 1) {
            return options.slice(-maxOptionsToDisplay);
        }
        return options.slice(selectedIndex - 1, selectedIndex - 1 + maxOptionsToDisplay);
    })();
    const lastDisplayedIndex = options.findIndex(
        (option: Option<T>) => option === optionsToDisplay[optionsToDisplay.length - 1],
    );
    const overflowItem = lastDisplayedIndex < options.length - 1 ? options[lastDisplayedIndex + 1] : null;

    useInput((_, key) => {
        if (key.return) {
            onSelect(options[selectedIndex].value);
            return;
        }

        if (key.upArrow) {
            setSelectedIndex(selectedIndex <= 0 ? options.length - 1 : selectedIndex - 1);
        }
        if (key.downArrow) {
            setSelectedIndex(selectedIndex >= options.length - 1 ? 0 : selectedIndex + 1);
        }
    });

    return (
        <Box flexDirection="column">
            {optionsToDisplay.map((option: Option<T>, index: number) => {
                return (
                    <Box flexDirection="row" marginY={styles?.compact ? 0 : 1} key={index}>
                        <Box width={1} marginRight={2} alignItems="center">
                            <Text color={colors.highlight}>
                                {options[selectedIndex].value === option.value ? '>' : ''}
                            </Text>
                        </Box>
                        <Box>
                            <Text color={options[selectedIndex].value === option.value ? colors.highlight : undefined}>
                                {option.render ? option.render() : option.label}
                            </Text>
                        </Box>
                    </Box>
                );
            })}
            {overflowItem && (
                <Box marginLeft={3} flexDirection="row">
                    <Text>
                        {overflowItem.label}
                        <Newline />
                        ...
                    </Text>
                </Box>
            )}
        </Box>
    );
}
