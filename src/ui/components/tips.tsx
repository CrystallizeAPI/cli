import { Box, Newline, Text } from 'ink';
import Link from 'ink-link';
import { useEffect, useState } from 'react';
import type { Tip } from '../../domain/contracts/models/tip';
import { staticTips } from '../../content/static-tips';

export type TipsProps = {
    fetchTips: () => Promise<Tip[]>;
};
export const Tips = ({ fetchTips }: TipsProps) => {
    const [tips, setTips] = useState<Tip[]>(staticTips);
    const [tipIndex, setTipIndex] = useState(0);

    useEffect(() => {
        fetchTips().then((tipResults) => setTips(tipResults));
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setTipIndex(Math.floor(Math.random() * (tips.length - 1)));
        }, 4000);
        return () => clearInterval(interval);
    });
    if (tips.length === 0) {
        return null;
    }
    const tip = tips[tipIndex];
    return (
        <>
            <Newline />
            <Text dimColor>--------------------------------------</Text>
            <Box>
                <Text italic dimColor>
                    <Text>
                        {tip.type === 'blogPost' && `Catch up on our blog post: "${tip.title}"`}
                        {tip.type === 'comic' && `Like comics? Check this out: "${tip.title}"`}
                        {tip.type === '' && `${tip.title}`}
                        <Newline />
                        <Link url={tip.url}>{tip.url}</Link>
                    </Text>
                </Text>
            </Box>
        </>
    );
};
