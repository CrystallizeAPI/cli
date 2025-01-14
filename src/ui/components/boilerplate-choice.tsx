import { Newline, Text } from 'ink';
import Link from 'ink-link';
import type { Boilerplate } from '../../domain/contracts/models/boilerplate';

type BoilerplateChoiceProps = {
    boilerplate: Boilerplate;
};
export const BoilerplateChoice = ({ boilerplate }: BoilerplateChoiceProps) => {
    return (
        <>
            <Text>{boilerplate.name}</Text>
            <Newline />
            <Text dimColor>{boilerplate.baseline}</Text>
            <Newline />
            <Text dimColor>{boilerplate.description}</Text>
            <Newline />
            <Text dimColor>
                <Link url={boilerplate.demo}>
                    <Text color="cyan">Demo: {boilerplate.demo}</Text>
                </Link>
            </Text>
        </>
    );
};
