import { describe, expect, test } from 'bun:test';
import { deriveReverseDns, isValidReverseDns, kebab, resolveIdentifier } from './plugin-identifier';

describe('plugin-identifier', () => {
    test('kebab normalizes arbitrary input', () => {
        expect(kebab('My Cool Plugin')).toBe('my-cool-plugin');
        expect(kebab('  Spaced   Out  ')).toBe('spaced-out');
        expect(kebab('Already-kebab')).toBe('already-kebab');
        expect(kebab('Mixed_Case 123')).toBe('mixed-case-123');
    });

    test('isValidReverseDns accepts well-formed reverse-DNS', () => {
        expect(isValidReverseDns('com.yourcompany.plugin')).toBe(true);
        expect(isValidReverseDns('com.acme')).toBe(true);
        expect(isValidReverseDns('com.acme-inc.my-plugin')).toBe(true);
        expect(isValidReverseDns('io.crystallize.plugins.demo')).toBe(true);
    });

    test('isValidReverseDns rejects malformed input', () => {
        expect(isValidReverseDns('my-plugin')).toBe(false); // no dot
        expect(isValidReverseDns('Com.Acme.Plugin')).toBe(false); // uppercase
        expect(isValidReverseDns('com..plugin')).toBe(false); // empty segment
        expect(isValidReverseDns('com.plugin.')).toBe(false); // trailing dot
        expect(isValidReverseDns('.com.plugin')).toBe(false); // leading dot
        expect(isValidReverseDns('com plugin')).toBe(false); // space
        expect(isValidReverseDns('')).toBe(false);
    });

    test('deriveReverseDns builds a default from the plugin name', () => {
        expect(deriveReverseDns('My Cool Plugin')).toBe('com.example.my-cool-plugin');
        expect(deriveReverseDns('')).toBe('com.example.my-plugin');
    });

    test('resolveIdentifier prefers valid input, falls back to derived default', () => {
        expect(resolveIdentifier('com.acme.demo', 'Whatever')).toBe('com.acme.demo');
        expect(resolveIdentifier('  com.acme.demo  ', 'Whatever')).toBe('com.acme.demo');
        expect(resolveIdentifier('', 'My Plugin')).toBe('com.example.my-plugin');
        expect(resolveIdentifier(undefined, 'My Plugin')).toBe('com.example.my-plugin');
    });

    test('resolveIdentifier throws on non-empty malformed input', () => {
        expect(() => resolveIdentifier('Bad Id', 'Name')).toThrow(/invalid identifier/);
        expect(() => resolveIdentifier('no-dots', 'Name')).toThrow(/reverse-DNS/);
    });
});
