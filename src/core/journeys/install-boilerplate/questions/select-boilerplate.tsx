import { Text } from 'ink';
import { boilerplates } from '../../../../content/boilerplates';
import type { Boilerplate } from '../../../../domain/contracts/models/boilerplate';
import { BoilerplateChoice } from '../../../../ui/components/boilerplate-choice';
import { colors } from '../../../styles';
import { Select } from '../../../../ui/components/select';
import type { InstallBoilerplateStore } from '../create-store';
import { useAtom } from 'jotai';

type SelectBoilerplateProps = {
    store: InstallBoilerplateStore['atoms'];
};
export const SelectBoilerplate = ({ store }: SelectBoilerplateProps) => {
    const [state] = useAtom(store.stateAtom);
    const [, setBoilerplate] = useAtom(store.setBoilerplateAtom);
    return (
        <>
            {!state.boilerplate && <Text>Please select a boilerplate for your project</Text>}
            {!state.boilerplate && (
                <Select<Boilerplate>
                    options={boilerplates.map((boilerplate: Boilerplate) => {
                        return {
                            label: boilerplate.name,
                            value: boilerplate,
                            render: () => <BoilerplateChoice boilerplate={boilerplate} />,
                        };
                    })}
                    onSelect={(boilerplate: Boilerplate) => {
                        setBoilerplate(boilerplate);
                    }}
                />
            )}

            {state.boilerplate && (
                <Text>
                    You are going to install the <Text color={colors.highlight}>{state.boilerplate.name}</Text>{' '}
                    boilerplate.
                </Text>
            )}
        </>
    );
};
