import { atom, createStore } from 'jotai';
import type { Boilerplate } from '../../../domain/contracts/models/boilerplate';
import type { PimCredentials } from '../../../domain/contracts/models/credentials';
import type { Tenant } from '../../../domain/contracts/models/tenant';

export const createInstallBoilerplateCommandStore = () => {
    const stateAtom = atom<InstallBoilerplateState>({
        folder: undefined,
        tenant: undefined,
        boilerplate: undefined,
        bootstrapTenant: false,
        isDownloaded: false,
        messages: [],
        trace: {
            errors: [],
            logs: [],
        },
        isFullfilled: false,
        isBoostrapping: false,
        readme: undefined,
        isVerbose: false,
        credentials: undefined,
    });

    const isWizardFullfilledAtom = atom((get) => {
        const state = get(stateAtom);
        if (state.bootstrapTenant && !state.credentials) {
            return false;
        }
        return state.boilerplate !== undefined && state.tenant !== undefined;
    });

    const addTraceLogAtom = atom(null, (get, set, log: string) => {
        const currentState = get(stateAtom);
        set(stateAtom, {
            ...currentState,
            trace: {
                ...currentState.trace,
                logs: [...currentState.trace.logs, log],
            },
        });
    });

    const addTraceErrorAtom = atom(null, (get, set, error: string) => {
        const currentState = get(stateAtom);
        set(stateAtom, {
            ...currentState,
            trace: {
                ...currentState.trace,
                errors: [...currentState.trace.errors, error],
            },
        });
    });

    const addMessageAtom = atom(null, (get, set, message: string) => {
        const currentState = get(stateAtom);
        set(stateAtom, {
            ...currentState,
            messages: [...currentState.messages, message],
        });
    });

    const changeTenantAtom = atom(null, (get, set, newTenant: Tenant) => {
        const currentState = get(stateAtom);
        const currentTenant = currentState.tenant;

        if (currentTenant?.identifier === newTenant.identifier) {
            return; // No changes needed
        }

        set(stateAtom, {
            ...currentState,
            tenant: newTenant,
            messages: [
                ...currentState.messages,
                `We changed the asked tenant identifier from ${currentTenant?.identifier || 'undefined'} to ${newTenant.identifier}`,
            ],
        });
    });

    const setFolderAtom = atom(null, (get, set, folder: string) => {
        const currentState = get(stateAtom);
        set(stateAtom, { ...currentState, folder });
    });

    const setTenantAtom = atom(null, (get, set, tenant: Tenant) => {
        const currentState = get(stateAtom);
        set(stateAtom, { ...currentState, tenant });
    });

    const setBoilerplateAtom = atom(null, (get, set, boilerplate: Boilerplate) => {
        const currentState = get(stateAtom);
        set(stateAtom, { ...currentState, boilerplate });
    });

    const setBootstrapTenantAtom = atom(null, (get, set, bootstrapTenant: boolean) => {
        const currentState = get(stateAtom);
        set(stateAtom, { ...currentState, bootstrapTenant });
    });

    const setDownloadedAtom = atom(null, (get, set, isDownloaded: boolean) => {
        const currentState = get(stateAtom);
        set(stateAtom, { ...currentState, isDownloaded });
    });

    const recipesDoneAtom = atom(null, (get, set, readme: string) => {
        const currentState = get(stateAtom);
        set(stateAtom, { ...currentState, readme, isFullfilled: true });
    });

    const setCredentialsAtom = atom(null, (get, set, credentials: PimCredentials) => {
        const currentState = get(stateAtom);
        set(stateAtom, { ...currentState, credentials });
    });

    const setVerbosity = atom(null, (get, set, verbose: boolean) => {
        const currentState = get(stateAtom);
        set(stateAtom, { ...currentState, isVerbose: verbose });
    });

    const startBoostrappingAtom = atom(null, (get, set) => {
        const currentState = get(stateAtom);
        set(stateAtom, { ...currentState, isBoostrapping: true });
    });

    return {
        atoms: {
            stateAtom,
            isWizardFullfilledAtom,
            setFolderAtom,
            setBoilerplateAtom,
            setDownloadedAtom,
            setBootstrapTenantAtom,
            recipesDoneAtom,
            setTenantAtom,
            setCredentialsAtom,
            setVerbosity,
            startBoostrappingAtom,
            addMessageAtom,
            addTraceErrorAtom,
            addTraceLogAtom,
            changeTenantAtom,
        },
        storage: createStore(),
    };
};

export type InstallBoilerplateStore = ReturnType<typeof createInstallBoilerplateCommandStore>;
export interface InstallBoilerplateState {
    folder?: string;
    tenant?: Tenant;
    boilerplate?: Boilerplate;
    bootstrapTenant: boolean;
    isDownloaded: boolean;
    messages: string[];
    trace: {
        errors: string[];
        logs: string[];
    };
    isBoostrapping: boolean;
    isFullfilled: boolean;
    readme?: string;
    isVerbose: boolean;
    credentials?: PimCredentials;
}
