export type ExtractArchiveOptions = {
    // number of leading path segments to remove from each entry, like `tar --strip-components`
    strip?: number;
    // only extract the entries matching this glob
    glob?: string;
};

export type FlySystem = {
    isDirectoryEmpty: (path: string) => Promise<boolean>;
    loopInDirectory: (path: string) => AsyncGenerator<string>;
    makeDirectory: (path: string) => Promise<boolean>;
    createDirectoryOrFail: (path: string, message: string) => Promise<true>;
    isFileExists: (path: string) => Promise<boolean>;
    loadFile: (path: string) => Promise<string>;
    loadJsonFile: <T>(path: string) => Promise<T>;
    removeFile: (path: string) => Promise<void>;
    saveFile: (path: string, content: string) => Promise<void>;
    extractArchive: (archive: Blob, destination: string, options?: ExtractArchiveOptions) => Promise<void>;
    replaceInFile: (path: string, keyValues: { search: string; replace: string }[]) => Promise<void>;
    loadBinaryFile: (path: string) => Promise<{
        type: string;
        content: ArrayBuffer;
    }>;
};
