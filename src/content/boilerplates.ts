import type { Boilerplate } from '../domain/contracts/models/boilerplate';

export const boilerplates: Boilerplate[] = [
    {
        identifier: 'nextjs-furnitut-boilerplate',
        name: 'Furnitut Next.js Boilerplate',
        baseline: 'Complete ecommerce using Next.js',
        description: 'React, SSR, Ecommerce with basket & checkout, payments, etc.',
        demo: 'https://www.furnitut.com/',
        blueprint: 'furnitut',
        git: 'https://github.com/CrystallizeAPI/nextjs-furnitut',
    },
    {
        identifier: 'nerd-factory-boilerplate',
        name: 'Nerd Factory Boilerplate',
        baseline: 'The subcscrition accelerator built with Next.js 15',
        description: 'React, SSR, Ecommerce with Subscription, Partial Prerendering, authentication etc.',
        demo: 'https://nerdfactory.app',
        blueprint: 'subscription-masterclass',
        git: 'https://github.com/CrystallizeAPI/nerd-factory-boilerplate',
    },
];
