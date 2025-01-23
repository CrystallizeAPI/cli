import type { FetchShopAuthToken } from '../contracts/fetch-shop-auth-token';
import type { PimCredentials } from '../contracts/models/credentials';

export const createFetchShopApiToken =
    (): FetchShopAuthToken =>
    async (tenantIdentifier: string, credentials: PimCredentials, scopes: string[], expiresIn: number) => {
        const response = await fetch(`https://shop-api.crystallize.com/${tenantIdentifier}/auth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'x-crystallize-access-token-id': credentials.ACCESS_TOKEN_ID,
                'x-crystallize-access-token-secret': credentials.ACCESS_TOKEN_SECRET,
            },
            body: JSON.stringify({
                scopes,
                expiresIn,
            }),
        });
        const json = (await response.json()) as { token: string };
        return json.token;
    };
