import { describe, expect, test } from 'bun:test';
import { codingAgents } from '../../../src/content/coding-agents';
import { detectCodingAgents } from '../../../src/domain/use-cases/detect-coding-agents';

const whichFrom = (installed: Record<string, string>) => (binary: string) => installed[binary] ?? null;
const noHelp = async () => '';

describe('detectCodingAgents', () => {
    test('returns the installed agents in the supported order', async () => {
        const agents = await detectCodingAgents(
            codingAgents,
            whichFrom({ opencode: '/bin/opencode', claude: '/bin/claude', 'cursor-agent': '/bin/cursor-agent' }),
            noHelp,
        );
        expect(agents.map((agent) => [agent.identifier, agent.path])).toEqual([
            ['claude', '/bin/claude'],
            ['cursor', '/bin/cursor-agent'],
            ['opencode', '/bin/opencode'],
        ]);
    });

    test('returns nothing when no agent is installed', async () => {
        expect(await detectCodingAgents(codingAgents, whichFrom({}), noHelp)).toEqual([]);
    });

    test('only counts agy when its help mentions --prompt-interactive', async () => {
        const which = whichFrom({ agy: '/bin/agy' });
        const ideLauncher = await detectCodingAgents(codingAgents, which, async () => 'Usage: antigravity [options]');
        expect(ideLauncher).toEqual([]);

        const cli = await detectCodingAgents(codingAgents, which, async (path) =>
            path === '/bin/agy' ? '  -i, --prompt-interactive string   Run an initial prompt interactively' : '',
        );
        expect(cli.map((agent) => agent.identifier)).toEqual(['agy']);
    });

    test('does not run the help of agents that need no check', async () => {
        const probed: string[] = [];
        await detectCodingAgents(
            codingAgents,
            whichFrom({ claude: '/bin/claude', codex: '/bin/codex' }),
            async (path) => {
                probed.push(path);
                return '';
            },
        );
        expect(probed).toEqual([]);
    });
});

describe('codingAgents', () => {
    const argsOf = (identifier: string, prompt: string) =>
        codingAgents.find((agent) => agent.identifier === identifier)!.promptArgs(prompt);

    test('are supported in this order', () => {
        expect(codingAgents.map((agent) => `${agent.identifier}:${agent.binary}`)).toEqual([
            'claude:claude',
            'codex:codex',
            'agy:agy',
            'cursor:cursor-agent',
            'opencode:opencode',
        ]);
    });

    test('each start an interactive session with the prompt', () => {
        const prompt = '# Build "my" shop\n- with $vars, `code` and → unicode';
        expect(argsOf('claude', prompt)).toEqual([prompt]);
        expect(argsOf('codex', prompt)).toEqual([prompt]);
        expect(argsOf('agy', prompt)).toEqual([`--prompt-interactive=${prompt}`]);
        expect(argsOf('cursor', prompt)).toEqual([prompt]);
        expect(argsOf('opencode', prompt)).toEqual([`--prompt=${prompt}`]);
    });
});
