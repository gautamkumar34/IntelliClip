// src/electron/safety.ts
// Production-grade secret detection engine (TruffleHog / GitLeaks methodology)

// ─── Blocked Apps ───────────────────────────────────────────────────────────────
const BLOCKED_APPS = [
    '1password', 'bitwarden', 'lastpass', 'keychain',
    'keepass', 'dashlane', 'enpass', 'nordpass',
    'keeper', 'roboform'
];

// ─── Secret Detection Patterns ──────────────────────────────────────────────────
const SECRET_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
    // JWT Tokens — any Base64-encoded JSON header with substantial payload
    { regex: /eyJ[A-Za-z0-9_-]{20,}/, reason: 'jwt_token' },

    // OpenAI / Anthropic secret keys
    { regex: /sk-[a-zA-Z0-9]{20,}/, reason: 'api_key' },

    // GitHub tokens (PAT, OAuth, etc.)
    { regex: /gh[pousr]_[a-zA-Z0-9]{36}/, reason: 'github_token' },
    { regex: /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/, reason: 'github_pat' },

    // Slack tokens
    { regex: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,}/, reason: 'slack_token' },

    // Stripe keys
    { regex: /(?:sk|rk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}/, reason: 'stripe_key' },

    // Google / GCP API keys
    { regex: /AIza[0-9A-Za-z\-_]{35}/, reason: 'gcp_api_key' },

    // AWS Access Keys
    { regex: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/, reason: 'aws_access_key' },

    // AWS Secret Key (typically 40 chars base64)
    { regex: /(?:aws_secret_access_key|aws_secret)\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}["']?/i, reason: 'aws_secret_key' },

    // Generic hardcoded secrets (snake_case AND camelCase)
    { regex: /(?:api_?key|access_?token|secret_?key|client_?secret|password|passwd|auth_?token|bearer)\s*["''"]*\s*[:=]\s*["''"]?\s*[A-Za-z0-9\-_=/.+]{16,}/i, reason: 'hardcoded_secret' },

    // Cryptographic private keys
    { regex: /-----BEGIN\s+(?:(?:EC|RSA|DSA|OPENSSH|PGP)\s+)?PRIVATE KEY-----/, reason: 'private_key' },

    // Credit card numbers (Visa, Mastercard, Amex, Discover, Diners, JCB)
    { regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})\b/, reason: 'credit_card' },

    // .env assignment patterns (MY_SECRET=value)
    { regex: /^[A-Z][A-Z0-9_]{2,}=\S{10,}/m, reason: 'env_assignment' },

    // Hex-encoded secrets (64+ hex chars, common for API secrets)
    { regex: /\b[0-9a-f]{64,}\b/i, reason: 'hex_secret' },

    // SSH connection strings with embedded passwords
    { regex: /sshpass\s+-p\s+\S+/, reason: 'ssh_password' },

    // Database connection strings with credentials
    { regex: /(?:mysql|postgres|mongodb|redis):\/\/[^:]+:[^@]+@/i, reason: 'db_connection_string' },
];

// ─── Shannon Entropy ────────────────────────────────────────────────────────────
function shannonEntropy(str: string): number {
    const len = str.length;
    if (len === 0) return 0;

    const freq = new Map<string, number>();
    for (const ch of str) {
        freq.set(ch, (freq.get(ch) || 0) + 1);
    }

    let entropy = 0;
    for (const count of freq.values()) {
        const p = count / len;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}

// ─── Public API ─────────────────────────────────────────────────────────────────

export interface SafetyResult {
    blocked: boolean;
    reason: string;
}

/**
 * Check if text contains a secret. Returns the first matching reason.
 */
export function isSecret(text: string): SafetyResult {
    // Skip very short content — can't contain meaningful secrets
    if (text.length < 10) {
        return { blocked: true, reason: 'too_short' };
    }

    // Pattern-based detection
    for (const { regex, reason } of SECRET_PATTERNS) {
        if (regex.test(text)) {
            return { blocked: true, reason };
        }
    }

    // High-entropy string detection (>4.5 bits on a 40+ char token-like string)
    // Only check single-line content that looks like a token (no spaces, no newlines)
    const tokens = text.split(/\s+/);
    for (const token of tokens) {
        if (token.length >= 40 && !/\s/.test(token)) {
            const entropy = shannonEntropy(token);
            if (entropy > 4.5) {
                return { blocked: true, reason: 'high_entropy' };
            }
        }
    }

    return { blocked: false, reason: '' };
}

/**
 * Check if the source app is in the blocked list.
 */
export function isBlockedApp(appName: string | null): boolean {
    if (!appName) return false;
    const lower = appName.toLowerCase();
    return BLOCKED_APPS.some(blocked => lower.includes(blocked));
}

/**
 * Get the list of blocked apps (for settings UI).
 */
export function getBlockedApps(): string[] {
    return [...BLOCKED_APPS];
}
