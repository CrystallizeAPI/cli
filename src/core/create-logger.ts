import pc from 'picocolors';
import type { Logger } from '../domain/contracts/logger';

type Level = 'info' | 'debug';
type LogType = Exclude<keyof Logger, 'setBuffered' | 'flush'>;
type Style = {
    badge: string;
    color: (text: string) => string;
    // the level that must be enabled to display this type, `null` means always displayed
    level: Level | null;
    // optional color applied to the message itself
    tint?: (text: string) => string;
};

const fatalColor = (text: string) => pc.bold(pc.red(text));

const styles: Record<LogType, Style> = {
    success: { badge: '✔', color: pc.green, level: 'info' },
    error: { badge: '✖', color: pc.red, level: null, tint: pc.red },
    warn: { badge: '⚠', color: pc.yellow, level: null, tint: pc.yellow },
    fatal: { badge: '✖', color: fatalColor, level: null, tint: fatalColor },
    start: { badge: '▶', color: pc.green, level: 'info' },
    pause: { badge: '■', color: pc.yellow, level: 'info' },
    info: { badge: 'ℹ', color: pc.blue, level: 'info' },
    debug: { badge: '●', color: pc.gray, level: 'debug', tint: pc.dim },
    note: { badge: '●', color: pc.blue, level: 'info' },
    complete: { badge: '☒', color: pc.cyan, level: 'info' },
    await: { badge: '…', color: pc.blue, level: 'info' },
    pending: { badge: '☐', color: pc.magenta, level: 'info' },
    watch: { badge: '…', color: pc.yellow, level: 'info' },
    log: { badge: ' ', color: (text) => text, level: 'debug' },
};

const formatError = (error: Error): string => {
    const [headline = '', ...frames] = (error.stack ?? `${error.name}: ${error.message}`).split('\n');
    const lines = [pc.bold(headline), ...frames.map((frame) => pc.dim(frame))];
    if (error.cause !== undefined) {
        lines.push(`${pc.dim('Caused by:')} ${formatArg(error.cause)}`);
    }
    return lines.join('\n');
};

const formatArg = (arg: unknown): string => {
    if (typeof arg === 'string') {
        return arg;
    }
    if (arg instanceof Error) {
        return formatError(arg);
    }
    return Bun.inspect(arg, { colors: pc.isColorSupported, depth: 4 });
};

const format = (type: LogType, args: unknown[]): string => {
    const { badge, color, tint } = styles[type];
    const prefix = `${pc.dim(new Date().toTimeString().slice(0, 8))} ${color(badge)} `;
    // continuation lines are aligned with the first line's message
    const indent = ' '.repeat(Bun.stringWidth(prefix));
    // errors following a message start on their own line
    return args
        .map((arg, index) => `${index === 0 ? '' : arg instanceof Error ? '\n' : ' '}${formatArg(arg)}`)
        .join('')
        .trimEnd()
        .split('\n')
        .map((line, index) => `${index === 0 ? prefix : indent}${tint ? tint(line) : line}`)
        .join('\n');
};

export const createLogger = (levels: Array<Level>): Logger => {
    let isBuffered = false;
    const buffer: Array<{ type: LogType; args: unknown[] }> = [];

    const log = (type: LogType, ...args: unknown[]) => {
        if (isBuffered) {
            buffer.push({ type, args });
            return;
        }
        const { level } = styles[type];
        if (level !== null && !levels.includes(level)) {
            return;
        }
        process.stdout.write(`${format(type, args)}\n`);
    };

    return {
        setBuffered: (buffered: boolean) => {
            isBuffered = buffered;
        },
        flush: () => {
            isBuffered = false;
            if (buffer.length > 0) {
                log('debug', pc.bold(`Some logs were collected while in Buffered Mode.`));
                buffer.splice(0).forEach(({ type, args }) => log(type, ...args));
            }
        },
        success: (...args: unknown[]) => log('success', ...args),
        error: (...args: unknown[]) => log('error', ...args),
        warn: (...args: unknown[]) => log('warn', ...args),
        start: (...args: unknown[]) => log('start', ...args),
        pause: (...args: unknown[]) => log('pause', ...args),
        info: (...args: unknown[]) => log('info', ...args),
        debug: (...args: unknown[]) => log('debug', ...args),
        note: (...args: unknown[]) => log('note', ...args),
        fatal: (...args: unknown[]) => log('fatal', ...args),
        complete: (...args: unknown[]) => log('complete', ...args),
        log: (...args: unknown[]) => log('log', ...args),
        await: (...args: unknown[]) => log('await', ...args),
        pending: (...args: unknown[]) => log('pending', ...args),
        watch: (...args: unknown[]) => log('watch', ...args),
    };
};
