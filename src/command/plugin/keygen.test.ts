import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, stat, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CompactEncrypt, compactDecrypt, importJWK } from 'jose';
import type { Envelope } from 'missive.js';
import { createGeneratePluginKeypairHandler } from '../../domain/use-cases/generate-plugin-keypair';

const CLI = path.resolve(import.meta.dir, '../../index.ts');

const runCli = (args: string[], cwd: string) => {
    return spawnSync('bun', [CLI, 'plugin', 'keygen', ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, LOG_LEVELS: 'no-output' },
    });
};

const b64urlLength = (value: string) => {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return Buffer.from(padded, 'base64').length;
};

let workDir: string;

beforeEach(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'crystallize-keygen-'));
});

afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
});

describe('plugin keygen', () => {
    test('default run writes two files with the required JWK fields', async () => {
        const result = runCli(['--out-dir', workDir, '-y'], workDir);
        expect(result.status).toBe(0);

        const publicJwk = JSON.parse(await readFile(path.join(workDir, 'public.jwk.json'), 'utf8'));
        const privateJwk = JSON.parse(await readFile(path.join(workDir, 'private.jwk.json'), 'utf8'));

        expect(publicJwk.kty).toBe('RSA');
        expect(publicJwk.use).toBe('enc');
        expect(publicJwk.alg).toBe('RSA-OAEP-256');
        expect(publicJwk.enc).toBe('A256GCM');
        expect(publicJwk.kid).toBe('public');
        expect(typeof publicJwk.n).toBe('string');
        expect(typeof publicJwk.e).toBe('string');

        expect(privateJwk.kty).toBe('RSA');
        expect(privateJwk.use).toBe('enc');
        expect(privateJwk.alg).toBe('RSA-OAEP-256');
        expect(privateJwk.kid).toBe('public');
        for (const field of ['n', 'e', 'd', 'p', 'q', 'dp', 'dq', 'qi']) {
            expect(typeof privateJwk[field]).toBe('string');
        }
    });

    test('--bits 3072 produces n decoding to 384 bytes and --bits 4096 produces 512 bytes', async () => {
        const dir3072 = await mkdtemp(path.join(tmpdir(), 'crystallize-keygen-3072-'));
        const dir4096 = await mkdtemp(path.join(tmpdir(), 'crystallize-keygen-4096-'));
        try {
            const r1 = runCli(['--bits', '3072', '--out-dir', dir3072, '-y'], dir3072);
            expect(r1.status).toBe(0);
            const pub3072 = JSON.parse(await readFile(path.join(dir3072, 'public.jwk.json'), 'utf8'));
            expect(b64urlLength(pub3072.n)).toBe(384);

            const r2 = runCli(['--bits', '4096', '--out-dir', dir4096, '-y'], dir4096);
            expect(r2.status).toBe(0);
            const pub4096 = JSON.parse(await readFile(path.join(dir4096, 'public.jwk.json'), 'utf8'));
            expect(b64urlLength(pub4096.n)).toBe(512);
        } finally {
            await rm(dir3072, { recursive: true, force: true });
            await rm(dir4096, { recursive: true, force: true });
        }
    }, 120_000);

    test('invalid --bits exits 2 with the expected message and writes no files', async () => {
        const result = runCli(['--bits', '1024', '--out-dir', workDir, '-y'], workDir);
        expect(result.status).toBe(2);
        const combined = (result.stdout ?? '') + (result.stderr ?? '');
        expect(combined).toContain('invalid --bits: 1024. must be one of 2048, 3072, 4096');
        await expect(stat(path.join(workDir, 'public.jwk.json'))).rejects.toThrow();
        await expect(stat(path.join(workDir, 'private.jwk.json'))).rejects.toThrow();
    });

    test('pre-existing output file without --force exits 3 and leaves the file untouched', async () => {
        const publicPath = path.join(workDir, 'public.jwk.json');
        const original = 'ORIGINAL CONTENT\n';
        await writeFile(publicPath, original);

        const result = runCli(['--out-dir', workDir, '-y'], workDir);
        expect(result.status).toBe(3);
        const after = await readFile(publicPath, 'utf8');
        expect(after).toBe(original);
    });

    test('--force overwrites successfully', async () => {
        const publicPath = path.join(workDir, 'public.jwk.json');
        await writeFile(publicPath, 'STALE\n');

        const result = runCli(['--out-dir', workDir, '--force', '-y'], workDir);
        expect(result.status).toBe(0);
        const after = JSON.parse(await readFile(publicPath, 'utf8'));
        expect(after.kty).toBe('RSA');
        expect(after.kid).toBe('public');
    });

    test('--stdout writes no files and emits a valid JSON document with both keys', async () => {
        const result = runCli(['--stdout'], workDir);
        expect(result.status).toBe(0);
        const parsed = JSON.parse(result.stdout);
        expect(parsed.public.kty).toBe('RSA');
        expect(parsed.public.alg).toBe('RSA-OAEP-256');
        expect(parsed.private.kty).toBe('RSA');
        expect(typeof parsed.private.d).toBe('string');
        await expect(stat(path.join(workDir, 'public.jwk.json'))).rejects.toThrow();
        await expect(stat(path.join(workDir, 'private.jwk.json'))).rejects.toThrow();
    });

    test('private.jwk.json is written with mode 0600 on Unix', async () => {
        if (process.platform === 'win32') return;
        const result = runCli(['--out-dir', workDir, '-y'], workDir);
        expect(result.status).toBe(0);
        const info = await stat(path.join(workDir, 'private.jwk.json'));
        // eslint-disable-next-line no-bitwise
        expect(info.mode & 0o777).toBe(0o600);
    });

    test('round-trip: encrypt with exported public JWK, decrypt with exported private JWK', async () => {
        const handler = createGeneratePluginKeypairHandler();
        const envelope = { message: { bits: 2048 as const, kid: 'public' } } as Envelope<{
            bits: 2048;
            kid: string;
        }>;
        const { publicJwk, privateJwk } = await handler(envelope);
        const pub = await importJWK(publicJwk, 'RSA-OAEP-256');
        const priv = await importJWK(privateJwk, 'RSA-OAEP-256');

        const plaintext = new TextEncoder().encode('hello-plugin-contract');
        const jwe = await new CompactEncrypt(plaintext)
            .setProtectedHeader({ alg: 'RSA-OAEP-256', enc: 'A256GCM', kid: 'public' })
            .encrypt(pub);

        const { plaintext: decrypted } = await compactDecrypt(jwe, priv);
        expect(new TextDecoder().decode(decrypted)).toBe('hello-plugin-contract');
    });

    test('.gitignore is updated with --yes and not touched without confirmation in non-tty mode', async () => {
        const repo = await mkdtemp(path.join(tmpdir(), 'crystallize-keygen-git-'));
        try {
            const gitInit = spawnSync('git', ['init', '-q'], { cwd: repo });
            expect(gitInit.status).toBe(0);
            const gitignorePath = path.join(repo, '.gitignore');
            const original = '# existing\nnode_modules\n';
            await writeFile(gitignorePath, original);

            const run1 = runCli(['--out-dir', repo, '-y'], repo);
            expect(run1.status).toBe(0);
            const afterYes = await readFile(gitignorePath, 'utf8');
            expect(afterYes).toContain('private.jwk.json');

            // reset fixture: remove the keys and reset .gitignore, then run WITHOUT --yes
            // in a non-TTY environment (spawn is non-TTY), the prompt must default to "no".
            await rm(path.join(repo, 'public.jwk.json'), { force: true });
            await chmod(path.join(repo, 'private.jwk.json'), 0o600).catch(() => {});
            await rm(path.join(repo, 'private.jwk.json'), { force: true });
            await writeFile(gitignorePath, original);

            const run2 = runCli(['--out-dir', repo], repo);
            expect(run2.status).toBe(0);
            const afterNoYes = await readFile(gitignorePath, 'utf8');
            expect(afterNoYes).toBe(original);
        } finally {
            await rm(repo, { recursive: true, force: true });
        }
    });
});
