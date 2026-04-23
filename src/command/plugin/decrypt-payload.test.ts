import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CompactEncrypt, SignJWT, exportJWK, generateKeyPair, importJWK, type JWK, type KeyLike } from 'jose';

const CLI = path.resolve(import.meta.dir, '../../index.ts');

const runDecrypt = (args: string[], cwd: string, input?: string) => {
    return spawnSync('bun', [CLI, 'plugin', 'decrypt-payload', ...args, '--json'], {
        cwd,
        encoding: 'utf8',
        input,
        env: { ...process.env, LOG_LEVELS: 'no-output' },
    });
};

const runDecryptLean = (args: string[], cwd: string, input?: string) => {
    return spawnSync('bun', [CLI, 'plugin', 'decrypt-payload', ...args], {
        cwd,
        encoding: 'utf8',
        input,
        env: { ...process.env, LOG_LEVELS: 'no-output' },
    });
};

const runKeygen = (args: string[], cwd: string) => {
    return spawnSync('bun', [CLI, 'plugin', 'keygen', ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, LOG_LEVELS: 'no-output' },
    });
};

const loadVendorKeys = async (dir: string): Promise<{ publicJwk: JWK; privateJwk: JWK }> => {
    return {
        publicJwk: JSON.parse(await readFile(path.join(dir, 'public.jwk.json'), 'utf8')),
        privateJwk: JSON.parse(await readFile(path.join(dir, 'private.jwk.json'), 'utf8')),
    };
};

const encryptBytesForVendor = async (publicJwk: JWK, plaintext: Uint8Array, cty?: string) => {
    const key = await importJWK(publicJwk, 'RSA-OAEP-256');
    const header: Record<string, unknown> = {
        alg: 'RSA-OAEP-256',
        enc: 'A256GCM',
        kid: publicJwk.kid,
    };
    if (cty) header.cty = cty;
    return new CompactEncrypt(plaintext).setProtectedHeader(header as never).encrypt(key);
};

type Issuer = {
    jwksFilePath: string;
    issuer: string;
    signer: KeyLike;
    kid: string;
};

const makeJwksIssuer = async (dir: string): Promise<Issuer> => {
    const { publicKey, privateKey } = await generateKeyPair('RS256', { modulusLength: 2048, extractable: true });
    const publicJwk = { ...(await exportJWK(publicKey)), kid: 'core-sign-1', use: 'sig', alg: 'RS256' };
    const jwksFilePath = path.join(dir, 'jwks.json');
    await writeFile(jwksFilePath, JSON.stringify({ keys: [publicJwk] }));
    return {
        jwksFilePath,
        issuer: 'https://api.crystallize.example',
        signer: privateKey as KeyLike,
        kid: 'core-sign-1',
    };
};

const buildProtocolPayload = async (args: {
    vendorPublic: JWK;
    issuer: Issuer;
    audience: string;
    envelopeExtras?: Record<string, unknown>;
    secretsPlain?: Record<string, string>;
    backendTokenExtras?: Record<string, unknown>;
    expiresInSeconds?: number;
}) => {
    const {
        vendorPublic,
        issuer,
        audience,
        envelopeExtras = {},
        secretsPlain = {},
        backendTokenExtras,
        expiresInSeconds = 300,
    } = args;

    const encryptedSecrets: Record<string, string> = {};
    for (const [field, value] of Object.entries(secretsPlain)) {
        encryptedSecrets[field] = await encryptBytesForVendor(vendorPublic, new TextEncoder().encode(value));
    }

    const now = Math.floor(Date.now() / 1000);

    let backendToken: string | undefined;
    if (backendTokenExtras) {
        backendToken = await new SignJWT({ ...backendTokenExtras })
            .setProtectedHeader({ alg: 'RS256', kid: issuer.kid })
            .setIssuer(issuer.issuer)
            .setAudience(audience)
            .setSubject('user-123')
            .setIssuedAt(now)
            .setNotBefore(now - 1)
            .setExpirationTime(now + expiresInSeconds)
            .setJti(crypto.randomUUID())
            .sign(issuer.signer);
    }

    const envelopeClaims: Record<string, unknown> = {
        installationId: 'inst-1',
        tenantIdentifier: 'acme',
        pluginIdentifier: audience,
        revisionId: 'rev-1',
        config: { brand: 'Acme' },
        encryptedSecrets,
        ...envelopeExtras,
    };
    if (backendToken) envelopeClaims.backendToken = backendToken;

    const innerJwt = await new SignJWT(envelopeClaims)
        .setProtectedHeader({ alg: 'RS256', kid: issuer.kid })
        .setIssuer(issuer.issuer)
        .setAudience(audience)
        .setSubject('user-123')
        .setIssuedAt(now)
        .setNotBefore(now - 1)
        .setExpirationTime(now + expiresInSeconds)
        .setJti(crypto.randomUUID())
        .sign(issuer.signer);

    return encryptBytesForVendor(vendorPublic, new TextEncoder().encode(innerJwt), 'JWT');
};

