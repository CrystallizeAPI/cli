import type { Envelope, QueryHandlerDefinition } from 'missive.js';
import { createCatalogueFetcher, createClient } from '@crystallize/js-api-client';
import type { Logger } from '../contracts/logger';
import { staticTips } from '../../content/static-tips';

type Deps = {
    logger: Logger;
};
type Query = {};

export type FetchTipsHandlerDefinition = QueryHandlerDefinition<
    'FetchTips',
    Query,
    Awaited<ReturnType<typeof handler>>
>;

const handler = async (_: Envelope<Query>, deps: Deps) => {
    const { logger } = deps;
    // we call production all the time here on purpose.
    const apiClient = createClient({
        tenantIdentifier: 'crystallize_marketing',
    });
    const fetcher = createCatalogueFetcher(apiClient);
    const tree = {
        subtree: {
            __args: {
                first: 10,
            },
            edges: {
                node: {
                    name: true,
                    path: true,
                },
            },
        },
    };
    const query = {
        blogPosts: {
            __aliasFor: 'catalogue',
            __args: {
                path: '/blog',
                language: 'en',
            },
            ...tree,
        },
        comics: {
            __aliasFor: 'catalogue',
            __args: {
                path: '/comics',
                language: 'en',
            },
            ...tree,
        },
    };

    try {
        const data = await fetcher<{
            blogPosts: {
                subtree: {
                    edges: {
                        node: {
                            name: string;
                            path: string;
                        };
                    }[];
                };
            };
            comics: {
                subtree: {
                    edges: {
                        node: {
                            name: string;
                            path: string;
                        };
                    }[];
                };
            };
        }>(query);
        return {
            tips: [
                ...staticTips,
                ...data.blogPosts.subtree.edges.map(({ node }: { node: { name: string; path: string } }) => ({
                    title: node.name,
                    url: `https://crystallize.com${node.path}`,
                    type: 'blogPost',
                })),
                ...data.comics.subtree.edges.map(({ node }: { node: { name: string; path: string } }) => ({
                    title: node.name,
                    url: `https://crystallize.com${node.path}`,
                    type: 'comic',
                })),
            ],
        };
    } catch (error) {
        logger.error('Failed to fetch tips', error);
        return {
            tips: staticTips,
        };
    }
};

export const createFetchTipsHandler = (deps: Deps) => (query: Envelope<Query>) => handler(query, deps);
