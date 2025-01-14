import pc from 'picocolors';
import { marked } from 'marked';
import { Text } from 'ink';
import { markedTerminal, type TerminalRendererOptions } from 'marked-terminal';

export type Props = TerminalRendererOptions & {
    children: string;
};

export default function Markdown({ children, ...options }: Props) {
    marked.use(
        // @ts-ignore
        markedTerminal({
            firstHeading: pc.bold,
            link: pc.underline,
            href: pc.underline,
            ...options,
        }),
    );
    return <Text>{(marked.parse(children) as string).trim()}</Text>;
}
