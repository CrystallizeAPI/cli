import { Text } from 'ink';

export type Props = Bun.markdown.AnsiTheme & {
    children: string;
};

export default function Markdown({ children, ...theme }: Props) {
    return <Text>{Bun.markdown.ansi(children, theme).trim()}</Text>;
}
