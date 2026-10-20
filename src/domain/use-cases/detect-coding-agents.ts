import type { Envelope, QueryHandlerDefinition } from 'missive.js';
import type { Runner } from '../../core/create-runner';
import { codingAgents } from '../../content/coding-agents';
import type { CodingAgent, DetectedCodingAgent } from '../contracts/models/coding-agent';

type Deps = {
    runner: Runner;
};

type Query = {
    // only look for this agent identifier
    only?: string;
};

export type DetectCodingAgentsHandlerDefinition = QueryHandlerDefinition<
    'DetectCodingAgents',
    Query,
    Awaited<ReturnType<typeof handler>>
>;

export const detectCodingAgents = async (
    agents: CodingAgent[],
    which: (binary: string) => string | null,
    readHelp: (path: string) => Promise<string>,
): Promise<DetectedCodingAgent[]> => {
    const detected: DetectedCodingAgent[] = [];
    for (const agent of agents) {
        const path = which(agent.binary);
        if (!path) {
            continue;
        }
        if (agent.helpMarker && !(await readHelp(path)).includes(agent.helpMarker)) {
            continue;
        }
        detected.push({ ...agent, path });
    }
    return detected;
};

const handler = async (envelope: Envelope<Query>, deps: Deps) => {
    const { only } = envelope.message;
    const readHelp = async (path: string): Promise<string> => {
        let output = '';
        const collect = (data: Buffer) => (output += data.toString());
        try {
            await deps.runner([path, '--help'], collect, collect);
        } catch {
            // a binary that cannot run is not an agent we can hand over to
        }
        return output;
    };
    const agents = codingAgents.filter((agent) => !only || agent.identifier === only);
    return { agents: await detectCodingAgents(agents, (binary) => Bun.which(binary), readHelp) };
};

export const createDetectCodingAgentsHandler = (deps: Deps) => (query: Envelope<Query>) => handler(query, deps);
