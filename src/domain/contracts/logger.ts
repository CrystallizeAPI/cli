export type Logger = {
    setBuffered: (isBuffered: boolean) => void;
    flush: () => void;
    await: (...args: unknown[]) => void;
    complete: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
    fatal: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    note: (...args: unknown[]) => void;
    pause: (...args: unknown[]) => void;
    pending: (...args: unknown[]) => void;
    start: (...args: unknown[]) => void;
    success: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    watch: (...args: unknown[]) => void;
    log: (...args: unknown[]) => void;
};
