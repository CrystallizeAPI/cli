export const createRunner =
    () =>
    async (
        command: string[],
        onStdOut?: (data: Buffer) => void,
        onStdErr?: (data: Buffer) => void,
    ): Promise<number> => {
        const proc = Bun.spawn(command, {
            stdout: 'pipe',
            stderr: 'pipe',
        });
        const stdOutReader = proc.stdout.getReader();
        const stdErrReader = proc.stderr.getReader();

        const readStream = async (reader: ReadableStreamDefaultReader<Uint8Array>, on?: (data: Buffer) => void) => {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = new TextDecoder().decode(value);
                if (on) {
                    on(Buffer.from(text, 'utf-8'));
                }
            }
        };

        const stdOutPromise = readStream(stdOutReader, onStdOut);
        const stdErrPromise = readStream(stdErrReader, onStdErr);

        await proc.exited;
        await Promise.all([stdOutPromise, stdErrPromise]);
        return proc.exitCode || 1;
    };

export type Runner = ReturnType<typeof createRunner>;
