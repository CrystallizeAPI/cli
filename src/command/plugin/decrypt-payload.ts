import { Command, Option } from 'commander';
import { createInterface } from 'node:readline/promises';
import pc from 'picocolors';
import { createPluginPayloadDecrypter, type DecryptedPluginPayload } from '@crystallize/js-api-client';
import type { JSONWebKeySet, JWK } from 'jose';
import type { Logger } from '../../domain/contracts/logger';
import type { FlySystem } from '../../domain/contracts/fly-system';

type Deps = {
    logger: Logger;
    flySystem: FlySystem;
    crystallizeEnvironment: 'staging' | 'production';
};

const CRYSTALLIZE_ENV_DEFAULTS: Record<'staging' | 'production', { jwksUrl: string; issuer: string }> = {
    production: {
        jwksUrl: 'https://api.crystallize.com/.well-known/jwks.json',
        issuer: 'https://api.crystallize.com',
    },
    staging: {
        jwksUrl: 'https://api-dev.crystallize.digital/.well-known/jwks.json',
        issuer: 'https://api-dev.crystallize.digital',
    },
};

type Flags = {
    privateKey: string;
    payload?: string;
    jwksUrl?: string;
    jwksFile?: string;
    issuer?: string;
    audience?: string;
    clockTolerance: string;
    verifyBackendToken?: boolean;
    json?: boolean;
    verbose?: boolean;
};

const EXIT_INVALID_FLAGS = 2;
const EXIT_DECRYPT = 5;

const fail = (logger: Logger, code: number, message: string): never => {
    process.stderr.write(pc.red('✖ ') + message + '\n');
    logger.flush();
    process.exit(code);
};

const readFromStdin = async (isTty: boolean, logger: Logger): Promise<string> => {
    if (isTty) {
        logger.info('paste the JWE compact payload (single line), then press Enter:');
        const rl = createInterface({ input: process.stdin, output: process.stderr });
        try {
            const line = await rl.question('> ');
            return line.trim();
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
        .trim();
};

const looksLikeCompactJwe = (value: string): boolean => value.split('.').length === 5;

const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return pc.dim('—');
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value);
};

const renderSection = (write: (s: string) => void, title: string, status: string | null, rows: [string, unknown][]) => {
    if (rows.length === 0) return;
    write('');
    write(pc.bold(pc.cyan(`[${title}]`)) + (status ? ' ' + status : ''));
    const width = Math.max(...rows.map(([k]) => k.length));
    for (const [k, v] of rows) {
        write(`  ${pc.green(k.padEnd(width))}  ${formatValue(v)}`);
    }
};

const renderLean = (d: DecryptedPluginPayload): void => {
    const write = (s: string) => process.stdout.write(s + '\n');

    const secrets = Object.entries(d.secrets);
    renderSection(write, 'Secrets', null, secrets);

    const config = d.envelope?.config;
    renderSection(
        write,
        'Configuration',
        null,
        config && typeof config === 'object' && !Array.isArray(config) ? Object.entries(config) : [],
    );

    const context = d.envelope?.entityContext;
    renderSection(
        write,
        'Context',
        null,
        context && typeof context === 'object' && !Array.isArray(context) ? Object.entries(context) : [],
    );

    if (d.backendToken) {
        const status = d.backendToken.verified
            ? pc.green('(verified)')
            : d.backendToken.skipped
              ? pc.dim('(not verified)')
              : pc.red('(verification FAILED)');
        const claims = (d.backendToken.claims ?? {}) as Record<string, unknown>;
        const keys = ['sub', 'aud', 'iss', 'iat', 'nbf', 'exp', 'jti', 'act'] as const;
        const rows: [string, unknown][] = keys.filter((k) => k in claims).map((k) => [k, claims[k]]);
        renderSection(write, 'Token', status, rows);
    }

    if (d.envelope === null && d.plaintext !== null) {
        write('');
        write(pc.bold(pc.cyan('[Plaintext]')));
        write(`  ${d.plaintext}`);
    }
};

