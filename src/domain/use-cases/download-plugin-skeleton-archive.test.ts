import { describe, expect, test } from 'bun:test';
import { tarOptionsFor } from './download-plugin-skeleton-archive';

describe('tarOptionsFor', () => {
    test('strips only the GitHub root directory when there is no subfolder', () => {
        expect(tarOptionsFor(undefined)).toEqual({ strip: 1 });
        expect(tarOptionsFor('')).toEqual({ strip: 1 });
        expect(tarOptionsFor('/')).toEqual({ strip: 1 });
    });

    test('targets the subfolder below the GitHub root directory', () => {
        expect(tarOptionsFor('plugins/hello-world')).toEqual({ strip: 3, glob: '*/plugins/hello-world/**' });
        expect(tarOptionsFor('hello-world')).toEqual({ strip: 2, glob: '*/hello-world/**' });
    });

    test('ignores leading and trailing slashes', () => {
        expect(tarOptionsFor('/plugins/hello-world/')).toEqual({ strip: 3, glob: '*/plugins/hello-world/**' });
    });
});
