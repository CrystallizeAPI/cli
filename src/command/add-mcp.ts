import type { CredentialRetriever } from '../domain/contracts/credential-retriever';
import type { Logger } from '../domain/contracts/logger';
import { Command } from 'commander';
import { addInteractiveAndTokenOption } from '../core/helpers/add-iteractive-and-token-option';
import pc from 'picocolors';

type Deps = {
    credentialsRetriever: CredentialRetriever;
    logger: Logger;
};

export const createAddMcpCommand = ({ credentialsRetriever, logger }: Deps): Command => {
    const command = new Command('add-mcp');
    command.description('Add the Crystallize MCP server to your environment.');
    addInteractiveAndTokenOption(command);
    command.action(async (options) => {
        const credentials = await credentialsRetriever.getCredentials({
            token_id: options.token_id,
            token_secret: options.token_secret,
        });

        if (!credentials.ACCESS_TOKEN_ID || !credentials.ACCESS_TOKEN_SECRET) {
            logger.error('Access token credentials are required to add the MCP server. Please login first.');
            process.exit(1);
        }

        logger.info(`Adding Crystallize MCP server...`);

        const proc = Bun.spawn(
            [
                process.execPath,
                'x',
                'add-mcp',
                'https://mcp.crystallize.com/mcp',
                '--header',
                `X-Crystallize-Access-Token-Id: ${credentials.ACCESS_TOKEN_ID}`,
                '--header',
                `X-Crystallize-Access-Token-Secret: ${credentials.ACCESS_TOKEN_SECRET}`,
            ],
            {
                env: { ...process.env, BUN_BE_BUN: '1' },
                stdin: 'inherit',
                stdout: 'inherit',
                stderr: 'inherit',
            },
        );

        await proc.exited;

        if (proc.exitCode === 0) {
            logger.info(pc.green('Crystallize MCP server added successfully!'));
            logger.warn(
                pc.yellow(
                    'The MCP configuration file now contains your access tokens. Make sure you do not commit this file to version control.',
                ),
            );
        } else {
            logger.error('Failed to add Crystallize MCP server.');
            process.exit(proc.exitCode || 1);
        }
    });
    return command;
};