export const createPluginDecryptPayloadCommand = ({ logger, flySystem, crystallizeEnvironment }: Deps): Command => {
    const envDefaults = CRYSTALLIZE_ENV_DEFAULTS[crystallizeEnvironment];
    const command = new Command('decrypt-payload');
    command.description(
        'Decrypt and verify a Crystallize plugin JWE payload (outer JWE → nested JWS → per-field secrets).',
    );
    command.addOption(
        new Option(
            '--private-key <path>',
            'Path to the vendor private JWK file (as produced by `plugin keygen`).',
        ).makeOptionMandatory(true),
    );
    command.addOption(
        new Option(
            '--payload <string>',
            'JWE compact payload to decrypt. If omitted, the payload is read from stdin (interactive paste or pipe).',
        ),
    );
    command.addOption(
        new Option(
            '--jwks-url <url>',
            `Crystallize JWKS URL. Default derived from ${pc.cyan('CRYSTALLIZE_ENVIRONMENT')} (${crystallizeEnvironment}).`,
        ).default(envDefaults.jwksUrl),
    );
    command.addOption(
        new Option(
            '--jwks-file <path>',
            'Path to a local JWKS file ({"keys":[...]}) — useful offline or on local dev. Overrides --jwks-url.',
        ),
    );
    command.addOption(
        new Option(
            '--issuer <url>',
            `Expected JWT "iss" (Crystallize Core base URL). Default derived from ${pc.cyan('CRYSTALLIZE_ENVIRONMENT')} (${crystallizeEnvironment}).`,
        ).default(envDefaults.issuer),
    );
    command.addOption(
        new Option(
            '--audience <id>',
            'Expected JWT "aud" (your plugin identifier, reverse-DNS). Providing it turns on signature verification.',
        ),
    );
    command.addOption(new Option('--clock-tolerance <seconds>', 'Clock tolerance for iat/nbf/exp.').default('30'));
    command.addOption(
        new Option('--verify-backend-token', 'Also verify envelope.backendToken against the same JWKS.').default(false),
    );
    command.addOption(
        new Option(
            '--json',
            'Emit the full structured JSON document (protectedHeader, innerProtectedHeader, envelope, secrets, signature, backendToken) instead of the lean human view.',
        ).default(false),
    );
    command.addOption(
        new Option('-v, --verbose', 'Also print protected headers and the "no applicable key" hint on stderr.').default(
            false,
        ),
    );

    command.addHelpText(
        'after',
        `
${pc.bold('What this command does (§ reference to the plugin payload protocol):')}
  1. Decrypt the outer JWE with the vendor private JWK (${pc.cyan('RSA-OAEP-256 / A256GCM')} allow-list).
  2. If the outer header carries ${pc.cyan('cty: "JWT"')}, verify the inner JWS against the supplied JWKS,
     enforcing ${pc.cyan('issuer')}, ${pc.cyan('audience')}, ${pc.cyan('RS256')}, and a clock tolerance window.
  3. Decrypt each per-field ciphertext in ${pc.cyan('envelope.encryptedSecrets')} with the same private key.
  4. Optionally verify ${pc.cyan('envelope.backendToken')} (--verify-backend-token).
  5. Print a lean summary (${pc.cyan('[Secrets]')} / ${pc.cyan('[Configuration]')} / ${pc.cyan('[Context]')} / ${pc.cyan('[Token]')})
     to stdout. Use ${pc.cyan('--json')} for a full structured document (suitable for ${pc.cyan('jq')}),
     and ${pc.cyan('-v/--verbose')} to surface protected headers and the "no applicable key" hint.

${pc.bold('Enabling verification:')}
  Pass ${pc.cyan('--audience <your-plugin-id>')}. The JWKS URL and issuer default from the env above;
  override either with ${pc.cyan('--jwks-url')} / ${pc.cyan('--jwks-file')} / ${pc.cyan('--issuer')} if you're pointing at a mock.

${pc.bold('Signature failures are NOT fatal:')}
  When --jwks-url is set and verification fails (e.g. running against a mock issuer on local dev), the
  envelope is still decoded and secrets still decrypted, with ${pc.cyan('signature.verified = false')} and the
  failure reason. Treat the envelope as untrusted in that case.

${pc.bold('Security:')}
  The emitted JSON contains decrypted secrets in cleartext. Never paste or redirect it to shared logs.

${pc.bold('Examples:')}
  # decrypt only (no signature check):
  $ crystallize plugin decrypt-payload --private-key ./private.jwk.json --payload "$JWE"

  # full protocol against production (env-derived JWKS + issuer):
  $ crystallize plugin decrypt-payload \\
      --private-key ./private.jwk.json \\
      --audience com.vendor.plugin \\
      --verify-backend-token < payload.txt
`,
    );

    command.action(async (flags: Flags) => {
        if (!flags.privateKey || flags.privateKey.trim().length === 0) {
            fail(logger, EXIT_INVALID_FLAGS, 'invalid --private-key: path is required');
            return;
        }
        if (!(await flySystem.isFileExists(flags.privateKey))) {
            fail(logger, EXIT_INVALID_FLAGS, `private key file not found: ${flags.privateKey}`);
            return;
        }

        let privateJwk: Record<string, unknown>;
        try {
            privateJwk = await flySystem.loadJsonFile<Record<string, unknown>>(flags.privateKey);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            fail(logger, EXIT_INVALID_FLAGS, `failed to parse ${flags.privateKey} as JSON: ${message}`);
            return;
        }
        if (privateJwk.kty !== 'RSA') {
            fail(
                logger,
                EXIT_INVALID_FLAGS,
                `invalid private JWK: expected kty="RSA", got kty=${JSON.stringify(privateJwk.kty)}`,
            );
            return;
        }
        if (typeof privateJwk.d !== 'string') {
            fail(logger, EXIT_INVALID_FLAGS, 'invalid private JWK: missing "d" (not a private key)');
            return;
        }
        if (privateJwk.alg && privateJwk.alg !== 'RSA-OAEP-256' && privateJwk.alg !== 'RSA-OAEP') {
            logger.warn(
                `private JWK alg=${JSON.stringify(privateJwk.alg)} is outside the Crystallize contract (expected RSA-OAEP-256).`,
            );
        }

        const hasVerify = Boolean(flags.audience);
        if (flags.verifyBackendToken && !hasVerify) {
            fail(logger, EXIT_INVALID_FLAGS, '--verify-backend-token requires --audience to enable verification.');
            return;
        }

        let jwksInline: Record<string, unknown> | undefined;
        if (flags.jwksFile) {
            if (!(await flySystem.isFileExists(flags.jwksFile))) {
                fail(logger, EXIT_INVALID_FLAGS, `JWKS file not found: ${flags.jwksFile}`);
                return;
            }
            try {
                jwksInline = await flySystem.loadJsonFile<Record<string, unknown>>(flags.jwksFile);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                fail(logger, EXIT_INVALID_FLAGS, `failed to parse ${flags.jwksFile} as JSON: ${message}`);
                return;
            }
            if (!Array.isArray((jwksInline as { keys?: unknown }).keys)) {
                fail(logger, EXIT_INVALID_FLAGS, `invalid JWKS file: expected a JSON object with "keys" array.`);
                return;
            }
        }
        const clockTolerance = Number(flags.clockTolerance);
        if (!Number.isInteger(clockTolerance) || clockTolerance < 0) {
            fail(
                logger,
                EXIT_INVALID_FLAGS,
                `invalid --clock-tolerance: ${flags.clockTolerance}. must be a non-negative integer (seconds).`,
            );
            return;
        }

        const payload = flags.payload?.trim() ?? (await readFromStdin(Boolean(process.stdin.isTTY), logger));
        if (!payload) {
            fail(logger, EXIT_INVALID_FLAGS, 'no payload provided. use --payload, pipe stdin, or paste when prompted.');
            return;
        }
        if (!looksLikeCompactJwe(payload)) {
            fail(
                logger,
                EXIT_INVALID_FLAGS,
                'payload does not look like a JWE compact string (expected 5 base64url parts separated by ".").',
            );
            return;
        }

        const verify = hasVerify
            ? {
                  // --jwks-file overrides --jwks-url (even the env-default one). `jwks` takes precedence over `jwksUrl` in the lib.
                  jwks: jwksInline as JSONWebKeySet | undefined,
                  jwksUrl: flags.jwksFile ? undefined : flags.jwksUrl,
                  issuer: flags.issuer!,
                  audience: flags.audience!,
                  clockTolerance,
                  verifyBackendToken: Boolean(flags.verifyBackendToken),
              }
            : undefined;

        const decrypt = createPluginPayloadDecrypter({ privateJwk: privateJwk as unknown as JWK, verify });

        let decrypted: DecryptedPluginPayload;
        try {
            decrypted = await decrypt(payload);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            fail(logger, EXIT_DECRYPT, `failed to decrypt payload: ${message}`);
            return;
        }

        const errLine = (msg: string) => process.stderr.write(msg + '\n');

        if (decrypted.signature.verified) {
            errLine(pc.green('✔ ') + 'signature verified');
        } else if (decrypted.signature.skipped) {
            if (flags.verbose) {
                errLine(pc.yellow('⚠ ') + `signature not verified: ${decrypted.signature.reason}`);
            }
        } else {
            errLine(pc.red('✖ ') + `signature FAILED: ${decrypted.signature.reason}`);
            if (flags.verbose && decrypted.innerProtectedHeader) {
                const h = decrypted.innerProtectedHeader;
                errLine(
                    pc.dim(
                        `  inner JWS header: kid=${JSON.stringify(h.kid)}, alg=${JSON.stringify(h.alg)} — compare with JWKS at ${flags.jwksFile ?? flags.jwksUrl}`,
                    ),
                );
                if (decrypted.signature.reason?.includes('no applicable key')) {
                    errLine(
                        pc.dim(
                            '  hint: "no applicable key" means the JWKS was loaded but no key matches the JWT header.',
                        ),
                    );
                }
                errLine(pc.dim('  envelope claims decoded without trust.'));
            }
        }

        if (flags.verbose) {
            if (hasVerify) {
                const source = flags.jwksFile
                    ? `file ${flags.jwksFile}`
                    : `url ${flags.jwksUrl} (env=${crystallizeEnvironment})`;
                errLine(pc.dim(`  verifying against ${source}, issuer=${flags.issuer}, audience=${flags.audience}`));
            }
            errLine(pc.dim(`  outer JWE header: ${JSON.stringify(decrypted.protectedHeader)}`));
            if (decrypted.innerProtectedHeader) {
                errLine(pc.dim(`  inner JWS header: ${JSON.stringify(decrypted.innerProtectedHeader)}`));
            }
        }

        if (flags.json) {
            process.stdout.write(JSON.stringify(decrypted, null, 2) + '\n');
            return;
        }

        renderLean(decrypted);
    });

    return command;
};
