import type { PimAuthenticatedUser } from './models/authenticated-user';
import type { PimCredentials } from './models/credentials';

export type GetAuthenticatedUser = (options: {
    isInteractive: boolean;
    token_id?: string;
    token_secret?: string;
}) => Promise<{
    authenticatedUser: PimAuthenticatedUser;
    credentials: PimCredentials;
}>;
