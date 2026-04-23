import { exportJWK, generateKeyPair, type JWK } from 'jose';
import type { CommandHandlerDefinition, Envelope } from 'missive.js';

export const ALLOWED_BITS = [2048, 3072, 4096] as const;
export type AllowedBits = (typeof ALLOWED_BITS)[number];

type Command = {
    bits: AllowedBits;
    kid: string;
};

export type PluginJwkPair = {
    publicJwk: JWK & { kid: string; use: 'enc'; alg: 'RSA-OAEP-256'; enc: 'A256GCM'; kty: 'RSA' };
    privateJwk: JWK & { kid: string; use: 'enc'; alg: 'RSA-OAEP-256'; kty: 'RSA' };
};

export type GeneratePluginKeypairHandlerDefinition = CommandHandlerDefinition<
    'GeneratePluginKeypair',
    Command,
    Awaited<ReturnType<typeof handler>>
>;

const handler = async (envelope: Envelope<Command>): Promise<PluginJwkPair> => {
    const { bits, kid } = envelope.message;

    const { publicKey, privateKey } = await generateKeyPair('RSA-OAEP-256', {
        modulusLength: bits,
        extractable: true,
    });

    const publicJwkRaw = await exportJWK(publicKey);
    const privateJwkRaw = await exportJWK(privateKey);

    const publicJwk = {
        ...publicJwkRaw,
        kty: 'RSA',
        kid,
        use: 'enc',
        alg: 'RSA-OAEP-256',
        enc: 'A256GCM',
    } as PluginJwkPair['publicJwk'];

    const privateJwk = {
        ...privateJwkRaw,
        kty: 'RSA',
        kid,
        use: 'enc',
        alg: 'RSA-OAEP-256',
    } as PluginJwkPair['privateJwk'];

    return { publicJwk, privateJwk };
};

export const createGeneratePluginKeypairHandler = () => (command: Envelope<Command>) => handler(command);
