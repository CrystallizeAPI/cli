import pc from 'picocolors';
import { chmod, unlink, rename, writeFile } from 'node:fs/promises';
import { marked } from 'marked';
import cliSpinners from 'cli-spinners';
import { Box, Text, render } from 'ink';
import type { Logger } from '../domain/contracts/logger';
import { colors } from './styles';

const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const createTerminalSpinner = (message: string) => {
    const spinner = cliSpinners.dots;
    let frame = 0;
    const timer = setInterval(() => {
        const symbol = spinner.frames[frame % spinner.frames.length];
        process.stdout.write(`\r${pc.cyan(symbol)} ${message}`);
        frame++;
    }, spinner.interval);
    return {
        stop: (finalMessage?: string) => {
            clearInterval(timer);
            process.stdout.write(`\r${' '.repeat(message.length + 4)}\r`);
            if (finalMessage) {
                process.stdout.write(`${finalMessage}\n`);
            }
        },
    };
};

const createProgressBar = (label: string, total: number) => {
    const barWidth = 30;
    const update = (downloaded: number) => {
        const percent = Math.min(100, Math.round((downloaded / total) * 100));
        const filled = Math.round((percent / 100) * barWidth);
        const empty = barWidth - filled;
        const bar = `${pc.green('█'.repeat(filled))}${pc.dim('░'.repeat(empty))}`;
        process.stdout.write(`\r${label} ${bar} ${percent}% ${formatBytes(downloaded)}/${formatBytes(total)}`);
    };
    const stop = () => {
        process.stdout.write('\n');
    };
    return { update, stop };
};

const GITHUB_RELEASES_URL = 'https://api.github.com/repos/crystallizeapi/cli/releases/latest';
const GITHUB_CHANGELOG_URL = (version: string) =>
    `https://raw.githubusercontent.com/CrystallizeAPI/cli/${version}/CHANGELOG.md`;
const REINSTALL_COMMAND = 'curl -LSs https://crystallizeapi.github.io/cli/install.bash | bash';

const PLATFORM_MAP: Record<string, string> = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'windows',
};

const ARCH_MAP: Record<string, string> = {
    x64: 'x64',
    arm64: 'arm64',
};

type ChangelogEntry = {
    version: string;
    body: string;
};

const normalizeVersion = (version: string) => version.trim().replace(/^v/i, '');

