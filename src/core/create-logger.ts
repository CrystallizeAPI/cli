import Signale from 'signale';
import type { Logger } from '../domain/contracts/logger';
import pc from 'picocolors';

export const createLogger = (scope: string, levels: Array<'info' | 'debug'>): Logger => {
    let isBuffered = false;
    const buffer: Array<{ type: string; args: unknown[] }> = [];
    const signale = new Signale.Signale({
        logLevel: 'info', // we always display the maximum level of Signal and filter later
        interactive: false,
        scope,
        config: {
            displayTimestamp: true,
            displayDate: true,
            displayScope: false,
            displayLabel: false,
        },
    });

    const log = (type: string, ...args: any[]) => {
        if (isBuffered) {
            buffer.push({ type, args });
            return;
        }
        switch (type) {
            case 'info':
                if (levels.includes('info')) {
                    signale.info(...args);
                }
                break;
            case 'debug':
                if (levels.includes('debug')) {
                    signale.debug(...args);
                }
                break;
            case 'log':
                if (levels.includes('debug')) {
                    signale.log(...args);
                }
                break;
            case 'warn':
                signale.warn(...args);
                break;
            case 'error':
                signale.error(...args);
                break;
            case 'fatal':
                signale.fatal(...args);
                break;
            case 'success':
                if (levels.includes('info')) {
                    signale.success(...args);
                }
                break;
            case 'start':
                if (levels.includes('info')) {
                    signale.start(...args);
                }
                break;
            case 'note':
                if (levels.includes('info')) {
                    signale.note(...args);
                }
                break;
            case 'await':
                if (levels.includes('info')) {
                    signale.await(...args);
                }
                break;
            case 'complete':
                if (levels.includes('info')) {
                    signale.complete(...args);
                }
                break;
            case 'pause':
                if (levels.includes('info')) {
                    signale.pause(...args);
                }
                break;
            case 'pending':
                if (levels.includes('info')) {
                    signale.pending(...args);
                }
                break;
            case 'watch':
                if (levels.includes('info')) {
                    signale.watch(...args);
                }
                break;
            default:
                throw new Error(`Invalid log type: ${type}`);
        }
    };

    return {
        setBuffered: (buffered: boolean) => {
            isBuffered = buffered;
        },
        flush: () => {
            isBuffered = false;
            if (buffer.length > 0) {
                log('debug', pc.bold(`Some logs were collected while in Buffered Mode.`));
                buffer.forEach(({ type, args }) => log(type, ...args));
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
