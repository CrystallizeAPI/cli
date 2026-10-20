import { Newline, Text } from 'ink';
import Link from 'ink-link';
import type { SuperfastShop } from '../../domain/contracts/models/superfast-shop';

type SuperfastShopChoiceProps = {
    shop: SuperfastShop;
};
export const SuperfastShopChoice = ({ shop }: SuperfastShopChoiceProps) => {
    return (
        <>
            <Text>
                {shop.name}
                {shop.isNew && <Text color="green"> NEW</Text>}
            </Text>
            <Newline />
            <Text dimColor>{shop.industry}</Text>
            <Newline />
            <Text dimColor>{shop.description}</Text>
            <Newline />
            <Text dimColor>{shop.features.join(' · ')}</Text>
            <Newline />
            <Text dimColor>
                <Link url={shop.url}>
                    <Text color="cyan">Demo: {shop.url}</Text>
                </Link>
            </Text>
        </>
    );
};
