// src/electron/classifier.ts
// Pure-regex content classification engine — no LLM, no highlight.js

export interface Classification {
    content_type: 'code' | 'command' | 'url' | 'text';
    language: string | null;
}

// ─── URL Detection ──────────────────────────────────────────────────────────────
const URL_REGEX = /^https?:\/\/\S+$|^(www\.)\S+\.\S+$/im;
const MULTILINE_URL = /https?:\/\/[^\s]+/;

// ─── Shell Command Heuristics ───────────────────────────────────────────────────
const COMMAND_PATTERNS = [
    /^\s*\$\s+\S+/m,                                        // Prompt prefix: $ command
    /^\s*(sudo|apt|brew|npm|npx|yarn|pnpm|pip|gem|cargo|go)\s+/m,  // Package managers
    /^\s*(git|docker|kubectl|terraform|ansible|ssh|scp|rsync)\s+/m, // DevOps tools
    /^\s*(curl|wget|grep|awk|sed|cat|ls|cd|mkdir|rm|mv|cp|chmod|chown)\s+/m, // Unix core
    /^\s*(python|node|ruby|java|gcc|make|cmake)\s+/m,       // Language runners
    /\|\s*(grep|awk|sed|sort|uniq|wc|head|tail|xargs)\b/,    // Piped commands
    /&&\s*\S+/,                                              // Chained commands
    /^\s*export\s+[A-Z_]+=\S+/m,                             // Env exports
];

// ─── Code Detection ─────────────────────────────────────────────────────────────
// These detect structural code patterns, NOT natural language with stray punctuation

