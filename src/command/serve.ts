import type { CommandBus } from '../domain/contracts/bus';
import type { Logger } from '../domain/contracts/logger';
import { Command } from 'commander';
import type { Boilerplate } from '../domain/contracts/models/boilerplate';
import { boilerplates } from '../content/boilerplates';
import type { FeedbackMessage, FeedbackPiper } from '../domain/contracts/feedback-piper';

type Deps = {
    logger: Logger;
    commandBus: CommandBus;
    feedbackPiper: FeedbackPiper;
};

export const createServeCommand = ({ logger, commandBus, feedbackPiper }: Deps): Command => {
    const command = new Command('serve');
    command.description('Serve the CLI as a HTTP web server to expose a subset of the available commands.');
    command.action(async () => {
        return new Promise<void>((resolve, reject) => {
            try {
                const server = Bun.serve({
                    idleTimeout: 255,
                    port: 3000,
                    routes: {
                        '/enroll-tenant/:tenantIdentifier/:boiler': (req) => {
                            const tenantIdentifier = req.params.tenantIdentifier;
                            const boiler = req.params.boiler;
                            const url = new URL(req.url);
                            const doIgnite = url.searchParams.get('ignite') === 'true';
                            const boilerplate: Boilerplate | undefined = boilerplates.find(
                                (b) => b.identifier === boiler,
                            );
                            if (!boilerplate) {
                                return new Response('Missing boilerplate', { status: 400 });
                            }
                            const sessionId = req.headers.get('cookie')?.match(/connect\.sid=([^;]+)/)?.[1];
                            const tokenId = req.headers.get('X-Crystallize-Access-Token-Id');
                            const tokenSecret = req.headers.get('X-Crystallize-Access-Token-Secret');
                            if (!sessionId) {
                                if (!tokenId || !tokenSecret) {
                                    return new Response('Missing credentials', { status: 400 });
                                }
                            }
                            const stream = new ReadableStream({
                                async start(controller) {
                                    const send = (feedback: FeedbackMessage) => {
                                        try {
                                            controller.enqueue(`data: ${JSON.stringify(feedback)}\n\n`);
                                        } catch {}
                                    };
                                    const pingInterval = setInterval(() => {
                                        try {
                                            controller.enqueue(`data: ping\n\n`);
                                        } catch {}
                                    }, 3000);

                                    feedbackPiper.subscribe(send);
                                    send({
                                        level: 'info',
                                        message: `Enrolling tenant ${tenantIdentifier} with boilerplate ${boilerplate.name} started.`,
                                    });
                                    try {
                                        const intent = commandBus.createCommand('EnrollTenantWithBoilerplatePackage', {
                                            tenantIdentifier: tenantIdentifier,
                                            credentials: sessionId
                                                ? {
                                                      sessionId,
                                                  }
                                                : {
                                                      ACCESS_TOKEN_ID: tokenId || '',
                                                      ACCESS_TOKEN_SECRET: tokenSecret || '',
                                                  },
                                            boilerplate,
                                            doIgnite: doIgnite || false,
                                        });
                                        const { result } = await commandBus.dispatch(intent);

                                        if (!result) {
                                            send({
                                                level: 'error',
                                                message: `Enrolling tenant ${tenantIdentifier} with boilerplate ${boilerplate.name} failed.`,
                                            });
                                        }

                                        send({
                                            level: 'info',
                                            message: `Enrolling tenant ${tenantIdentifier} with boilerplate ${boilerplate.name} done!`,
                                        });
                                    } catch (err) {
                                        send({
                                            level: 'error',
                                            message: `${(err as Error).message}`,
                                        });
                                    } finally {
                                        clearInterval(pingInterval);
                                        feedbackPiper.unsubscribe(send);
                                        controller.close();
                                    }
                                },
                            });
                            return new Response(stream, {
                                headers: {
                                    'Content-Type': 'text/event-stream',
                                    'Cache-Control': 'no-cache',
                                    Connection: 'keep-alive',
                                },
                            });
                        },
                    },
                    fetch: () => {
                        return new Response('Crystallize CLI - Web Server');
                    },
                });
                logger.info(`Server running on http://localhost:${server.port}`);
                process.on('SIGINT', () => {
                    logger.info('Shutting down server...');
                    server.stop();
                    resolve();
                });
                process.on('SIGTERM', () => {
                    logger.info('Shutting down server...');
                    server.stop();
                    resolve();
                });
            } catch (error) {
                reject(error);
            }
        });
    });
    return command;
};
