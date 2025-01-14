export type FlySystem = {
    isDirectoryEmpty: (path: string) => Promise<boolean>;
    makeDirectory: (path: string) => Promise<boolean>;
    createDirectoryOrFail: (path: string, message: string) => Promise<true>;
    isFileExists: (path: string) => Promise<boolean>;
    loadFile: (path: string) => Promise<string>;
    loadJsonFile: <T>(path: string) => Promise<T>;
    removeFile: (path: string) => Promise<void>;
    saveFile: (path: string, content: string) => Promise<void>;
    saveResponse: (path: string, response: Response) => Promise<void>;
    replaceInFile: (path: string, keyValues: { search: string; replace: string }[]) => Promise<void>;
};
