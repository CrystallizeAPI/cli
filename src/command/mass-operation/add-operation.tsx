import { Argument, Command, Option } from 'commander';
import type { Logger } from '../../domain/contracts/logger';
import type { FlySystem } from '../../domain/contracts/fly-system';
import { OperationSchema } from '@crystallize/schema/mass-operation';
import { render } from 'ink';
import { Box, Text } from 'ink';
import { MultiSelect } from '../../ui/components/multi-select';
type Deps = {
    logger: Logger;
    flySystem: FlySystem;
};

/**
 * Zod v4 runtime schema introspection type.
 * We walk schema internals to generate operation skeletons,
 * which requires accessing properties not on the public z.ZodType interface.
 */
type SchemaNode = {
    _zod: {
        def: {
            type: string;
            innerType?: SchemaNode;
            values?: unknown[];
            options?: SchemaNode[];
            left?: SchemaNode;
            right?: SchemaNode;
        };
    };
    shape?: Record<string, SchemaNode>;
};

type OperationOption = {
    label: string;
    value: string;
    group: string;
    schema: SchemaNode;
};

function getSchemaDefType(schema: SchemaNode): string {
    return schema._zod.def.type;
}

function unwrap(schema: SchemaNode): SchemaNode {
    const def = schema._zod.def;
    if ((def.type === 'optional' || def.type === 'nullable') && def.innerType) {
        return unwrap(def.innerType);
    }
    return schema;
}

function isOptional(schema: SchemaNode): boolean {
    const type = getSchemaDefType(schema);
    return type === 'optional' || type === 'nullable';
}

function generateDefault(schema: SchemaNode): unknown {
    const def = schema._zod.def;

    switch (def.type) {
        case 'string':
            return '';
        case 'number':
            return 0;
        case 'boolean':
            return false;
        case 'literal':
            return def.values?.[0];
        case 'array':
            return [];
        case 'object':
            return generateObjectSkeleton(schema, false);
        case 'optional':
        case 'nullable':
            if (def.innerType) return generateDefault(def.innerType);
            return null;
        case 'union':
            if (def.options?.[0]) {
                return generateDefault(def.options[0]);
            }
            return null;
        case 'enum':
            return def.values?.[0] ?? '';
        case 'intersection': {
            const left = def.left ? generateDefault(def.left) : null;
            const right = def.right ? generateDefault(def.right) : null;
            if (typeof left === 'object' && typeof right === 'object' && left && right) {
                return { ...left, ...right };
            }
            return left ?? right;
        }
        default:
            return null;
    }
}

function generateObjectSkeleton(schema: SchemaNode, isRoot: boolean): Record<string, unknown> {
    const { shape } = schema;
    if (!shape) return {};

    const result: Record<string, unknown> = {};
    for (const [key, fieldSchema] of Object.entries(shape)) {
        if (key === '_ref') continue;

        const opt = isOptional(fieldSchema);
        const alwaysInclude = isRoot && (key === 'resourceIdentifier' || key === 'itemId');

        if (!opt || alwaysInclude) {
            if (alwaysInclude && opt) {
                result[key] = generateDefault(unwrap(fieldSchema));
            } else {
                result[key] = generateDefault(fieldSchema);
            }
        }
    }
    return result;
}

function generateSkeleton(schema: SchemaNode): Record<string, unknown> {
    return generateObjectSkeleton(schema, true);
}

function getOperationOptions(): OperationOption[] {
    const options = (OperationSchema.options as unknown as SchemaNode[]).map((schema) => {
        const intent: string = (schema.shape?.intent?._zod?.def?.values?.[0] as string) ?? '';
        const groupKey = intent.split('/')[0];
        const group = groupKey.charAt(0).toUpperCase() + groupKey.slice(1);

        return {
            label: intent,
            value: intent,
            group,
            schema,
        };
    });
    options.sort((a, b) => a.group.localeCompare(b.group));
    return options;
}

export const createAddOperationMassOperationCommand = ({ logger, flySystem }: Deps): Command => {
    const command = new Command('add-operation');
    command.description('Add operation skeleton(s) to a Mass Operation file.');
    command.addArgument(new Argument('<file>', 'The Mass Operation JSON file to add operations to.'));
    command.addOption(
        new Option('--operation <intent>', 'Operation intent to add (repeatable).').argParser<string[]>(
            (value: string, previous: string[]) => (previous ? [...previous, value] : [value]),
        ),
    );
    command.addOption(new Option('--no-interactive', 'Disable the interactive mode.'));

    command.action(async (file: string, flags: { operation?: string[]; interactive: boolean }) => {
        const allOptions = getOperationOptions();
        const validIntents = new Set(allOptions.map((o) => o.value));

        let data: { version: string; operations: Record<string, unknown>[] };
        if (await flySystem.isFileExists(file)) {
            data = await flySystem.loadJsonFile<typeof data>(file);
            logger.note(`Loaded existing file: ${file}`);
        } else {
            data = { version: '1.0.0', operations: [] };
            logger.note(`Creating new file: ${file}`);
        }

        let selectedIntents: string[];

        if (flags.interactive && !flags.operation) {
            // Interactive mode
            let picked: string[] = [];
            const { waitUntilExit, unmount } = render(
                <Box flexDirection="column" padding={1}>
                    <Text>Select operations to add:</Text>
                    <MultiSelect<string>
                        options={allOptions.map((o) => ({
                            label: o.label,
                            value: o.value,
                            group: o.group,
                        }))}
                        onConfirm={(values) => {
                            picked = values;
                            unmount();
                        }}
                    />
                </Box>,
                { exitOnCtrlC: true },
            );
            await waitUntilExit();

            if (picked.length === 0) {
                logger.warn('No operations selected.');
                return;
            }
            selectedIntents = picked;
        } else {
            // Non-interactive mode
            if (!flags.operation || flags.operation.length === 0) {
                throw new Error('You must provide at least one --operation <intent> when not running interactively.');
            }
            for (const intent of flags.operation) {
                if (!validIntents.has(intent)) {
                    throw new Error(
                        `Invalid operation intent: "${intent}". Valid intents: ${[...validIntents].join(', ')}`,
                    );
                }
            }
            selectedIntents = flags.operation;
        }

        for (const intent of selectedIntents) {
            const option = allOptions.find((o) => o.value === intent);
            if (!option) continue;
            const skeleton = generateSkeleton(option.schema);
            data.operations.push(skeleton);
            logger.info(`Added operation: ${intent}`);
        }

        await flySystem.saveFile(file, JSON.stringify(data, null, 2) + '\r\n');
        logger.success(`Saved ${selectedIntents.length} operation(s) to ${file}.`);
    });

    return command;
};
