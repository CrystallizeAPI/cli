import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import { resolveAgentPrompt } from '../../../src/domain/use-cases/launch-coding-agent';

const prompt = '# Build "my" shop\n\n- 50% off & <b>bold</b> | pipes ^ and !bang';

describe('resolveAgentPrompt', () => {
    test('passes the prompt unchanged on macOS and Linux', () => {
        expect(resolveAgentPrompt({ id: 'photo-store', prompt }, 'darwin', '/tmp')).toEqual({ prompt });
        expect(resolveAgentPrompt({ id: 'photo-store', prompt }, 'linux', '/tmp')).toEqual({ prompt });
    });

    test('on Windows, writes the prompt to a file and passes a short instruction to read it', () => {
        const tmpDir = 'C:\\Users\\me\\AppData\\Local\\Temp';
        const resolved = resolveAgentPrompt({ id: 'photo-store', prompt }, 'win32', tmpDir);
        const file = path.join(tmpDir, 'crystallize-superfast-shop-photo-store.md');
        expect(resolved).toEqual({
            prompt: `Read the file ${file} and follow its instructions`,
            promptFile: { path: file, content: prompt },
        });
    });

    test('the Windows instruction has none of the characters cmd.exe launchers reject', () => {
        const resolved = resolveAgentPrompt({ id: 'photo-store', prompt }, 'win32', 'C:\\Temp');
        expect(resolved.prompt).not.toMatch(/["%&|<>^!\r\n]/);
    });

    test('keeps the prompt file in the temporary folder whatever the shop id', () => {
        const resolved = resolveAgentPrompt({ id: '../../evil "id"', prompt }, 'win32', '/tmp/x');
        expect(path.dirname(resolved.promptFile!.path)).toBe('/tmp/x');
        expect(resolved.prompt).not.toMatch(/["%&|<>^!\r\n]/);
    });
});
