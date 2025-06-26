export type TokenBasedCredentials = {
    ACCESS_TOKEN_ID: string;
    ACCESS_TOKEN_SECRET: string;
    sessionId?: never;
};

export type SessionBasedPimCredentials = {
    sessionId: string;
    ACCESS_TOKEN_ID?: never;
    ACCESS_TOKEN_SECRET?: never;
};

export type PimCredentials = TokenBasedCredentials | SessionBasedPimCredentials;
