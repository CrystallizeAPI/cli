import type { Envelope, QueryHandlerDefinition } from 'missive.js';
import type { PimCredentials } from '../contracts/models/credentials';
import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import {
    type ChoiceConfig,
    type ChunksConfig,
    type ComponentConfigInput,
    type ComponentDefinition,
    type ComponentDefinitionInput,
    type ItemRelationsConfig,
    type MultipleChoicesConfig,
    type Piece,
    type PieceConfig,
    type Shape,
} from '@crystallize/schema/pim';
import type { Operation } from '@crystallize/schema/mass-operation';
import type { AsyncCreateClient } from '../contracts/credential-retriever';

type Deps = {
    createCrystallizeClient: AsyncCreateClient;
};

type Query = {
    tenantIdentifier: string;
    credentials: PimCredentials;
    withItemIds?: boolean;
};

export type CreateContentModelMassOperationFileHandlerDefinition = QueryHandlerDefinition<
    'CreateContentModelMassOperationFile',
    Query,
    Awaited<ReturnType<typeof handler>>
>;

const handler = async (envelope: Envelope<Query>, deps: Deps) => {
    const { createCrystallizeClient } = deps;
    const { tenantIdentifier, credentials, withItemIds } = envelope.message;

    const client = await createCrystallizeClient({
        tenantIdentifier: tenantIdentifier,
        sessionId: credentials.sessionId,
        accessTokenId: credentials.ACCESS_TOKEN_ID,
        accessTokenSecret: credentials.ACCESS_TOKEN_SECRET,
    });

    const getPieceIdentifierToNameMap = async (): Promise<Record<string, string>> => {
        const map: Record<string, string> = {};
        const query = {
            pieces: {
                __args: {
                    first: 100,
                    after: '',
                },
                __on: {
                    __typeName: 'PieceConnection',
                    pageInfo: {
                        endCursor: true,
                        hasNextPage: true,
                    },
                    edges: {
                        node: {
                            identifier: true,
                            name: true,
                        },
                    },
                },
            },
        };
        let data: {
            pieces: {
                pageInfo: {
                    endCursor: string;
                    hasNextPage: boolean;
                };
                edges: {
                    node: {
                        identifier: string;
                        name: string;
                    };
                }[];
            };
        };
        let cursor: string | undefined = undefined;
        do {
            if (cursor) {
                query.pieces.__args = {
                    first: 100,
                    after: cursor,
                };
            }
            data = await client.nextPimApi(jsonToGraphQLQuery({ query }));
            for (const edge of data.pieces.edges) {
                map[edge.node.identifier] = edge.node.name;
            }
            cursor = data.pieces.pageInfo.endCursor;
        } while (data.pieces.pageInfo.hasNextPage);
        return map;
    };

    const buildQueryFrom = (cursor?: string) => {
        const args: {
            first: number;
            after?: string;
        } = {
            first: 25,
        };
        if (cursor && cursor.length > 0) {
            args.after = cursor;
        }
        return {
            shapes: {
                __args: args,
                pageInfo: {
                    endCursor: true,
                    hasNextPage: true,
                },
                edges: {
                    node: {
                        identifier: true,
                        name: true,
                        type: true,
                        resolvedConfiguration: true,
                    },
                },
            },
        };
    };
    async function* fetch() {
        let query = buildQueryFrom();
        let data: {
            shapes: {
                pageInfo: {
                    endCursor: string;
                    hasNextPage: boolean;
                };
                edges: {
                    node: {
                        identifier: string;
                        name: string;
                        type: 'product' | 'folder' | 'document';
                        resolvedConfiguration: {
                            components: ComponentDefinition[];
                            variantComponents?: ComponentDefinition[];
                        };
                    };
                }[];
            };
        };
        do {
            data = await client.nextPimApi(jsonToGraphQLQuery({ query }));
            for (const edge of data.shapes?.edges ?? []) {
                yield {
                    identifier: edge.node.identifier,
                    name: edge.node.name,
                    type: edge.node.type,
                    components: edge.node.resolvedConfiguration.components,
                    variantComponents: edge.node.resolvedConfiguration.variantComponents,
                };
            }
            query = buildQueryFrom(data.shapes.pageInfo?.endCursor);
        } while (data.shapes.pageInfo?.hasNextPage);
    }

    const extractDependencies = function* (node: Shape | Omit<Piece, 'name'>) {
        function* loopInComponents(components: ComponentDefinition[]): Generator<
            {
                identifier: string;
            } & ({ type: 'shape' } | { type: 'piece'; data: Omit<Piece, 'name'> }),
            void,
            unknown
        > {
            for (const component of components) {
                if (component.type === 'piece') {
                    const config = component.config as PieceConfig;
                    yield {
                        identifier: config.identifier,
                        type: 'piece',
                        data: config,
                    };
                }
                if (component.type === 'itemRelations') {
                    const config = component.config as ItemRelationsConfig;
                    if (config.acceptedShapeIdentifiers) {
                        for (const acceptedShapeIdentifier of config.acceptedShapeIdentifiers) {
                            yield {
                                identifier: acceptedShapeIdentifier,
                                type: 'shape',
                            };
                        }
                    }
                }

                if (component.type === 'piece' || component.type === 'contentChunk') {
                    const config = component.config as PieceConfig | ChunksConfig;
                    if (config.components) {
                        yield* loopInComponents(config.components);
                    }
                }
                if (component.type === 'componentMultipleChoice' || component.type === 'componentChoice') {
                    const config = component.config as MultipleChoicesConfig | ChoiceConfig;
                    if (config.choices) {
                        yield* loopInComponents(config.choices);
                    }
                }
            }
        }
        yield* loopInComponents(node.components || []);
        if ('variantComponents' in node) {
            yield* loopInComponents(node.variantComponents || []);
        }
    };

    const mapConfig = (component: ComponentDefinition): ComponentConfigInput => {
        if (component.type === 'piece') {
            const { components, ...config } = component.config as PieceConfig;
            return {
                [component.type]: config,
            };
        }

        if (component.type === 'contentChunk') {
            const config = component.config as ChunksConfig;
            return {
                [component.type]: {
                    ...config,
                    components: config!.components.map((subcomponent): ComponentDefinitionInput => {
                        return {
                            ...subcomponent,
                            config: mapConfig(subcomponent),
                        };
                    }),
                },
            };
        }

        if (component.type === 'componentMultipleChoice' || component.type === 'componentChoice') {
            const config = component.config as MultipleChoicesConfig | ChoiceConfig;
            return {
                [component.type]: {
                    ...config,
                    choices: config!.choices.map((subcomponent): ComponentDefinitionInput => {
                        return {
                            ...subcomponent,
                            config: mapConfig(subcomponent),
                        };
                    }),
                },
            };
        }
        if (component.type === 'itemRelations') {
            const config = component.config as ItemRelationsConfig;
            return {
                [component.type]: {
                    ...config,
                    ...(config.quickSelect && {
                        quickSelect: {
                            ...config.quickSelect,
                            folders: withItemIds === false ? [] : config.quickSelect.folders,
                        },
                    }),
                },
            };
        }
        return {
            [component.type]: component.config,
        };
    };

    const graph: Record<string, string[]> = {};
    const pieceSet: Map<string, Omit<Piece, 'name'>> = new Map();
    const shapeSet: Map<string, Shape> = new Map();
    const pieceIdentifierToNameMap = await getPieceIdentifierToNameMap();
    for await (const shape of fetch()) {
        shapeSet.set(shape.identifier, shape);
        graph[`shape/${shape.identifier}`] = [];
        for (const dependency of extractDependencies(shape)) {
            const dep = {
                identifier: dependency.identifier,
                type: dependency.type,
            };
            graph[`shape/${shape.identifier}`].push(`${dep.type}/${dep.identifier}`);
            if (dependency.type === 'piece') {
                pieceSet.set(dependency.identifier, dependency.data);
            }
        }
    }

    for (const piece of pieceSet.values()) {
        graph[`piece/${piece.identifier}`] = [];
        for (const dependency of extractDependencies(piece)) {
            const dep = {
                identifier: dependency.identifier,
                type: dependency.type,
            };
            graph[`piece/${piece.identifier}`].push(`${dep.type}/${dep.identifier}`);
        }
    }

    const calculateDeps = (graph: Record<string, string[]>): { cycles: string[][]; dependencies: string[] } => {
        const visited = new Set<string>();
        const tempStack = new Set<string>();
        const result: string[] = [];
        const cycles: string[][] = [];

        function dfs(node: string): void {
            if (tempStack.has(node)) {
                const cycle = [...tempStack].slice([...tempStack].indexOf(node)).concat(node);
                cycles.push(cycle);
                return;
            }

            if (visited.has(node)) {
                return;
            }
            tempStack.add(node);
            for (const dep of graph[node] || []) {
                dfs(dep);
            }
            tempStack.delete(node);
            visited.add(node);
            if (!result.includes(node)) {
                result.push(node);
            }
        }
        for (const node in graph) {
            if (!visited.has(node)) {
                dfs(node);
            }
        }
        return { cycles, dependencies: result };
    };

    const { cycles, dependencies } = calculateDeps(graph);

    const operations: Operation[] = [];

    const placeholders = cycles.flatMap((cycle) =>
        [...new Set(cycle)].map((node) => {
            const [type, identifier] = node.split('/');
            if (type === 'shape') {
                const shape = shapeSet.get(identifier);
                if (shape) {
                    return {
                        identifier: shape.identifier,
                        type: 'shape',
                    };
                }
            }
            if (type === 'piece') {
                const piece = pieceSet.get(identifier);
                if (piece) {
                    return {
                        identifier: piece.identifier,
                        type: 'piece',
                    };
                }
            }
            throw new Error(`Unknown type ${type}`);
        }),
    );

    for (const placeholder of placeholders) {
        if (placeholder.type === 'shape') {
            const shape = shapeSet.get(placeholder.identifier);
            if (shape) {
                operations.push({
                    intent: 'shape/create',
                    type: shape.type,
                    name: shape.name,
                    identifier: shape.identifier,
                    components: [],
                });
            }
        }
        if (placeholder.type === 'piece') {
            const piece = pieceSet.get(placeholder.identifier);
            if (piece) {
                operations.push({
                    intent: 'piece/create',
                    name: pieceIdentifierToNameMap[piece.identifier],
                    identifier: piece.identifier,
                    components: [],
                });
            }
        }
    }

    for (const dependency of dependencies) {
        const [type, identifier] = dependency.split('/');
        if (type === 'shape') {
            const shape = shapeSet.get(identifier);
            if (shape) {
                operations.push({
                    intent: 'shape/upsert',
                    type: shape.type,
                    name: shape.name,
                    identifier: shape.identifier,
                    components:
                        shape.components?.map((component) => ({
                            id: component.id,
                            type: component.type,
                            name: component.name,
                            description: component.description,
                            config: mapConfig(component),
                        })) || [],
                    ...(shape.type === 'product'
                        ? {
                            variantComponents:
                                shape.variantComponents?.map((component) => ({
                                    id: component.id,
                                    type: component.type,
                                    name: component.name,
                                    description: component.description,
                                    config: mapConfig(component),
                                })) || [],
                        }
                        : {}),
                });
            }
        }
        if (type === 'piece') {
            const piece = pieceSet.get(identifier);
            if (piece) {
                operations.push({
                    intent: 'piece/upsert',
                    name: pieceIdentifierToNameMap[piece.identifier],
                    identifier: piece.identifier,
                    components:
                        piece.components?.map((component) => ({
                            id: component.id,
                            type: component.type,
                            name: component.name,
                            description: component.description,
                            config: mapConfig(component),
                        })) || [],
                });
            }
        }
    }

    return {
        content: {
            version: '0.0.1',
            operations,
        },
    };
};

export const createCreateContentModelMassOperationFileHandler = (deps: Deps) => (query: Envelope<Query>) =>
    handler(query, deps);
