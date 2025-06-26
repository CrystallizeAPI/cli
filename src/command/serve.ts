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
                    fetch: async (req: Request) => {
                        if (req.method !== 'POST') {
                            return new Response('Crystallize CLI - Web Server');
                        }
                        const post = await req.json();
                        switch (post.command) {
                            case 'enroll-tenant':
                                if (!post.tenantIdentifier) {
                                    return new Response('Missing tenantIdentifier', { status: 400 });
                                }
                                if (!post.boilerplate) {
                                    return new Response('Missing boilerplate', { status: 400 });
                                }
                                const boilerplate: Boilerplate | undefined = boilerplates.find(
                                    (b) => b.identifier === post.boilerplate,
                                );
                                if (!boilerplate) {
                                    return new Response('Missing boilerplate', { status: 400 });
                                }
                                const sessionId = req.headers.get('cookie')?.match(/connect\.sid=([^;]+)/)?.[1];
                                if (!sessionId) {
                                    if (!post.credentials) {
                                        return new Response('Missing credentials', { status: 400 });
                                    }
                                    return new Response('Missing credentials', { status: 400 });
                                }
                                const stream = new ReadableStream({
                                    async start(controller) {
                                        const send = (feedback: FeedbackMessage) => {
                                            controller.enqueue(`data: ${JSON.stringify(feedback)}\n\n`);
                                        };
                                        const pingInterval = setInterval(() => {
                                            controller.enqueue(`data: ping\n\n`);
                                        }, 3000);

                                        feedbackPiper.subscribe(send);
                                        send({
                                            level: 'info',
                                            message: `Enrolling tenant ${post.tenantIdentifier} with boilerplate ${boilerplate.name} started.`,
                                        });
                                        try {
                                            const intent = commandBus.createCommand(
                                                'EnrollTenantWithBoilerplatePackage',
                                                {
                                                    tenantIdentifier: post.tenantIdentifier,
                                                    credentials: sessionId
                                                        ? {
                                                              sessionId,
                                                          }
                                                        : {
                                                              ACCESS_TOKEN_ID: post.credentials.ACCESS_TOKEN_ID,
                                                              ACCESS_TOKEN_SECRET: post.credentials.ACCESS_TOKEN_SECRET,
                                                          },
                                                    boilerplate,
                                                    doIgnite: post.ignite || false,
                                                },
                                            );
                                            const { result } = await commandBus.dispatch(intent);

                                            if (!result) {
                                                send({
                                                    level: 'error',
                                                    message: `Enrolling tenant ${post.tenantIdentifier} with boilerplate ${boilerplate.name} failed.`,
                                                });
                                            }

                                            send({
                                                level: 'info',
                                                message: `Enrolling tenant ${post.tenantIdentifier} with boilerplate ${boilerplate.name} done!`,
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
                            default:
                                return new Response(`Unknown command: ${post.command}`, { status: 400 });
                        }
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
