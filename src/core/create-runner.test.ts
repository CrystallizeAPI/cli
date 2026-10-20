import { describe, expect, test } from 'bun:test';
import { createRunner } from './create-runner';

const runner = createRunner();

describe('runner', () => {
    test('returns 0 when the command succeeds', async () => {
        expect(await runner(['sh', '-c', 'exit 0'])).toBe(0);
    });

    test('returns the exit code of a failing command', async () => {
        expect(await runner(['sh', '-c', 'exit 3'])).toBe(3);
    });

    test('streams the output to the callbacks', async () => {
        let stdout = '';
        let stderr = '';
        await runner(
            ['sh', '-c', 'echo out; echo err >&2'],
            (data) => (stdout += data.toString()),
            (data) => (stderr += data.toString()),
        );
        expect(stdout).toBe('out\n');
        expect(stderr).toBe('err\n');
    });
});
