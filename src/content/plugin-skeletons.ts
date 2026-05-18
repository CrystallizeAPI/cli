import type { PluginSkeleton } from '../domain/contracts/models/plugin-skeleton';

export const pluginSkeletons: PluginSkeleton[] = [
    {
        identifier: 'hono-plugin-skeleton',
        name: 'Hono Plugin Skeleton',
        baseline: 'Minimal Crystallize plugin server built with Hono and React',
        description: 'A vendor-hosted plugin upstream server: config schema, post-install webhook, payload decryption.',
        git: 'https://github.com/CrystallizeAPI/plugins',
        subfolder: 'plugins/crystallize-plugin-skeleton',
        branch: 'main',
    },
    {
        identifier: 'cloudflare-hono-plugin-buddy',
        name: 'Cloudflare Hono Plugin Buddy (not a Skeleton but an example)',
        baseline: 'Crystallize plugin server built with Hono and React, designed for deployment on Cloudflare Workers.',
        description:
            'A vendor-hosted plugin upstream server: config schema, post-install webhook, payload decryption. Includes Cloudflare-specific optimizations and deployment configuration.',
        git: 'https://github.com/CrystallizeAPI/plugins',
        subfolder: 'plugins/crystallize-buddy',
        branch: 'main',
    },
    {
        identifier: 'hello-world-plugin',
        name: 'Hello World Plugin (not a Skeleton but an example)',
        baseline: 'A simple Crystallize plugin server.',
        description:
            'A minimal plugin server that responds to installation and configuration events with basic logging. Ideal for learning and testing plugin development.',
        git: 'https://github.com/CrystallizeAPI/plugins',
        subfolder: 'plugins/hello-world',
        branch: 'main',
    },
];
