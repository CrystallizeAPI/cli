import { Command, Option } from 'commander';
import { createInterface } from 'node:readline/promises';
import pc from 'picocolors';
import { CompactEncrypt, importJWK, type JWK } from 'jose';
import type { Logger } from '../../domain/contracts/logger';
import type { FlySystem } from '../../domain/contracts/fly-system';

type Deps = {
    logger: Logger;
    flySystem: FlySystem;
};

type Flags = {
    publicKey: string;
    value?: string;
};

const EXIT_INVALID_FLAGS = 2;
const EXIT_ENCRYPT = 6;

const fail = (logger: Logger, code: number, message: string): never => {
    process.stderr.write(pc.red('✖ ') + message + '\n');
    logger.flush();
    process.exit(code);
};

const readFromStdin = async (isTty: boolean, logger: Logger): Promise<string> => {
    if (isTty) {
        logger.info('paste the secret value (single line), then press Enter:');
        const rl = createInterface({ input: process.stdin, output: process.stderr });
        try {
            const line = await rl.question('> ');
            return line;
        } finally {
            rl.close();
        }
    }
    const chunks: Uint8Array[] = [];
    for await (const chunk of process.stdin) {
        chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : (chunk as Uint8Array));
    }
    return Buffer.concat(chunks as unknown as Uint8Array[])
        .toString('utf8')
        .replace(/\r?\n+$/, '');
};

export const createPluginEncryptSecretCommand = ({ logger, flySystem }: Deps): Command => {
    const command = new Command('encrypt-secret');
    command.description(
        'Encrypt a single secret value with a vendor public JWK (RSA-OAEP-256 / A256GCM), producing a compact JWE.',
    );
    command.addOption(
        new Option(
            '--public-key <path>',
            'Path to the vendor public JWK file (as produced by `plugin keygen`).',
        ).makeOptionMandatory(true),
    );
    command.addOption(
        new Option(
            '--value <string>',
            'Plaintext value to encrypt. If omitted, the value is read from stdin (interactive paste or pipe). When read from stdin, a single trailing newline is stripped.',
        ),
    );

    command.addHelpText(
        'after',
        `
${pc.bold('What this command does:')}
  Encrypts the given value to the vendor public JWK with ${pc.cyan('RSA-OAEP-256')} / ${pc.cyan('A256GCM')},
  producing a compact JWE on stdout — the same shape Crystallize's UI would produce for a single
  ${pc.cyan('envelope.encryptedSecrets[fieldName]')} entry. Useful for local dev / testing where the
  UI is not in the loop.

${pc.bold('Round-trip:')}
  The output of this command can be fed back to ${pc.cyan('plugin decrypt-payload')} (with the matching
  private JWK) to verify the value, or stitched into a hand-rolled plugin payload.

${pc.bold('Security:')}
  The plaintext is read from a flag, an interactive prompt, or stdin — never persist it to shared
  shell history or logs. Pass via stdin (${pc.cyan('printf %s "$SECRET" | crystallize ...')}) when in doubt.

${pc.bold('Examples:')}
  $ crystallize plugin encrypt-secret --public-key ./public.jwk.json --value sk_live_abc
  $ printf '%s' "$SECRET" | crystallize plugin encrypt-secret --public-key ./public.jwk.json
`,
    );

    command.action(async (flags: Flags) => {
        if (!flags.publicKey || flags.publicKey.trim().length === 0) {
            fail(logger, EXIT_INVALID_FLAGS, 'invalid --public-key: path is required');
            return;
        }
        if (!(await flySystem.isFileExists(flags.publicKey))) {
            fail(logger, EXIT_INVALID_FLAGS, `public key file not found: ${flags.publicKey}`);
            return;
        }

        let publicJwk: Record<string, unknown>;
        try {
            publicJwk = await flySystem.loadJsonFile<Record<string, unknown>>(flags.publicKey);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            fail(logger, EXIT_INVALID_FLAGS, `failed to parse ${flags.publicKey} as JSON: ${message}`);
            return;
        }
        if (publicJwk.kty !== 'RSA') {
            fail(
                logger,
                EXIT_INVALID_FLAGS,
                `invalid public JWK: expected kty="RSA", got kty=${JSON.stringify(publicJwk.kty)}`,
            );
            return;
        }
        if (typeof publicJwk.d === 'string') {
            fail(
                logger,
                EXIT_INVALID_FLAGS,
                'invalid public JWK: contains "d" — refusing to encrypt with a private key. pass the public JWK only.',
            );
            return;
        }
        if (publicJwk.alg && publicJwk.alg !== 'RSA-OAEP-256' && publicJwk.alg !== 'RSA-OAEP') {
            logger.warn(
                `public JWK alg=${JSON.stringify(publicJwk.alg)} is outside the Crystallize contract (expected RSA-OAEP-256).`,
            );
        }

        const value = flags.value ?? (await readFromStdin(Boolean(process.stdin.isTTY), logger));
        if (value === undefined || value === null || value.length === 0) {
            fail(logger, EXIT_INVALID_FLAGS, 'no value provided. use --value, pipe stdin, or paste when prompted.');
            return;
        }

        let key: Awaited<ReturnType<typeof importJWK>>;
        try {
            key = await importJWK(publicJwk as unknown as JWK, 'RSA-OAEP-256');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            fail(logger, EXIT_INVALID_FLAGS, `failed to import public JWK: ${message}`);
            return;
        }

        let jwe: string;
        try {
            const header: Record<string, unknown> = {
                alg: 'RSA-OAEP-256',
                enc: 'A256GCM',
            };
            if (typeof publicJwk.kid === 'string' && publicJwk.kid.length > 0) {
                header.kid = publicJwk.kid;
            }
            jwe = await new CompactEncrypt(new TextEncoder().encode(value))
                .setProtectedHeader(header as never)
                .encrypt(key);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            fail(logger, EXIT_ENCRYPT, `failed to encrypt value: ${message}`);
            return;
        }

        process.stdout.write(jwe + '\n');
    });

    return command;
};
