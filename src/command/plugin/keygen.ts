import { Command, Option } from 'commander';
import path from 'node:path';
import { chmod, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import pc from 'picocolors';
import type { Logger } from '../../domain/contracts/logger';
import type { FlySystem } from '../../domain/contracts/fly-system';
import type { CommandBus } from '../../domain/contracts/bus';
import { ALLOWED_BITS, type AllowedBits } from '../../domain/use-cases/generate-plugin-keypair';

type Deps = {
    logger: Logger;
    flySystem: FlySystem;
    commandBus: CommandBus;
};

type Flags = {
    bits: string;
    kid: string;
    outDir?: string;
    publicOut?: string;
    privateOut?: string;
    stdout?: boolean;
    publicOnly?: boolean;
    force?: boolean;
    yes?: boolean;
};

const EXIT_INVALID_FLAGS = 2;
const EXIT_FILE_EXISTS = 3;
const EXIT_IO = 4;

const fail = (logger: Logger, code: number, message: string): never => {
    logger.error(message);
    logger.flush();
    process.exit(code);
};

const promptYesNo = async (question: string): Promise<boolean> => {
    if (!process.stdin.isTTY) {
        return false;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
        const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
        return answer === 'y' || answer === 'yes';
    } finally {
        rl.close();
    }
};

const findGitRoot = (cwd: string): string | null => {
    const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (result.status !== 0) return null;
    const output = result.stdout.trim();
    return output.length > 0 ? output : null;
};

const gitignoreContains = (content: string, name: string): boolean => {
    return content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .some((line) => line === name || line === `/${name}` || line === `./${name}`);
};

export const createPluginKeygenCommand = ({ logger, flySystem, commandBus }: Deps): Command => {
    const command = new Command('keygen');
    command.description('Generate an RSA JWK keypair for a Crystallize plugin revision.');
    command.addOption(new Option('--bits <n>', 'RSA modulus length (one of 2048, 3072, 4096).').default('2048'));
    command.addOption(new Option('--kid <string>', 'Key identifier (non-empty string).').default('public'));
    command.addOption(new Option('--out-dir <dir>', 'Output directory (defaults to the current working directory).'));
    command.addOption(new Option('--public-out <path>', 'Path for the public JWK file. Overrides --out-dir.'));
    command.addOption(new Option('--private-out <path>', 'Path for the private JWK file. Overrides --out-dir.'));
    command.addOption(
        new Option(
            '--stdout',
            'Print both JWKs to stdout as {"public":{...},"private":{...}}. Writes no files.',
        ).default(false),
    );
    command.addOption(
        new Option('--public-only', 'Write / print only the public JWK. Private key is discarded.').default(false),
    );
    command.addOption(new Option('-f, --force', 'Overwrite existing output files.').default(false));
    command.addOption(new Option('-y, --yes', 'Skip all confirmation prompts (suitable for CI).').default(false));

    command.addHelpText(
        'after',
        `
${pc.bold('About the keys:')}
  Algorithm is fixed to RSA-OAEP-256 with A256GCM content encryption (JWE).
  The public JWK is embedded in ${pc.cyan('createPluginRevision')} (paste its contents into the mutation).
  The private JWK must stay on the vendor backend and must never be committed.

${pc.bold('Examples:')}
  $ crystallize plugin keygen
  $ crystallize plugin keygen --bits 4096 --kid my-plugin-key --out-dir ./keys
  $ crystallize plugin keygen --stdout
`,
    );

    command.action(async (rawFlags: Flags) => {
        const flags = rawFlags;
        const bitsParsed = Number(flags.bits);

        if (!Number.isInteger(bitsParsed) || !ALLOWED_BITS.includes(bitsParsed as AllowedBits)) {
            fail(
                logger,
                EXIT_INVALID_FLAGS,
                `invalid --bits: ${flags.bits}. must be one of ${ALLOWED_BITS.join(', ')}`,
            );
        }
        const bits = bitsParsed as AllowedBits;

        if (!flags.kid || flags.kid.trim().length === 0) {
            fail(logger, EXIT_INVALID_FLAGS, 'invalid --kid: must be a non-empty string');
        }
        const kid = flags.kid.trim();

        if (flags.stdout) {
            if (flags.publicOut) {
                fail(logger, EXIT_INVALID_FLAGS, 'conflicting flags: --stdout cannot be combined with --public-out');
            }
            if (flags.privateOut) {
                fail(logger, EXIT_INVALID_FLAGS, 'conflicting flags: --stdout cannot be combined with --private-out');
            }
            if (flags.outDir) {
                fail(logger, EXIT_INVALID_FLAGS, 'conflicting flags: --stdout cannot be combined with --out-dir');
            }
            if (flags.force) {
                fail(logger, EXIT_INVALID_FLAGS, 'conflicting flags: --stdout cannot be combined with --force');
            }
        }
        if (flags.publicOnly && flags.privateOut) {
            fail(logger, EXIT_INVALID_FLAGS, 'conflicting flags: --public-only cannot be combined with --private-out');
        }

        const outDir = flags.outDir ?? process.cwd();
        const publicPath = flags.publicOut ?? path.join(outDir, 'public.jwk.json');
        const privatePath = flags.privateOut ?? path.join(outDir, 'private.jwk.json');

        if (!flags.stdout && flags.outDir) {
            let dirExists = false;
            try {
                const info = await stat(outDir);
                dirExists = info.isDirectory();
            } catch {
                dirExists = false;
            }
            if (!dirExists) {
                const confirmed = flags.yes || (await promptYesNo(`Directory ${outDir} does not exist. Create it?`));
                if (!confirmed) {
                    fail(logger, EXIT_INVALID_FLAGS, `aborted: --out-dir ${outDir} does not exist`);
                }
                try {
                    await flySystem.makeDirectory(outDir);
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    fail(logger, EXIT_IO, `failed to create directory ${outDir}: ${message}`);
                }
            }
        }

        if (!flags.stdout && !flags.force) {
            if (await flySystem.isFileExists(publicPath)) {
                fail(
                    logger,
                    EXIT_FILE_EXISTS,
                    `refusing to overwrite existing file: ${publicPath}. re-run with --force to overwrite.`,
                );
            }
            if (!flags.publicOnly && (await flySystem.isFileExists(privatePath))) {
                fail(
                    logger,
                    EXIT_FILE_EXISTS,
                    `refusing to overwrite existing file: ${privatePath}. re-run with --force to overwrite.`,
                );
            }
        }

        const intent = commandBus.createCommand('GeneratePluginKeypair', { bits, kid });
        const { result } = await commandBus.dispatch(intent);
        if (!result) {
            fail(logger, 1, 'failed to generate RSA JWK keypair.');
            return;
        }
        const { publicJwk, privateJwk } = result;

        if (flags.stdout) {
            const payload = flags.publicOnly ? { public: publicJwk } : { public: publicJwk, private: privateJwk };
            process.stdout.write(JSON.stringify(payload) + '\n');
            return;
        }

        if (flags.publicOnly) {
            logger.warn(
                'writing only the public JWK: the private key has been discarded. you must have obtained a matching private key elsewhere — otherwise the plugin will not decrypt.',
            );
        }

        try {
            await flySystem.saveFile(publicPath, JSON.stringify(publicJwk, null, 2) + '\n');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            fail(logger, EXIT_IO, `failed to write ${publicPath}: ${message}`);
        }

        if (!flags.publicOnly) {
            try {
                await flySystem.saveFile(privatePath, JSON.stringify(privateJwk, null, 2) + '\n');
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                fail(logger, EXIT_IO, `failed to write ${privatePath}: ${message}`);
            }
            try {
                await chmod(privatePath, 0o600);
            } catch (error) {
                logger.debug(`unable to chmod 0600 on ${privatePath}: ${error}`);
            }
        }

        const gitRoot = findGitRoot(path.dirname(publicPath));
        if (gitRoot && !flags.publicOnly) {
            const gitignorePath = path.join(gitRoot, '.gitignore');
            if (await flySystem.isFileExists(gitignorePath)) {
                try {
                    const existing = await flySystem.loadFile(gitignorePath);
                    if (!gitignoreContains(existing, 'private.jwk.json')) {
                        const shouldUpdate =
                            flags.yes ||
                            (await promptYesNo(
                                `add ${pc.cyan('private.jwk.json')} to ${gitignorePath}? (strongly recommended)`,
                            ));
                        if (shouldUpdate) {
                            const suffix = existing.endsWith('\n') || existing.length === 0 ? '' : '\n';
                            await flySystem.saveFile(gitignorePath, existing + suffix + 'private.jwk.json\n');
                            logger.info(`added ${pc.cyan('private.jwk.json')} to ${gitignorePath}`);
                        }
                    }
                } catch (error) {
                    logger.debug(`skipped .gitignore update: ${error}`);
                }
            }
        }

        logger.success(`RSA JWK keypair generated (${bits} bits, kid="${kid}")`);
        logger.complete(`public:  ${publicPath}`);
        if (!flags.publicOnly) {
            logger.complete(`private: ${privatePath}`);
        }
    });

    return command;
};
