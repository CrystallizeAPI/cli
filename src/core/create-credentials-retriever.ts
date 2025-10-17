import type {
    AsyncCreateClient,
    CredentialRetriever,
    CredentialRetrieverOptions,
} from '../domain/contracts/credential-retriever';
import type { PimCredentials } from '../domain/contracts/models/credentials';
import type { FlySystem } from '../domain/contracts/fly-system';
import os from 'os';
import type { PimAuthenticatedUser } from '../domain/contracts/models/authenticated-user';

type Deps = {
    options?: CredentialRetrieverOptions;
    fallbackFile: string;
    flySystem: FlySystem;
    createCrystallizeClient: AsyncCreateClient;
};
export const createCredentialsRetriever = ({
    options,
    fallbackFile,
    flySystem,
    createCrystallizeClient,
}: Deps): CredentialRetriever => {
    const getCredentials = async (rOptions?: CredentialRetrieverOptions) => {
        if (rOptions?.token_id && rOptions?.token_secret) {
            return {
                ACCESS_TOKEN_ID: rOptions.token_id,
                ACCESS_TOKEN_SECRET: rOptions.token_secret,
            };
        }

        if (options?.token_id && options?.token_secret) {
            return {
                ACCESS_TOKEN_ID: options.token_id,
                ACCESS_TOKEN_SECRET: options.token_secret,
            };
        }

        if (Bun.env.CRYSTALLIZE_ACCESS_TOKEN_ID && Bun.env.CRYSTALLIZE_ACCESS_TOKEN_SECRET) {
            return {
                ACCESS_TOKEN_ID: Bun.env.CRYSTALLIZE_ACCESS_TOKEN_ID,
                ACCESS_TOKEN_SECRET: Bun.env.CRYSTALLIZE_ACCESS_TOKEN_SECRET,
            };
        }

        if (!(await Bun.file(fallbackFile).exists())) {
            throw new Error('No file credentials found: ' + fallbackFile);
        }

        try {
            const { ACCESS_TOKEN_ID, ACCESS_TOKEN_SECRET } = await Bun.file(fallbackFile).json();

            if (ACCESS_TOKEN_ID && ACCESS_TOKEN_SECRET) {
                return {
                    ACCESS_TOKEN_ID,
                    ACCESS_TOKEN_SECRET,
                };
            }
        } catch (error) {
            throw new Error('No credentials found. File is malformed.');
        }
        throw new Error('No credentials found. File is missing ACCESS_TOKEN_ID or ACCESS_TOKEN_SECRET.');
    };

    const checkCredentials = async (credentials: PimCredentials) => {
        const apiClient = await createCrystallizeClient({
            tenantIdentifier: '',
            sessionId: credentials.sessionId,
            accessTokenId: credentials.ACCESS_TOKEN_ID,
            accessTokenSecret: credentials.ACCESS_TOKEN_SECRET,
        });
        const result = await apiClient
            .pimApi<{
                me: PimAuthenticatedUser;
            }>('{ me { id firstName lastName email tenants { tenant { id identifier name } } } }')
            .catch(() => {});
        return result?.me ?? undefined;
    };

    const removeCredentials = async () => {
        await flySystem.removeFile(fallbackFile);
    };

    const saveCredentials = async (credentials: PimCredentials) => {
        await flySystem.makeDirectory(`${os.homedir()}/.crystallize`);
        await flySystem.saveFile(fallbackFile, JSON.stringify(credentials));
    };

    return {
        getCredentials,
        checkCredentials,
        removeCredentials,
        saveCredentials,
    };
};
