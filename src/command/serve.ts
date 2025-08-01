import type { CommandBus } from '../domain/contracts/bus';
import type { Logger } from '../domain/contracts/logger';
import { Command } from 'commander';
import type { Boilerplate } from '../domain/contracts/models/boilerplate';
import { boilerplates } from '../content/boilerplates';
import type { FeedbackMessage, FeedbackPiper } from '../domain/contracts/feedback-piper';
import { MessageCode } from '../domain/contracts/message-codes';
import packageJson from '../../package.json';
import pc from 'picocolors';

type Deps = {
    logger: Logger;
    commandBus: CommandBus;
    feedbackPiper: FeedbackPiper;
    crystallizeEnvironment: 'staging' | 'production';
};

export const createServeCommand = ({ logger, commandBus, feedbackPiper, crystallizeEnvironment }: Deps): Command => {
    const command = new Command('serve');
    command.description('Serve the CLI as a HTTP web server to expose a subset of the available commands.');
    command.action(async () => {
        return new Promise<void>((resolve, reject) => {
            try {
                const allowedHostnames = Bun.env.ALLOWED_CORS_HOSTNAMES?.split(',').map((h) => h.trim()) || [];
                const isOriginAllowed = (origin: string): boolean => {
                    try {
                        const url = new URL(origin);
                        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
                            return true;
                        }
                        return allowedHostnames.some(
                            (hostname) => url.hostname === hostname || url.hostname.endsWith(`.${hostname}`),
                        );
                    } catch {
                        return false;
                    }
                };

                const getCorsHeaders = (origin?: string): Record<string, string> => {
                    if (!origin) {
                        return {};
                    }
                    if (!isOriginAllowed(origin)) {
                        return {};
                    }
                    return {
                        'Access-Control-Allow-Origin': origin,
                        'Access-Control-Allow-Methods': 'GET, OPTIONS',
                        'Access-Control-Allow-Headers':
                            'Content-Type, X-Crystallize-Access-Token-Id, X-Crystallize-Access-Token-Secret',
                        'Access-Control-Allow-Credentials': 'true',
                    };
                };
                const server = Bun.serve({
                    idleTimeout: 255,
                    port: 3000,
                    routes: {
                        '/enroll-tenant/:tenantIdentifier/:boiler': (req) => {
                            const origin = req.headers.get('origin');
                            const tenantIdentifier = req.params.tenantIdentifier;
                            const boiler = req.params.boiler;
                            const url = new URL(req.url);
                            const doIgnite = url.searchParams.get('ignite') === 'true';
                            const boilerplate: Boilerplate | undefined = boilerplates.find(
                                (b) => b.identifier === boiler,
                            );
                            if (!boilerplate) {
                                return new Response('Boilerplate identifier is not valid.', { status: 400 });
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
                                        code: MessageCode.ENROLLMENT_STARTED,
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
                                                code: MessageCode.ENROLLMENT_FAILED,
                                            });
                                        }

                                        send({
                                            level: 'info',
                                            message: `Enrolling tenant ${tenantIdentifier} with boilerplate ${boilerplate.name} done!`,
                                            code: MessageCode.ENROLLMENT_COMPLETED,
                                        });
                                    } catch (err) {
                                        send({
                                            level: 'error',
                                            message: `${(err as Error).message}`,
                                            code: MessageCode.ENROLLMENT_ERROR,
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
                                    ...getCorsHeaders(origin || undefined),
                                },
                            });
                        },
                    },
                    fetch: (req) => {
                        const origin = req.headers.get('origin');
                        if (req.method === 'OPTIONS') {
                            return new Response(null, {
                                status: 200,
                                headers: getCorsHeaders(origin || undefined),
                            });
                        }

                        return new Response(
                            `Crystallize CLI - Web Server ${packageJson.version} - ${crystallizeEnvironment}`,
                            {
                                headers: getCorsHeaders(origin || undefined),
                            },
                        );
                    },
                });
                logger.info(
                    `Server ${pc.yellowBright(packageJson.version)} running on ${pc.yellow(`http://localhost:${server.port}`)}, plugged to ${pc.yellowBright(crystallizeEnvironment)} environment.`,
                );
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
