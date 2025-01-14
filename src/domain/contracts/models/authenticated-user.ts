export type PimAuthenticatedUser = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    tenants: {
        tenant: {
            id: string;
            identifier: string;
            name: string;
        };
    }[];
};
