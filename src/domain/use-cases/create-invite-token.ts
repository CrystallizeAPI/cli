import type { createClient } from '@crystallize/js-api-client';
import type { PimCredentials } from '../contracts/models/credentials';
import type { CommandHandlerDefinition, Envelope } from 'missive.js';
import { VariableType, jsonToGraphQLQuery } from 'json-to-graphql-query';

type Deps = {
    createCrystallizeClient: typeof createClient;
};
type Command = {
    expiresAt: Date;
    tenantIdentifier: string;
    credentials: PimCredentials;
    number: number;
    role: string;
};

export type CreateTenantInviteTokenHandlerDefinition = CommandHandlerDefinition<
    'CreateTenantInviteToken',
    Command,
    Awaited<ReturnType<typeof handler>>
>;

const handler = async (
    envelope: Envelope<Command>,
    { createCrystallizeClient }: Deps,
): Promise<{
    tokens: string[];
}> => {
    const { expiresAt, tenantIdentifier, credentials, number, role } = envelope.message;

    const client = createCrystallizeClient({
        tenantIdentifier: tenantIdentifier,
        accessTokenId: credentials.ACCESS_TOKEN_ID,
        accessTokenSecret: credentials.ACCESS_TOKEN_SECRET,
    });

    if (number < 1) {
        throw new Error('Number of invites must be greater than 0.');
    }
    const singleMutations = Array.from({ length: number }).map(() => ({
        __aliasFor: 'createInviteToken',
        __args: {
            expiresAt: new VariableType('expiresAt'),
            role: new VariableType('role'),
        },
        __on: [
            {
                __typeName: 'InviteToken',
                token: true,
            },
            {
                __typeName: 'BasicError',
                error: {
                    __aliasFor: 'message',
                },
            },
        ],
    }));

    const mutation = {
        __variables: {
            expiresAt: 'Date!',
            role: 'String!',
        },
        ...singleMutations.reduce(
            (
                memo: Record<string, (typeof singleMutations)[number]>,
                singleMutation: (typeof singleMutations)[number],
                index: number,
            ) => {
                return {
                    ...memo,
                    [`inviteToken${index}`]: singleMutation,
                };
            },
            {},
        ),
    };

    const results = (await client.nextPimApi(jsonToGraphQLQuery({ mutation }), {
        expiresAt: expiresAt.toISOString(),
        role,
    })) as Record<string, { token: string; error?: never } | { error: string; token: never }>;

    return {
        tokens: Object.values(results).map((result) => {
            if (result.error) {
                throw new Error(result.error);
            }
            return result.token;
        }),
    };
};

export const createCreateTenantInviteTokenHandler = (deps: Deps) => (command: Envelope<Command>) =>
    handler(command, deps);
