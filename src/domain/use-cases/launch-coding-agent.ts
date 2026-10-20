import type { CommandHandlerDefinition, Envelope } from 'missive.js';
import os from 'node:os';
import path from 'node:path';
import type { FlySystem } from '../contracts/fly-system';
import type { DetectedCodingAgent } from '../contracts/models/coding-agent';
import type { SuperfastShop } from '../contracts/models/superfast-shop';

type Deps = {
    flySystem: FlySystem;
};

export type LaunchCodingAgentCommand = {
    agent: DetectedCodingAgent;
    shop: SuperfastShop;
    // absolute path
    folder: string;
};

export type LaunchCodingAgentHandlerDefinition = CommandHandlerDefinition<
    'LaunchCodingAgent',
    LaunchCodingAgentCommand,
    Awaited<ReturnType<typeof handler>>
>;

type AgentPrompt = {
    prompt: string;
    promptFile?: { path: string; content: string };
};

export const resolveAgentPrompt = (
    shop: Pick<SuperfastShop, 'id' | 'prompt'>,
    platform: NodeJS.Platform,
    tmpDir: string,
): AgentPrompt => {
    if (platform !== 'win32') {
        return { prompt: shop.prompt };
    }
    // Bun refuses to pass `" % & | < > ^` or new lines to a .cmd launcher and a Windows command line is capped
    // at 32,767 characters: the agent reads the prompt from a file instead.
    const file = path.join(tmpDir, `crystallize-superfast-shop-${shop.id.replace(/[^a-z0-9-]/gi, '-')}.md`);
    return {
        prompt: `Read the file ${file} and follow its instructions`,
        promptFile: { path: file, content: shop.prompt },
    };
};

const handler = async (envelope: Envelope<LaunchCodingAgentCommand>, deps: Deps) => {
    const { agent, shop, folder } = envelope.message;
    const { prompt, promptFile } = resolveAgentPrompt(shop, process.platform, os.tmpdir());
    if (promptFile) {
        await deps.flySystem.saveFile(promptFile.path, promptFile.content);
    }

    // the agent owns the terminal now: once Ink has read from stdin, the CLI would keep swallowing what the user
    // types, and Ctrl+C is for the agent while the CLI waits for it to exit
    process.stdin.pause();
    const ignoreInterrupt = () => {};
    process.on('SIGINT', ignoreInterrupt);
    try {
        const proc = Bun.spawn([agent.path, ...agent.promptArgs(prompt)], {
            cwd: folder,
            // opencode resolves its project from PWD, not from the working directory
            env: { ...process.env, PWD: folder },
            stdin: 'inherit',
            stdout: 'inherit',
            stderr: 'inherit',
        });
        await proc.exited;
        return { exitCode: proc.exitCode ?? 1 };
    } finally {
        process.off('SIGINT', ignoreInterrupt);
    }
};

export const createLaunchCodingAgentHandler = (deps: Deps) => (command: Envelope<LaunchCodingAgentCommand>) =>
    handler(command, deps);