const parseVersion = (version: string) => {
    const match = normalizeVersion(version).match(/(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
        return null;
    }
    return match.slice(1).map((value) => Number(value)) as [number, number, number];
};

const compareVersions = (left: string, right: string) => {
    const leftParts = parseVersion(left);
    const rightParts = parseVersion(right);
    if (!leftParts || !rightParts) {
        return 0;
    }
    for (let index = 0; index < leftParts.length; index += 1) {
        if (leftParts[index] !== rightParts[index]) {
            return leftParts[index] > rightParts[index] ? 1 : -1;
        }
    }
    return 0;
};

const fetchChangelog = async (tag: string): Promise<string | null> => {
    try {
        const response = await fetch(GITHUB_CHANGELOG_URL(tag), {
            headers: { 'User-Agent': 'crystallize-cli' },
        });
        if (!response.ok) {
            return null;
        }
        return await response.text();
    } catch {
        return null;
    }
};

const loadChangelog = async (tag: string) => {
    try {
        const content = await fetchChangelog(tag);
        if (!content) {
            return [];
        }
        const lines = content.split(/\r?\n/);
        const entries: ChangelogEntry[] = [];
        let current: ChangelogEntry | null = null;

        for (const line of lines) {
            const match = line.match(/^##\s+\[([^\]]+)\]\s*$/);
            if (match) {
                if (current) {
                    current.body = current.body.trim();
                    entries.push(current);
                }
                current = { version: match[1], body: '' };
                continue;
            }
            if (current) {
                current.body += `${line}\n`;
            }
        }
        if (current) {
            current.body = current.body.trim();
            entries.push(current);
        }

        return entries;
    } catch {
        return [];
    }
};

const getChangelogNotes = async (currentVersion: string, latestVersion: string) => {
    const entries = await loadChangelog(latestVersion);
    if (entries.length === 0) {
        return '';
    }

    const notes = entries.filter((entry) => {
        return compareVersions(entry.version, currentVersion) > 0 && compareVersions(entry.version, latestVersion) <= 0;
    });

    if (notes.length === 0) {
        const directMatch = entries.find(
            (entry) => normalizeVersion(entry.version) === normalizeVersion(latestVersion),
        );
        return directMatch?.body ?? '';
    }

    return notes
        .map((entry) => {
            const body = entry.body.trim();
            if (!body) {
                return `## ${entry.version}\n- No details listed.`;
            }
            return `## ${entry.version}\n${body}`;
        })
        .join('\n\n')
        .trim();
};

const fetchLatestVersion = async (signal?: AbortSignal) => {
    try {
        const response = await fetch(GITHUB_RELEASES_URL, {
            signal,
            headers: {
                'User-Agent': 'crystallize-cli',
                Accept: 'application/vnd.github+json',
            },
        });
        if (!response.ok) {
            return null;
        }
        const payload = (await response.json()) as { tag_name?: string; name?: string };
        const version = payload.tag_name || payload.name;
        return version ? normalizeVersion(version) : null;
    } catch {
        return null;
    }
};

const getPlatformAssetName = (): string => {
    const os = PLATFORM_MAP[process.platform];
    const arch = ARCH_MAP[process.arch];
    if (!os || !arch) {
        throw new Error(`Unsupported platform: ${process.platform}-${process.arch}`);
    }
    const ext = process.platform === 'win32' ? '.exe' : '';
    return `crystallize-bun-${os}-${arch}${ext}`;
};

type Deps = {
    logger: Logger;
};

export const createUpdater = ({ logger }: Deps) => {
    const displayChangelog = async (currentVersion: string, latestVersion: string) => {
        const notes = await getChangelogNotes(currentVersion, latestVersion);
        logger.info(pc.bold('Changes (from CHANGELOG.md):'));
        if (notes) {
            console.log(marked.parse(notes));
        } else {
            logger.info(`- No entry found for version ${latestVersion}.`);
        }
    };

    const checkForUpdate = async (currentVersion: string) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1200);

        try {
            const latestVersion = await fetchLatestVersion(controller.signal);
            if (!latestVersion || compareVersions(latestVersion, currentVersion) <= 0) {
                return;
            }

            const notes = await getChangelogNotes(currentVersion, latestVersion);
            const headline = `${pc.bold('Update available:')} ${pc.yellow(currentVersion)} ${pc.dim('->')} ${pc.green(latestVersion)}`;
            logger.note(headline);
            if (notes) {
                logger.info(pc.bold('Changes (from CHANGELOG.md):'));
                console.log(marked.parse(notes));
            } else {
                logger.info(pc.bold('Changes (from CHANGELOG.md):'));
                logger.info(`- No entry found for version ${latestVersion}.`);
            }
            const { unmount } = render(
                <Box
                    flexDirection="column"
                    borderColor={colors.info}
                    borderStyle="bold"
                    alignItems="center"
                    width={100}
                    marginLeft={2}
                >
                    <Text>
                        Run <Text color="cyan">~/crystallize update</Text> to update.
                    </Text>
                </Box>,
            );
            unmount();
        } finally {
            clearTimeout(timeout);
        }
    };

    const performSelfUpdate = async (tag: string): Promise<{ success: boolean; error?: string }> => {
        const assetName = getPlatformAssetName();
        const url = `https://github.com/CrystallizeAPI/cli/releases/download/${tag}/${assetName}`;
        const execPath = process.execPath;
        const tmpPath = `${execPath}.update-tmp`;

        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'crystallize-cli' },
                redirect: 'follow',
            });
            if (!response.ok) {
                return { success: false, error: `Download failed: HTTP ${response.status}` };
            }

            const contentLength = Number(response.headers.get('content-length') || 0);
            const body = response.body;
            if (!body) {
                return { success: false, error: 'Empty response body.' };
            }

            const chunks: Uint8Array[] = [];
            let downloaded = 0;

            if (contentLength > 0) {
                const progress = createProgressBar('Downloading', contentLength);
                for await (const chunk of body) {
                    chunks.push(chunk);
                    downloaded += chunk.length;
                    progress.update(downloaded);
                }
                progress.stop();
            } else {
                const spinner = createTerminalSpinner('Downloading...');
                for await (const chunk of body) {
                    chunks.push(chunk);
                    downloaded += chunk.length;
                }
                spinner.stop();
            }

            const merged = new Uint8Array(downloaded);
            let offset = 0;
            for (const chunk of chunks) {
                merged.set(chunk, offset);
                offset += chunk.length;
            }
            await writeFile(tmpPath, merged);

            if (merged.length < 1_000_000) {
                await unlink(tmpPath).catch(() => {});
                return { success: false, error: 'Downloaded file is too small — possibly corrupted.' };
            }

            await chmod(tmpPath, 0o755);

            if (process.platform === 'win32') {
                const oldPath = `${execPath}.old`;
                await rename(execPath, oldPath);
                await rename(tmpPath, execPath);
            } else {
                await unlink(execPath);
                await rename(tmpPath, execPath);
            }

            return { success: true };
        } catch (err) {
            await unlink(tmpPath).catch(() => {});
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, error: message };
        }
    };

    const update = async (currentVersion: string) => {
        const checkSpinner = createTerminalSpinner('Checking for updates...');
        const latestVersion = await fetchLatestVersion();
        if (!latestVersion) {
            checkSpinner.stop();
            logger.error('Could not check for updates. Please try again later.');
            return;
        }

        if (compareVersions(latestVersion, currentVersion) <= 0) {
            checkSpinner.stop();
            logger.success(`Already on the latest version (${currentVersion}).`);
            return;
        }
        checkSpinner.stop();

        const headline = `${pc.bold('Update available:')} ${pc.yellow(currentVersion)} ${pc.dim('->')} ${pc.green(latestVersion)}`;
        logger.note(headline);
        await displayChangelog(currentVersion, latestVersion);

        const result = await performSelfUpdate(latestVersion);
        if (result.success) {
            logger.success(`Updated to ${latestVersion}.`);
        } else {
            logger.error(`Update failed: ${result.error}`);
            logger.info(`You can update manually:\n  ${pc.cyan(REINSTALL_COMMAND)}`);
        }
    };

    return {
        checkForUpdate,
        update,
    };
};

export type Updater = ReturnType<typeof createUpdater>;
