import { describe, expect, test } from 'bun:test';
import { parseSuperfastShops } from '../../../src/domain/use-cases/fetch-superfast-shops';

const store = {
    id: 'photo-store',
    name: 'Photo Store',
    url: 'https://photo-store.superfast.shop',
    industry: 'Camera retail',
    description: 'Camera and photo equipment.',
    features: ['Vector ranking', 'Forgiving search'],
    isNew: true,
    prompt: '# Build my own camera store',
    promptUrl: 'https://superfast.shop/demos/photo-store/prompt.md',
    color: '#4f46e5',
};

describe('parseSuperfastShops', () => {
    test('maps the stores to shops and ignores the fields it does not use', () => {
        expect(parseSuperfastShops({ site: 'https://superfast.shop', stores: [store] })).toEqual([
            {
                id: 'photo-store',
                name: 'Photo Store',
                url: 'https://photo-store.superfast.shop',
                industry: 'Camera retail',
                description: 'Camera and photo equipment.',
                features: ['Vector ranking', 'Forgiving search'],
                isNew: true,
                prompt: '# Build my own camera store',
                promptUrl: 'https://superfast.shop/demos/photo-store/prompt.md',
            },
        ]);
    });

    test('skips the stores without an id, a name or a prompt', () => {
        const shops = parseSuperfastShops({
            stores: [
                { ...store, id: undefined },
                { ...store, id: 'no-name', name: '' },
                { ...store, id: 'no-prompt', prompt: null },
                { ...store, id: 'kept' },
                'not a store',
            ],
        });
        expect(shops.map((shop) => shop.id)).toEqual(['kept']);
    });

    test('defaults the optional fields', () => {
        const [shop] = parseSuperfastShops({ stores: [{ id: 'bare', name: 'Bare', prompt: 'Build it' }] });
        expect(shop).toEqual({
            id: 'bare',
            name: 'Bare',
            url: '',
            industry: '',
            description: '',
            features: [],
            isNew: false,
            prompt: 'Build it',
            promptUrl: '',
        });
    });

    test('rejects a payload without a stores list', () => {
        expect(() => parseSuperfastShops({ demos: [] })).toThrow('Unexpected format');
        expect(() => parseSuperfastShops('<html>')).toThrow('Unexpected format');
    });
});
