// Plugin identifiers are reverse-DNS (e.g. `com.yourcompany.plugin`): lowercase,
// dot-separated segments, each segment alphanumeric with optional internal hyphens,
// and at least one dot.
const REVERSE_DNS = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$/;

export const kebab = (value: string): string =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

export const isValidReverseDns = (value: string): boolean => REVERSE_DNS.test(value);

// Suggested default when the user does not provide an identifier. Derived from the
// plugin name, e.g. "My Cool Plugin" -> "com.example.my-cool-plugin".
export const deriveReverseDns = (name: string): string => `com.example.${kebab(name) || 'my-plugin'}`;

export const REVERSE_DNS_HINT = 'reverse-DNS, e.g. com.yourcompany.plugin';

// Resolves the final identifier: a trimmed, valid input wins; an empty input falls
// back to the name-derived default. A non-empty but malformed input throws so the
// caller can surface a validation error.
export const resolveIdentifier = (input: string | undefined, name: string): string => {
    const trimmed = (input ?? '').trim();
    if (trimmed.length === 0) {
        return deriveReverseDns(name);
    }
    if (!isValidReverseDns(trimmed)) {
        throw new Error(`invalid identifier "${trimmed}". must be ${REVERSE_DNS_HINT}`);
    }
    return trimmed;
};
