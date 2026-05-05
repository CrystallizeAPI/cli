import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { JWK } from 'jose';

const CLI = path.resolve(import.meta.dir, '../../index.ts');

const runEncrypt = (args: string[], cwd: string, input?: string) => {
    return spawnSync('bun', [CLI, 'plugin', 'encrypt-secret', ...args], {
        cwd,
        encoding: 'utf8',
        input,
        env: { ...process.env, LOG_LEVELS: 'no-output' },
    });
};

const runDecrypt = (args: string[], cwd: string, input?: string) => {
    return spawnSync('bun', [CLI, 'plugin', 'decrypt-payload', ...args, '--json'], {
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

let workDir: string;

beforeEach(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'crystallize-encrypt-'));
    const keygen = runKeygen(['--out-dir', workDir, '-y'], workDir);
    expect(keygen.status).toBe(0);
});

afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
});

describe('plugin encrypt-secret', () => {
    test('missing public key file exits 2', () => {
        const result = runEncrypt(
            ['--public-key', path.join(workDir, 'nope.jwk.json'), '--value', 'sk_live_abc'],
            workDir,
        );
        expect(result.status).toBe(2);
    });

    test('rejects a private JWK (contains "d") with exit 2', () => {
        const result = runEncrypt(
            ['--public-key', path.join(workDir, 'private.jwk.json'), '--value', 'sk_live_abc'],
            workDir,
        );
        expect(result.status).toBe(2);
        expect(result.stderr).toContain('refusing to encrypt with a private key');
    });

    test('rejects a non-RSA JWK with exit 2', async () => {
        const badPath = path.join(workDir, 'oct.jwk.json');
        await writeFile(badPath, JSON.stringify({ kty: 'oct', k: 'AAAA', kid: 'x' }));
        const result = runEncrypt(['--public-key', badPath, '--value', 'sk_live_abc'], workDir);
        expect(result.status).toBe(2);
        expect(result.stderr).toContain('expected kty="RSA"');
    });

    test('empty value (no --value, empty stdin) exits 2', () => {
        const result = runEncrypt(['--public-key', path.join(workDir, 'public.jwk.json')], workDir, '');
        expect(result.status).toBe(2);
    });

    test('emits a JWE compact string (5 base64url parts)', () => {
        const result = runEncrypt(
            ['--public-key', path.join(workDir, 'public.jwk.json'), '--value', 'sk_live_abc'],
            workDir,
        );
        expect(result.status).toBe(0);
        const jwe = result.stdout.trim();
        expect(jwe.split('.')).toHaveLength(5);
    });

    test('round-trip: encrypt-secret output decrypts via plugin decrypt-payload to the same plaintext', () => {
        const value = 'sk_live_round_trip_42';
        const enc = runEncrypt(['--public-key', path.join(workDir, 'public.jwk.json'), '--value', value], workDir);
        expect(enc.status).toBe(0);
        const jwe = enc.stdout.trim();

        const dec = runDecrypt(['--private-key', path.join(workDir, 'private.jwk.json'), '--payload', jwe], workDir);
        expect(dec.status).toBe(0);
        const out = JSON.parse(dec.stdout);
        expect(out.plaintext).toBe(value);
    });

    test('reads value from piped stdin (trailing newline stripped)', () => {
        const value = 'piped_secret';
        const enc = runEncrypt(['--public-key', path.join(workDir, 'public.jwk.json')], workDir, value + '\n');
        expect(enc.status).toBe(0);
        const jwe = enc.stdout.trim();

        const dec = runDecrypt(['--private-key', path.join(workDir, 'private.jwk.json'), '--payload', jwe], workDir);
        expect(dec.status).toBe(0);
        const out = JSON.parse(dec.stdout);
        expect(out.plaintext).toBe(value);
    });

    test('protected header carries kid from the public JWK', async () => {
        const customDir = await mkdtemp(path.join(tmpdir(), 'crystallize-encrypt-kid-'));
        try {
            runKeygen(['--out-dir', customDir, '--kid', 'my-kid-1', '-y'], customDir);
            const enc = runEncrypt(
                ['--public-key', path.join(customDir, 'public.jwk.json'), '--value', 'x'],
                customDir,
            );
            expect(enc.status).toBe(0);
            const jwe = enc.stdout.trim();
            const headerB64 = jwe.split('.')[0]!;
            const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
            expect(header.alg).toBe('RSA-OAEP-256');
            expect(header.enc).toBe('A256GCM');
            expect(header.kid).toBe('my-kid-1');

            const publicJwk: JWK = JSON.parse(await readFile(path.join(customDir, 'public.jwk.json'), 'utf8'));
            expect(publicJwk.kid).toBe('my-kid-1');
        } finally {
            await rm(customDir, { recursive: true, force: true });
        }
    });
});