let workDir: string;
let issuer: Issuer;

beforeEach(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'crystallize-decrypt-'));
    const keygen = runKeygen(['--out-dir', workDir, '-y'], workDir);
    expect(keygen.status).toBe(0);
    issuer = await makeJwksIssuer(workDir);
});

afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
});

describe('plugin decrypt-payload', () => {
    test('missing private key file exits 2', () => {
        const result = runDecrypt(
            ['--private-key', path.join(workDir, 'nope.jwk.json'), '--payload', 'a.b.c.d.e'],
            workDir,
        );
        expect(result.status).toBe(2);
    });

    test('rejects a payload that is not a JWE compact string with exit 2', () => {
        const result = runDecrypt(
            ['--private-key', path.join(workDir, 'private.jwk.json'), '--payload', 'not-a-jwe'],
            workDir,
        );
        expect(result.status).toBe(2);
    });

    test('rejects a public-only JWK (missing "d") with exit 2', async () => {
        const publicOnlyPath = path.join(workDir, 'public-only.jwk.json');
        await writeFile(publicOnlyPath, await readFile(path.join(workDir, 'public.jwk.json'), 'utf8'));
        const { publicJwk } = await loadVendorKeys(workDir);
        const jwe = await encryptBytesForVendor(publicJwk, new TextEncoder().encode('x'));
        const result = runDecrypt(['--private-key', publicOnlyPath, '--payload', jwe], workDir);
        expect(result.status).toBe(2);
    });

    test('--verify-backend-token without --audience exits 2', () => {
        const result = runDecrypt(
            [
                '--private-key',
                path.join(workDir, 'private.jwk.json'),
                '--verify-backend-token',
                '--payload',
                'a.b.c.d.e',
            ],
            workDir,
        );
        expect(result.status).toBe(2);
    });

    test('CRYSTALLIZE_ENVIRONMENT=staging derives the staging issuer default', () => {
        const result = spawnSync('bun', [CLI, 'plugin', 'decrypt-payload', '--help'], {
            cwd: workDir,
            encoding: 'utf8',
            env: { ...process.env, CRYSTALLIZE_ENVIRONMENT: 'staging', LOG_LEVELS: 'no-output' },
        });
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('api-dev.crystallize.digital');
    });

    test('CRYSTALLIZE_ENVIRONMENT=production derives the production issuer default', () => {
        const result = spawnSync('bun', [CLI, 'plugin', 'decrypt-payload', '--help'], {
            cwd: workDir,
            encoding: 'utf8',
            env: { ...process.env, CRYSTALLIZE_ENVIRONMENT: 'production', LOG_LEVELS: 'no-output' },
        });
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('api.crystallize.com');
    });

    test('full protocol: decrypts envelope, verifies inner JWS, and decrypts per-field secrets', async () => {
        const { publicJwk } = await loadVendorKeys(workDir);
        const audience = 'com.vendor.test';
        const jwe = await buildProtocolPayload({
            vendorPublic: publicJwk,
            issuer,
            audience,
            secretsPlain: { StripeApiKey: 'sk_live_abc', WebhookSecret: 'whsec_def' },
            envelopeExtras: { entityContext: { orderId: 'ord-42' } },
        });
        const result = runDecrypt(
            [
                '--private-key',
                path.join(workDir, 'private.jwk.json'),
                '--jwks-file',
                issuer.jwksFilePath,
                '--issuer',
                issuer.issuer,
                '--audience',
                audience,
                '--payload',
                jwe,
            ],
            workDir,
        );
        expect(result.status).toBe(0);
        const out = JSON.parse(result.stdout);
        expect(out.protectedHeader.cty).toBe('JWT');
        expect(out.signature).toEqual({
            verified: true,
            issuer: issuer.issuer,
            audience,
            algorithm: 'RS256',
        });
        expect(out.envelope.iss).toBe(issuer.issuer);
        expect(out.envelope.aud).toBe(audience);
        expect(out.envelope.installationId).toBe('inst-1');
        expect(out.envelope.tenantIdentifier).toBe('acme');
        expect(out.envelope.entityContext).toEqual({ orderId: 'ord-42' });
        expect(out.secrets).toEqual({ StripeApiKey: 'sk_live_abc', WebhookSecret: 'whsec_def' });
        expect(out.plaintext).toBeNull();
    });

    test('lean default output has [Secrets] / [Configuration] / [Context] / [Token] sections — no JSON, no headers', async () => {
        const { publicJwk } = await loadVendorKeys(workDir);
        const audience = 'com.vendor.test';
        const jwe = await buildProtocolPayload({
            vendorPublic: publicJwk,
            issuer,
            audience,
            secretsPlain: { StripeApiKey: 'sk_live_abc' },
            envelopeExtras: { entityContext: { orderId: 'ord-42' } },
            backendTokenExtras: { act: { pluginIdentifier: audience } },
        });
        const result = runDecryptLean(
            [
                '--private-key',
                path.join(workDir, 'private.jwk.json'),
                '--jwks-file',
                issuer.jwksFilePath,
                '--issuer',
                issuer.issuer,
                '--audience',
                audience,
                '--verify-backend-token',
                '--payload',
                jwe,
            ],
            workDir,
        );
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('[Secrets]');
        expect(result.stdout).toContain('StripeApiKey');
        expect(result.stdout).toContain('sk_live_abc');
        expect(result.stdout).toContain('[Configuration]');
        expect(result.stdout).toContain('brand');
        expect(result.stdout).toContain('[Context]');
        expect(result.stdout).toContain('orderId');
        expect(result.stdout).toContain('[Token]');
        // No JSON doc, no protected headers in lean mode.
        expect(result.stdout).not.toContain('"protectedHeader"');
        expect(result.stdout).not.toContain('"innerProtectedHeader"');
        expect(result.stderr).not.toContain('outer JWE header');
    });

    test('--json flag still emits the structured document', async () => {
        const { publicJwk } = await loadVendorKeys(workDir);
        const jwe = await encryptBytesForVendor(publicJwk, new TextEncoder().encode('hello'));
        const result = runDecrypt(['--private-key', path.join(workDir, 'private.jwk.json'), '--payload', jwe], workDir);
        expect(result.status).toBe(0);
        const out = JSON.parse(result.stdout);
        expect(out.protectedHeader).toBeDefined();
        expect(out.plaintext).toBe('hello');
    });

    test('reads payload from piped stdin', async () => {
        const { publicJwk } = await loadVendorKeys(workDir);
        const jwe = await encryptBytesForVendor(publicJwk, new TextEncoder().encode('piped'));
        const result = runDecrypt(['--private-key', path.join(workDir, 'private.jwk.json')], workDir, jwe);
        expect(result.status).toBe(0);
        const out = JSON.parse(result.stdout);
        expect(out.plaintext).toBe('piped');
    });

    test('decryption failure (wrong vendor key) exits 5', async () => {
        const other = await mkdtemp(path.join(tmpdir(), 'crystallize-decrypt-other-'));
        try {
            runKeygen(['--out-dir', other, '-y'], other);
            const { publicJwk } = await loadVendorKeys(workDir);
            const jwe = await encryptBytesForVendor(publicJwk, new TextEncoder().encode('x'));
            const result = runDecrypt(
                ['--private-key', path.join(other, 'private.jwk.json'), '--payload', jwe],
                workDir,
            );
            expect(result.status).toBe(5);
        } finally {
            await rm(other, { recursive: true, force: true });
        }
    });
});
