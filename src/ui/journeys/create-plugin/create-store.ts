import { atom, createStore } from 'jotai';
import type { PluginSkeleton } from '../../../domain/contracts/models/plugin-skeleton';

export type PluginInfo = {
    name: string;
    identifier: string;
    author: string;
    vendorUrl: string;
};

export type KeypairSettings = {
    bits: 2048 | 3072 | 4096;
    kid: string;
};

export interface CreatePluginState {
    folder?: string;
    skeleton?: PluginSkeleton;
    info?: PluginInfo;
    keypair: KeypairSettings;
    isKeypairConfigured: boolean;
    isDownloaded: boolean;
    isKeypairGenerated: boolean;
    publicJwkCompact?: string;
    privateJwkCompact?: string;
    isTokensReplaced: boolean;
    skipInstall: boolean;
    isInstalled: boolean;
    isFullfilled: boolean;
    messages: string[];
    error?: string;
}

export const createCreatePluginCommandStore = () => {
    const stateAtom = atom<CreatePluginState>({
        folder: undefined,
        skeleton: undefined,
        info: undefined,
        keypair: { bits: 2048, kid: 'public' },
        isKeypairConfigured: false,
        isDownloaded: false,
        isKeypairGenerated: false,
        publicJwkCompact: undefined,
        privateJwkCompact: undefined,
        isTokensReplaced: false,
        skipInstall: false,
        isInstalled: false,
        isFullfilled: false,
        messages: [],
        error: undefined,
    });

    const isWizardFullfilledAtom = atom((get) => {
        const s = get(stateAtom);
        return s.folder !== undefined && s.skeleton !== undefined && s.info !== undefined;
    });

    const setFolderAtom = atom(null, (get, set, folder: string) => set(stateAtom, { ...get(stateAtom), folder }));
    const setSkeletonAtom = atom(null, (get, set, skeleton: PluginSkeleton) =>
        set(stateAtom, { ...get(stateAtom), skeleton }),
    );
    const setInfoAtom = atom(null, (get, set, info: PluginInfo) => set(stateAtom, { ...get(stateAtom), info }));
    const setKeypairAtom = atom(null, (get, set, keypair: KeypairSettings) =>
        set(stateAtom, { ...get(stateAtom), keypair, isKeypairConfigured: true }),
    );
    const setSkipInstallAtom = atom(null, (get, set, skipInstall: boolean) =>
        set(stateAtom, { ...get(stateAtom), skipInstall }),
    );
    const setDownloadedAtom = atom(null, (get, set, isDownloaded: boolean) =>
        set(stateAtom, { ...get(stateAtom), isDownloaded }),
    );
    const setKeypairGeneratedAtom = atom(
        null,
        (get, set, payload: { publicJwkCompact: string; privateJwkCompact: string }) =>
            set(stateAtom, { ...get(stateAtom), isKeypairGenerated: true, ...payload }),
    );
    const setTokensReplacedAtom = atom(null, (get, set, isTokensReplaced: boolean) =>
        set(stateAtom, { ...get(stateAtom), isTokensReplaced }),
    );
    const setInstalledAtom = atom(null, (get, set) =>
        set(stateAtom, { ...get(stateAtom), isInstalled: true, isFullfilled: true }),
    );
    const addMessageAtom = atom(null, (get, set, message: string) =>
        set(stateAtom, { ...get(stateAtom), messages: [...get(stateAtom).messages, message] }),
    );
    const setErrorAtom = atom(null, (get, set, error: string) => set(stateAtom, { ...get(stateAtom), error }));

    return {
        atoms: {
            stateAtom,
            isWizardFullfilledAtom,
            setFolderAtom,
            setSkeletonAtom,
            setInfoAtom,
            setKeypairAtom,
            setSkipInstallAtom,
            setDownloadedAtom,
            setKeypairGeneratedAtom,
            setTokensReplacedAtom,
            setInstalledAtom,
            addMessageAtom,
            setErrorAtom,
        },
        storage: createStore(),
    };
};

export type CreatePluginStore = ReturnType<typeof createCreatePluginCommandStore>;
