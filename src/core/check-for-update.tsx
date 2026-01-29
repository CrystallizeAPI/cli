import pc from 'picocolors';
import type { Logger } from '../domain/contracts/logger';
//@ts-expect-error - This is a workaround to import the changelog file as text. It's working with bun.
import Changelog from '../../CHANGELOG.md' with { type: 'text' };
import { marked } from 'marked';
import { Box, render, Text } from 'ink';
import { colors } from './styles';

const GITHUB_RELEASES_URL = 'https://api.github.com/repos/crystallizeapi/cli/releases/latest';
const REINSTALL_COMMAND = 'curl -LSs https://crystallizeapi.github.io/cli/install.bash | bash';

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

const loadChangelog = async () => {
    try {
        const lines = Changelog.split(/\r?\n/);
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
    const entries = await loadChangelog();
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

export const checkForUpdate = async (logger: Logger, currentVersion: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    try {
        const latestVersion = await fetchLatestVersion(controller.signal);
        if (!latestVersion || compareVersions(latestVersion, currentVersion) <= 0) {
            return;
        }

        const notes = await getChangelogNotes(currentVersion, latestVersion);
        const headline = `${pc.bold('Update available:')} ${pc.yellow(currentVersion)} ${pc.dim('->')} ${pc.green(
            latestVersion,
        )}`;
        logger.note(headline);
        if (notes) {
            logger.info(pc.bold('Changes (from CHANGELOG.md):'));
            console.log(marked.parse(notes));
        } else {
            logger.info(pc.bold('Changes (from CHANGELOG.md):'));
            logger.info(`- No entry found for version ${latestVersion}.`);
        }
        render(
            <Box
                flexDirection="column"
                borderColor={colors.info}
                borderStyle={'bold'}
                alignItems="center"
                width={100}
                marginLeft={2}
            >
                <Text>Reinstall</Text>
                <Text>{pc.cyan(REINSTALL_COMMAND)}</Text>
            </Box>,
        );
    } finally {
        clearTimeout(timeout);
    }
};
