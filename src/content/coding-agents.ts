import type { CodingAgent } from '../domain/contracts/models/coding-agent';

export const codingAgents: CodingAgent[] = [
    {
        identifier: 'claude',
        name: 'Claude Code',
        binary: 'claude',
        promptArgs: (prompt) => [prompt],
        asksToTrustFolder: true,
    },
    {
        identifier: 'codex',
        name: 'Codex',
        binary: 'codex',
        promptArgs: (prompt) => [prompt],
        asksToTrustFolder: true,
    },
    {
        identifier: 'agy',
        name: 'Antigravity',
        binary: 'agy',
        // a positional prompt is an error since agy 1.1.18
        promptArgs: (prompt) => [`--prompt-interactive=${prompt}`],
        // older Antigravity IDE installs put an `agy` launcher for the IDE on the PATH
        helpMarker: '--prompt-interactive',
        asksToTrustFolder: true,
    },
    {
        identifier: 'cursor',
        name: 'Cursor',
        // the installer also creates `agent`, a name another tool may own
        binary: 'cursor-agent',
        promptArgs: (prompt) => [prompt],
        asksToTrustFolder: true,
    },
    {
        identifier: 'opencode',
        name: 'opencode',
        binary: 'opencode',
        // the positional argument of opencode is a directory, not a prompt
        promptArgs: (prompt) => [`--prompt=${prompt}`],
        asksToTrustFolder: false,
    },
];
