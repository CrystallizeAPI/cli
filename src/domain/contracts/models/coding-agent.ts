export type CodingAgent = {
    identifier: string;
    name: string;
    binary: string;
    // the arguments that start an interactive session with this initial prompt already submitted
    promptArgs: (prompt: string) => string[];
    // text the `--help` output must contain, when another program may own the same binary name
    helpMarker?: string;
    asksToTrustFolder: boolean;
};

export type DetectedCodingAgent = CodingAgent & {
    path: string;
};
