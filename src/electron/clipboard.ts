// src/electron/clipboard.ts
// Clipboard monitor with source app detection, safety filtering, and classification

import { clipboard } from 'electron';
import { execSync } from 'child_process';
import { getDB } from './db.js';
import { isSecret, isBlockedApp } from './safety.js';
import { classify } from './classifier.js';

// ─── Source App Detection (macOS) ───────────────────────────────────────────────

function getActiveApp(): string | null {
    if (process.platform !== 'darwin') return null;
    try {
        const result = execSync(
            'osascript -e \'tell application "System Events" to get name of first application process whose frontmost is true\'',
            { timeout: 500, encoding: 'utf-8' }
        );
        return result.trim() || null;
    } catch {
        return null;
    }
}

// ─── Clipboard Monitor ─────────────────────────────────────────────────────────

export class ClipboardMonitor {
    private intervalId: NodeJS.Timeout | null = null;
    private lastText: string = '';
    private onClipSaved: (id: number) => void;
    private paused: boolean = false;

    constructor(onClipSaved: (id: number) => void, private interval: number = 500) {
        this.onClipSaved = onClipSaved;
    }

    start() {
        if (this.intervalId) return;
        this.lastText = clipboard.readText();
        this.intervalId = setInterval(() => this.checkClipboard(), this.interval);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    pause() { this.paused = true; }
    resume() { this.paused = false; }
    isPaused() { return this.paused; }

    private checkClipboard() {
        if (this.paused) return;

        const text = clipboard.readText();
        if (!text || text === this.lastText) return;

        this.lastText = text;
        this.processClipboardEvent(text);
    }

    private processClipboardEvent(text: string) {
        // ── Step 1: Skip very short content ─────────────────────────────────
        if (text.trim().length < 10) {
            return; // Not worth storing — too short
        }

        // ── Step 2: Get source app ──────────────────────────────────────────
        const sourceApp = getActiveApp();

        // ── Step 3: Block password managers ─────────────────────────────────
        if (isBlockedApp(sourceApp)) {
            this.logFilter('blocked_app');
            return;
        }

        // ── Step 4: Secret detection ────────────────────────────────────────
        const safety = isSecret(text);
        if (safety.blocked) {
            this.logFilter(safety.reason);
            return;
        }

        // ── Step 5: Classify content ────────────────────────────────────────
        const { content_type, language } = classify(text);

        // ── Step 6: Save to DB ──────────────────────────────────────────────
        try {
            const db = getDB();
            const info = db.prepare(
                'INSERT INTO clips (content, content_type, language, source_app) VALUES (?, ?, ?, ?)'
            ).run(text, content_type, language, sourceApp);

            if (info.lastInsertRowid) {
                this.onClipSaved(Number(info.lastInsertRowid));
            }
        } catch (e) {
            console.error('Error saving clip:', e);
        }
    }

    private logFilter(reason: string) {
        try {
            getDB().prepare('INSERT INTO filter_log (reason) VALUES (?)').run(reason);
        } catch {
            // Silently ignore logging errors
        }
    }
}
