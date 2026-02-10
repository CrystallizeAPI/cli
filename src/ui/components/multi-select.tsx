import { useState } from 'react';
import { Text, useInput, Box } from 'ink';
import { colors } from '../../core/styles';

const maxOptionsToDisplay = 20;

type Option<T> = {
    label: string;
    value: T;
    group?: string;
};

export type Props<T> = {
    options: Option<T>[];
    onConfirm: (values: T[]) => void;
};

type DisplayRow<T> = { type: 'header'; label: string } | { type: 'option'; option: Option<T>; flatIndex: number };

export function MultiSelect<T>({ options, onConfirm }: Props<T>) {
    const [cursorIndex, setCursorIndex] = useState(0);
    const [selected, setSelected] = useState<Set<number>>(new Set());

    const rows: DisplayRow<T>[] = (() => {
        const result: DisplayRow<T>[] = [];
        let currentGroup: string | undefined;
        options.forEach((option, index) => {
            if (option.group !== currentGroup) {
                currentGroup = option.group;
                if (currentGroup) {
                    result.push({ type: 'header', label: currentGroup });
                }
            }
            result.push({ type: 'option', option, flatIndex: index });
        });
        return result;
    })();

    const selectableIndices = rows.map((row, i) => (row.type === 'option' ? i : -1)).filter((i) => i !== -1);
    const cursorRowIndex = selectableIndices[cursorIndex] ?? 0;

    const windowStart = (() => {
        const half = Math.floor(maxOptionsToDisplay / 2);
        const totalRows = rows.length;
        if (totalRows <= maxOptionsToDisplay) return 0;
        if (cursorRowIndex <= half) return 0;
        if (cursorRowIndex >= totalRows - half) return totalRows - maxOptionsToDisplay;
        return cursorRowIndex - half;
    })();
    const visibleRows = rows.slice(windowStart, windowStart + maxOptionsToDisplay);

    useInput((input, key) => {
        if (key.return) {
            const values = options.filter((_, i) => selected.has(i)).map((o) => o.value);
            onConfirm(values);
            return;
        }

        if (input === ' ') {
            const row = rows[cursorRowIndex];
            if (row.type === 'option') {
                const next = new Set(selected);
                if (next.has(row.flatIndex)) {
                    next.delete(row.flatIndex);
                } else {
                    next.add(row.flatIndex);
                }
                setSelected(next);
            }
            return;
        }

        if (key.upArrow) {
            setCursorIndex(cursorIndex <= 0 ? selectableIndices.length - 1 : cursorIndex - 1);
        }
        if (key.downArrow) {
            setCursorIndex(cursorIndex >= selectableIndices.length - 1 ? 0 : cursorIndex + 1);
        }
    });

    const hasMore = windowStart + maxOptionsToDisplay < rows.length;

    return (
        <Box flexDirection="column">
            <Text dimColor>Use ↑↓ to navigate, space to toggle, enter to confirm ({selected.size} selected)</Text>
            {visibleRows.map((row, i) => {
                if (row.type === 'header') {
                    return (
                        <Box key={`h-${i}`} marginTop={1}>
                            <Text bold dimColor>
                                {row.label}
                            </Text>
                        </Box>
                    );
                }
                const isCursor = windowStart + i === cursorRowIndex;
                const isSelected = selected.has(row.flatIndex);
                const checkbox = isSelected ? '[x]' : '[ ]';
                return (
                    <Box flexDirection="row" key={`o-${row.flatIndex}`}>
                        <Text color={isCursor ? colors.highlight : undefined}>{isCursor ? '>' : ' '}</Text>
                        <Text> </Text>
                        <Text color={isCursor ? colors.highlight : undefined}>{checkbox}</Text>
                        <Text> </Text>
                        <Text color={isCursor ? colors.highlight : undefined}>{row.option.label}</Text>
                    </Box>
                );
            })}
            {hasMore && (
                <Box>
                    <Text dimColor> ...</Text>
                </Box>
            )}
        </Box>
    );
}