const CODE_STRUCTURAL = [
    /^\s*(function|const|let|var|class|interface|type|enum|export|import)\s+/m,
    /^\s*(def|class|if|elif|else|for|while|try|except|with|return)\s+.*:/m,
    /^\s*(public|private|protected|static|void|int|string|bool)\s+/m,
    /^\s*#include\s*<[^>]+>/m,
    /^\s*@\w+/m,                       // Decorators (@app.route, @Component)
    /=>\s*{/,                          // Arrow functions
    /\)\s*{/,                          // Function bodies
    /^\s*\/\/\s*\S+/m,                 // Single-line comments
    /^\s*#!\s*\/\S+/m,                 // Shebangs
    /;\s*$/m,                          // Semicolons at line end
    /\{\s*\n/,                         // Opening braces
];

// ─── Language Detection (ordered by specificity) ────────────────────────────────

interface LangRule {
    language: string;
    patterns: RegExp[];
    minMatches: number;
}

const LANG_RULES: LangRule[] = [
    {
        language: 'typescript',
        patterns: [
            /\b(interface|type|enum|namespace)\s+\w+/,
            /:\s*(string|number|boolean|void|any|unknown|never)\b/,
            /\bReadonly<|Partial<|Record<|Promise</,
            /as\s+(string|number|any)\b/,
            /<[A-Z]\w*>/,            // Generics
        ],
        minMatches: 1,
    },
    {
        language: 'javascript',
        patterns: [
            /\b(const|let|var)\s+\w+\s*=/,
            /\bfunction\s+\w+\s*\(/,
            /=>\s*[{(]/,
            /\brequire\s*\(/,
            /\bmodule\.exports\b/,
            /\bconsole\.(log|error|warn)\(/,
            /\bdocument\.\w+/,
            /\bwindow\.\w+/,
        ],
        minMatches: 2,
    },
    {
        language: 'python',
        patterns: [
            /\bdef\s+\w+\s*\(.*\)\s*(->\s*\w+\s*)?:/,
            /\bclass\s+\w+.*:/,
            /\bimport\s+\w+/,
            /\bfrom\s+\w+\s+import\b/,
            /\bself\.\w+/,
            /\bprint\s*\(/,
            /\bif\s+.*:\s*$/m,
            /\belif\s+.*:/,
            /\b__\w+__\b/,                    // Dunder methods
        ],
        minMatches: 2,
    },
    {
        language: 'html',
        patterns: [
            /<(!DOCTYPE|html|head|body|div|span|p|a|img|form|input|button|table)\b/i,
            /<\/\w+>/,
            /class="[^"]*"/,
            /id="[^"]*"/,
        ],
        minMatches: 2,
    },
    {
        language: 'css',
        patterns: [
            /^\s*\.[a-zA-Z][\w-]*\s*{/m,
            /^\s*#[a-zA-Z][\w-]*\s*{/m,
            /\b(margin|padding|display|flex|grid|color|background|font-size|border)\s*:/,
            /@media\s*\(/,
            /@keyframes\s+\w+/,
        ],
        minMatches: 2,
    },
    {
        language: 'sql',
        patterns: [
            /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s+/i,
            /\bFROM\s+\w+/i,
            /\bWHERE\s+/i,
            /\bJOIN\s+\w+/i,
            /\bGROUP\s+BY\b/i,
            /\bORDER\s+BY\b/i,
        ],
        minMatches: 2,
    },
    {
        language: 'go',
        patterns: [
            /\bfunc\s+(\(\w+\s+\*?\w+\)\s+)?\w+\s*\(/,
            /\bpackage\s+\w+/,
            /\bfmt\.\w+/,
            /:=\s*/,
            /\bgo\s+func\b/,
        ],
        minMatches: 2,
    },
    {
        language: 'rust',
        patterns: [
            /\bfn\s+\w+\s*[(<]/,
            /\blet\s+mut\s+/,
            /\bimpl\s+\w+/,
            /\buse\s+\w+::/,
            /\bpub\s+(fn|struct|enum|mod)\b/,
            /->.*\{/,
        ],
        minMatches: 2,
    },
    {
        language: 'java',
        patterns: [
            /\bpublic\s+(static\s+)?class\s+\w+/,
            /\bpublic\s+static\s+void\s+main\b/,
            /\bSystem\.out\.print/,
            /\bnew\s+\w+\s*\(/,
            /\b(ArrayList|HashMap|LinkedList|StringBuilder)<\w+>/,
        ],
        minMatches: 2,
    },
    {
        language: 'c',
        patterns: [
            /#include\s*<[^>]+>/,
            /\bint\s+main\s*\(/,
            /\bprintf\s*\(/,
            /\bmalloc\s*\(/,
            /\bstruct\s+\w+\s*{/,
            /\b(void|char|int|float|double)\s*\*/,
        ],
        minMatches: 2,
    },
    {
        language: 'ruby',
        patterns: [
            /\bdef\s+\w+/,
            /\bend\s*$/m,
            /\bputs\s+/,
            /\brequire\s+['"]/,
            /\battr_(reader|writer|accessor)\s+:/,
            /\bdo\s*\|/,
        ],
        minMatches: 2,
    },
    {
        language: 'shell',
        patterns: [
            /^#!/m,
            /\becho\s+/,
            /\b(if|then|fi|for|do|done|while|case|esac)\b/,
            /\$\{?\w+\}?/,
            /\bset\s+-[euxo]/,
        ],
        minMatches: 2,
    },
    {
        language: 'json',
        patterns: [
            /^\s*\{[\s\S]*"[^"]+"\s*:/m,
            /^\s*\[[\s\S]*\{/m,
        ],
        minMatches: 1,
    },
    {
        language: 'yaml',
        patterns: [
            /^\w[\w-]*:\s+\S/m,
            /^\s+-\s+\w/m,
            /^---\s*$/m,
        ],
        minMatches: 2,
    },
    {
        language: 'markdown',
        patterns: [
            /^#{1,6}\s+\S/m,
            /^\s*[-*+]\s+\S/m,
            /\[.*?\]\(.*?\)/,
            /```\w*/,
        ],
        minMatches: 2,
    },
];

// ─── Public API ─────────────────────────────────────────────────────────────────

export function classify(text: string): Classification {
    const trimmed = text.trim();

    // 1. URL check — single URL on its own line or the whole content is a URL
    if (URL_REGEX.test(trimmed)) {
        return { content_type: 'url', language: null };
    }

    // 2. Shell command check
    if (COMMAND_PATTERNS.some(p => p.test(trimmed))) {
        // Make sure it's not actually a code file that happens to contain shell-like syntax
        const lines = trimmed.split('\n');
        if (lines.length <= 5 || !CODE_STRUCTURAL.some(p => p.test(trimmed))) {
            return { content_type: 'command', language: 'shell' };
        }
    }

    // 3. Code detection
    const codeHits = CODE_STRUCTURAL.filter(p => p.test(trimmed)).length;
    if (codeHits >= 2) {
        const language = detectLanguage(trimmed);
        return { content_type: 'code', language };
    }

    // 4. Check if it might be code based on language detection alone
    const language = detectLanguage(trimmed);
    if (language && language !== 'markdown') {
        return { content_type: 'code', language };
    }

    return { content_type: 'text', language: null };
}

function detectLanguage(text: string): string | null {
    for (const rule of LANG_RULES) {
        const matches = rule.patterns.filter(p => p.test(text)).length;
        if (matches >= rule.minMatches) {
            return rule.language;
        }
    }
    return null;
}
