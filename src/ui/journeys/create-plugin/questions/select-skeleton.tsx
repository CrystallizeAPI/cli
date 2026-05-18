import { Newline, Text } from 'ink';
import Link from 'ink-link';
import { useAtom } from 'jotai';
import { pluginSkeletons } from '../../../../content/plugin-skeletons';
import { colors } from '../../../../core/styles';
import type { PluginSkeleton } from '../../../../domain/contracts/models/plugin-skeleton';
import { Select } from '../../../components/select';
import type { CreatePluginStore } from '../create-store';

type SelectSkeletonProps = {
    store: CreatePluginStore['atoms'];
};

export const SelectSkeleton = ({ store }: SelectSkeletonProps) => {
    const [state] = useAtom(store.stateAtom);
    const [, setSkeleton] = useAtom(store.setSkeletonAtom);
    return (
        <>
            {!state.skeleton && <Text>Please select a skeleton for your plugin</Text>}
            {!state.skeleton && (
                <Select<PluginSkeleton>
                    options={pluginSkeletons.map((s: PluginSkeleton) => {
                        return {
                            label: `${s.name} — ${s.baseline}`,
                            value: s,
                            render: () => (
                                <>
                                    <Text>{s.name}</Text>
                                    <Newline />
                                    <Text dimColor>{s.baseline}</Text>
                                    <Newline />
                                    <Text dimColor>{s.description}</Text>
                                    {s.demo && (
                                        <>
                                            <Newline />
                                            <Text dimColor>
                                                {/*@ts-ignore*/}
                                                <Link url={s.demo}>
                                                    <Text color="cyan">Demo: {s.demo}</Text>
                                                </Link>
                                            </Text>
                                        </>
                                    )}
                                </>
                            ),
                        };
                    })}
                    onSelect={(skeleton: PluginSkeleton) => {
                        setSkeleton(skeleton);
                    }}
                />
            )}

            {state.skeleton && (
                <Text>
                    You are going to scaffold the <Text color={colors.highlight}>{state.skeleton.name}</Text> skeleton.
                </Text>
            )}
        </>
    );
};
