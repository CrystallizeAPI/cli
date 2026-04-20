import { Argument, Command } from 'commander';
import pc from 'picocolors';
import { ZodError, type core } from 'zod';
import { OperationsSchema } from '@crystallize/schema/mass-operation';
import type { Logger } from '../../domain/contracts/logger';
import type { FlySystem } from '../../domain/contracts/fly-system';

type Deps = {
    logger: Logger;
    flySystem: FlySystem;
};

const formatIssuePath = (path: core.$ZodIssue['path']): string => {
    if (path.length === 0) {
        return '<root>';
    }
    return path
        .map((segment, index) => {
            if (typeof segment === 'number') {
                return `[${segment}]`;
            }
            return index === 0 ? String(segment) : `.${String(segment)}`;
        })
        .join('');
};

const extractOperationIndex = (path: core.$ZodIssue['path']): number | null => {
    if (path[0] === 'operations' && typeof path[1] === 'number') {
        return path[1];
    }
    return null;
};

export const createValidateMassOperationCommand = ({ logger, flySystem }: Deps): Command => {
    const command = new Command('validate');
    command.description('Validate a Mass Operation file locally (schema check only, no network).');
    command.addArgument(new Argument('<file>', 'The Mass Operation JSON file to validate.'));

    command.action(async (file: string) => {
        if (!(await flySystem.isFileExists(file))) {
            throw new Error(`File ${file} does not exist.`);
        }

        let content: unknown;
        try {
            content = await flySystem.loadJsonFile(file);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to parse ${file} as JSON: ${message}`);
        }

        const result = OperationsSchema.safeParse(content);
        if (result.success) {
            const count = result.data.operations.length;
            logger.success(`${pc.bold(String(count))} operation(s) validated successfully in ${file}.`);
            return;
        }

        const { issues } = result.error as ZodError;
        const byOperation = new Map<number | 'root', core.$ZodIssue[]>();
        for (const issue of issues) {
            const idx = extractOperationIndex(issue.path);
            const key: number | 'root' = idx ?? 'root';
            const bucket = byOperation.get(key) ?? [];
            bucket.push(issue);
            byOperation.set(key, bucket);
        }

        logger.error(`Validation failed for ${pc.bold(file)}.`);

        const sortedKeys = [...byOperation.keys()].sort((a, b) => {
            if (a === 'root') return -1;
            if (b === 'root') return 1;
            return a - b;
        });

        let counter = 0;
        for (const key of sortedKeys) {
            const bucket = byOperation.get(key) ?? [];
            const header = key === 'root' ? pc.yellow('Root') : pc.yellow(`Operation #${key}`);
            logger.info(`${header} — ${bucket.length} issue(s)`);
            for (const issue of bucket) {
                counter++;
                const path = formatIssuePath(issue.path);
                logger.info(
                    `  ${pc.dim(`${counter}.`)} ${pc.cyan(path)} ${pc.dim('·')} ${pc.red(issue.message)} ${pc.dim(`(${issue.code})`)}`,
                );
            }
        }

        const opCount = sortedKeys.filter((k) => k !== 'root').length;
        const opSuffix = byOperation.has('root') && opCount === 0 ? '' : ` in ${opCount} operation(s)`;
        throw new Error(`${issues.length} error(s)${opSuffix}.`);
    });

    return command;
};
