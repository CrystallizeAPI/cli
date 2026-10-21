import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { SuperfastShop } from '../../src/domain/contracts/models/superfast-shop';
import { parseSuperfastShops, SUPERFAST_SHOPS_URL } from '../../src/domain/use-cases/fetch-superfast-shops';

const CLI = path.resolve(import.meta.dir, '../../src/index.ts');
const TIMEOUT = 60_000;

// records how it was started, then waits for one line on its stdin
const FAKE_AGENT = `#!/bin/sh
printf '%s' "\${0##*/}" > "$FAKE_AGENT_RECORD/agent"
pwd -P > "$FAKE_AGENT_RECORD/cwd"
printf '%s' "$#" > "$FAKE_AGENT_RECORD/argc"
printf '%s' "$1" > "$FAKE_AGENT_RECORD/prompt"
printf 'FAKE AGENT READY\\n'
IFS= read -r line
printf '%s' "$line" > "$FAKE_AGENT_RECORD/stdin"
exit 7
`;

let shops: SuperfastShop[];
let root: string;
let fakeBin: string;
let emptyBin: string;
let record: string;
let folder: string;

const environment = (bin: string) => ({
    ...process.env,
    PATH: bin,
    FAKE_AGENT_RECORD: record,
    // Ink only renders the last frame in CI
    CI: 'false',
});

const runInTerminal = (args: string[], bin: string) => {
    let output = '';
    const decoder = new TextDecoder();
    const proc = Bun.spawn([process.execPath, CLI, 'sfs', ...args], {
        cwd: root,
        env: environment(bin),
        terminal: {
            cols: 160,
            rows: 50,
            data: (_, data) => {
                output += decoder.decode(data, { stream: true });
            },
        },
    });
    return {
        proc,
        output: () => Bun.stripANSI(output),
        type: (keys: string) => proc.terminal!.write(keys),
    };
};

const waitFor = async (
    condition: () => boolean | Promise<boolean>,
    what: string,
    cli?: ReturnType<typeof runInTerminal>,
) => {
    const deadline = Date.now() + TIMEOUT / 2;
    while (!(await condition())) {
        if (cli && cli.proc.exitCode !== null) {
            throw new Error(`the CLI exited (${cli.proc.exitCode}) before ${what}:\n${cli.output()}`);
        }
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
        await Bun.sleep(50);
    }
};

const recorded = (name: string) => readFile(path.join(record, name), 'utf8');
const isRecorded = (name: string) => Bun.file(path.join(record, name)).exists();

beforeAll(async () => {
    const response = await fetch(SUPERFAST_SHOPS_URL);
    shops = parseSuperfastShops(await response.json());
});

beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'crystallize-sfs-'));
    fakeBin = path.join(root, 'bin');
    emptyBin = path.join(root, 'empty-bin');
    record = path.join(root, 'record');
    folder = path.join(root, 'my-shop');
    await mkdir(fakeBin);
    await mkdir(emptyBin);
    await mkdir(record);
    await writeFile(path.join(fakeBin, 'claude'), FAKE_AGENT);
    await chmod(path.join(fakeBin, 'claude'), 0o755);
});

afterEach(async () => {
    await rm(root, { recursive: true, force: true });
});

describe('superfast-shop', () => {
    test('the live list has shops with an id, a name and a prompt', () => {
        expect(shops.length).toBeGreaterThan(0);
        for (const shop of shops) {
            expect(shop.id).not.toBe('');
            expect(shop.name).not.toBe('');
            expect(shop.prompt).not.toBe('');
        }
    });

    test(
        'hands the terminal over to the agent, in the folder, with the shop prompt',
        async () => {
            const shop = shops[0];
            const cli = runInTerminal([folder, shop.id, '--agent', 'claude'], fakeBin);
            await waitFor(() => cli.output().includes('FAKE AGENT READY'), 'the agent to start', cli);
            cli.type('done\r');

            expect(await cli.proc.exited).toBe(7);
            expect(await recorded('agent')).toBe('claude');
            expect(await recorded('prompt')).toBe(shop.prompt);
            expect(await recorded('argc')).toBe('1');
            expect((await recorded('cwd')).trim()).toBe(await realpath(folder));
            expect(cli.output()).toContain(`Starting Claude Code in ${folder} with the ${shop.name} prompt`);
            expect(cli.output()).toContain('Claude Code will ask whether you trust this folder');
        },
        TIMEOUT,
    );

    test(
        'lets the user pick the shop, then the agent gets the keyboard',
        async () => {
            const cli = runInTerminal([folder], fakeBin);
            await waitFor(() => cli.output().includes(shops[0].name), 'the list of shops', cli);
            cli.type('\r');
            await waitFor(() => cli.output().includes('FAKE AGENT READY'), 'the agent to start', cli);
            cli.type('hello agent\r');

            expect(await cli.proc.exited).toBe(7);
            expect(await recorded('prompt')).toBe(shops[0].prompt);
            await waitFor(() => isRecorded('stdin'), 'the agent to read its input');
            expect(await recorded('stdin')).toBe('hello agent');
        },
        TIMEOUT,
    );

    test(
        'lets the user pick the agent when several are installed',
        async () => {
            await writeFile(path.join(fakeBin, 'codex'), FAKE_AGENT);
            await chmod(path.join(fakeBin, 'codex'), 0o755);
            const cli = runInTerminal([folder, shops[0].id], fakeBin);
            await waitFor(() => cli.output().includes('Which coding agent should build it?'), 'the agents', cli);
            expect(cli.output()).toContain(`Claude Code (${path.join(fakeBin, 'claude')})`);
            cli.type('\x1b[B');
            await Bun.sleep(100);
            cli.type('\r');
            await waitFor(() => cli.output().includes('FAKE AGENT READY'), 'the agent to start', cli);
            cli.type('\r');

            expect(await cli.proc.exited).toBe(7);
            expect(await recorded('agent')).toBe('codex');
            expect(await recorded('prompt')).toBe(shops[0].prompt);
        },
        TIMEOUT,
    );

    test(
        'shows the list for an unknown shop, and Ctrl+C leaves without starting the agent',
        async () => {
            const cli = runInTerminal([folder, 'no-such-shop'], fakeBin);
            await waitFor(() => cli.output().includes(shops[0].name), 'the list of shops', cli);
            cli.type('\x03');

            expect(await cli.proc.exited).toBe(0);
            expect(await isRecorded('prompt')).toBe(false);
        },
        TIMEOUT,
    );

    test(
        'without any agent installed, points to the prompt and exits 0',
        async () => {
            const shop = shops[0];
            const cli = runInTerminal([folder, shop.id], emptyBin);

            expect(await cli.proc.exited).toBe(0);
            expect(cli.output()).toContain(shop.promptUrl);
            expect(cli.output()).toContain('Claude Code (claude)');
            expect(await isRecorded('prompt')).toBe(false);
        },
        TIMEOUT,
    );

    test(
        'fails when the requested agent is not installed',
        async () => {
            const cli = runInTerminal([folder, shops[0].id, '--agent', 'codex'], fakeBin);

            expect(await cli.proc.exited).toBe(1);
            expect(cli.output()).toContain('Codex is not installed');
            expect(await isRecorded('prompt')).toBe(false);
        },
        TIMEOUT,
    );

    test('fails right away without an interactive terminal', () => {
        const result = spawnSync(process.execPath, [CLI, 'sfs', folder, 'photo-store', '--agent', 'claude'], {
            cwd: root,
            encoding: 'utf8',
            env: environment(fakeBin),
        });

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('interactive terminal');
        expect(existsSync(folder)).toBe(false);
    });
});
