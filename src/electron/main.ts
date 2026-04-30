// src/electron/main.ts
import { app, BrowserWindow, globalShortcut, clipboard, ipcMain, screen } from 'electron';
import { Tray, nativeImage, Menu } from 'electron';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { isDev } from './utils.js';
import { initDB, closeDB, getDB } from './db.js';
import { startEmbeddingWorker, stopEmbeddingWorker, getEmbedderStatus } from './embedder.js';
import { callGroq, checkGroqHealth } from './groq.js';
import { hybridSearch } from './search.js';
import { ClipboardMonitor } from './clipboard.js';
import { deleteSnippet, updateSnippet, updateSnippetTags, updateSnippetLanguage } from './core/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.disableHardwareAcceleration();

// ─── State ──────────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let clipboardMonitor: ClipboardMonitor | null = null;
let tray: Tray | null = null;
let isMainWindowReady = false;
let isToggleShortcutActive = false;
const TOGGLE_DEBOUNCE_MS = 250;

// Provider health state
let llmHealthy = false;

const REACT_PROD_BUILD_PATH = path.join(app.getAppPath(), 'dist-react', 'index.html');

// ─── Tray ───────────────────────────────────────────────────────────────────────

function updateTrayCount() {
    if (!tray) return;
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startSec = Math.floor(startOfDay.getTime() / 1000);
        const res = getDB().prepare('SELECT COUNT(*) as count FROM clips WHERE captured_at >= ?').get(startSec) as any;
        const count = res?.count || 0;


        const embedStatus = getEmbedderStatus();
        tray.setTitle(`${count} today`);
        tray.setToolTip(`IntelliClip — ${count} clips today\nEmbedder: ${embedStatus}  ·  Groq: ${llmHealthy ? 'Configured' : 'Unconfigured'}`);
    } catch {}
}

async function refreshHealth() {
    llmHealthy = await checkGroqHealth();
    updateTrayCount();
}

// ─── Previous App Focus Tracking (macOS) ────────────────────────────────────────

let previousApp: string | null = null;

function trackPreviousApp() {
    if (process.platform !== 'darwin') return;
    try {
        previousApp = execSync(
            'osascript -e \'tell application "System Events" to get name of first application process whose frontmost is true\'',
            { timeout: 500, encoding: 'utf-8' }
        ).trim();
    } catch {
        previousApp = null;
    }
}

function restorePreviousApp() {
    if (!previousApp || process.platform !== 'darwin') return;
    try {
        execSync(
            `osascript -e 'tell application "${previousApp}" to activate'`,
            { timeout: 1000 }
        );
    } catch {}
}

// ─── Window ─────────────────────────────────────────────────────────────────────

function createWindow() {
    const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
    const winW = 680;
    const winH = 520;

    mainWindow = new BrowserWindow({
        width: winW,
        height: winH,
        x: Math.round((screenW - winW) / 2),
        y: Math.round(screenH * 0.2),
        show: false,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        type: 'panel',
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    mainWindow.on('blur', () => {
        if (mainWindow) mainWindow.hide();
    });

    if (isDev()) {
        mainWindow.loadURL('http://localhost:5123');
    } else {
        mainWindow.loadFile(REACT_PROD_BUILD_PATH);
    }

    mainWindow.once('ready-to-show', () => {
        if (mainWindow) {
            mainWindow.show();
            isMainWindowReady = true;
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        isMainWindowReady = false;
    });
}

// ─── App Ready ──────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
    initDB();
    
    // Initialize node-llama-cpp embedder and start worker
    startEmbeddingWorker().then(() => {
        updateTrayCount();
    });

    // Initial health check
    await refreshHealth();

    // Periodic health check every 30s
    setInterval(refreshHealth, 30000);

    // ── Tray Setup ──────────────────────────────────────────────────────────
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);
    updateTrayCount();

    const buildTrayMenu = () => Menu.buildFromTemplate([
        { label: 'Show/Hide', click: () => {
            if (mainWindow?.isVisible()) mainWindow.hide();
            else { mainWindow?.show(); mainWindow?.focus(); }
        }},
        { type: 'separator' },
        { type: 'separator' },
        { label: clipboardMonitor?.isPaused() ? '▶ Resume Capture' : '⏸ Pause Capture', click: () => {
            if (clipboardMonitor?.isPaused()) {
                clipboardMonitor.resume();
            } else {
                clipboardMonitor?.pause();
            }
            tray?.setContextMenu(buildTrayMenu());
        }},
        { type: 'separator' },
        { label: 'Quit IntelliClip', click: () => app.quit() },
    ]);

    tray.setContextMenu(buildTrayMenu());

    // Refresh tray menu on health changes
    const originalRefresh = refreshHealth;
    // (health dots update via updateTrayCount tooltip)

    // ── Window ──────────────────────────────────────────────────────────────
    createWindow();

    // ── Clipboard Monitor ───────────────────────────────────────────────────
    const win = BrowserWindow.getAllWindows()[0];
    clipboardMonitor = new ClipboardMonitor((id) => {
        updateTrayCount();
        tray?.setContextMenu(buildTrayMenu()); // Update count in menu
        if (win && !win.isDestroyed()) {
            win.webContents.send('snippet-saved', id);
        }
    });
    clipboardMonitor.start();

    // ── Global Shortcut ─────────────────────────────────────────────────────
    const toggleAppShortcut = 'Shift+Command+V';
    const toggleRegistered = globalShortcut.register(toggleAppShortcut, () => {
        if (isToggleShortcutActive) return;

        isToggleShortcutActive = true;
        setTimeout(() => { isToggleShortcutActive = false; }, TOGGLE_DEBOUNCE_MS);

        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                trackPreviousApp();
                mainWindow.show();
                mainWindow.focus();
                isMainWindowReady = true;
            }
        } else {
            trackPreviousApp();
            createWindow();
        }
    }) as unknown as boolean;

    if (!toggleRegistered) {
        console.error(`Failed to register global shortcut "${toggleAppShortcut}".`);
    } else {
        console.log(`Global shortcut "${toggleAppShortcut}" registered.`);
    }

    // ── IPC Handlers ────────────────────────────────────────────────────────

    ipcMain.handle('get-recent', async (_, limit: number = 30) => {
        return getDB().prepare(`
            SELECT id, content_type, language, source_app,
                   substr(content, 1, 120) as preview, captured_at
            FROM clips ORDER BY captured_at DESC LIMIT ?
        `).all(limit);
    });

    ipcMain.handle('search-clips', async (_, query: string, contentType?: string) => {
        return hybridSearch(query, contentType);
    });

    ipcMain.handle('get-clip-full', async (_, id: number) => {
        return getDB().prepare('SELECT * FROM clips WHERE id = ?').get(id);
    });

    ipcMain.handle('get-filter-stats', async () => {
        return getDB().prepare(`
            SELECT reason, COUNT(*) as count
            FROM filter_log
            WHERE created_at > unixepoch() - 604800
            GROUP BY reason
        `).all();
    });

    ipcMain.handle('get-embedder-status', async () => {
        return { status: getEmbedderStatus() };
    });

    ipcMain.handle('get-groq-status', async () => {
        return { groq: llmHealthy };
    });

    ipcMain.handle('paste-to-last-app', async (_, content: string) => {
        try {
            clipboard.writeText(content);
            if (mainWindow) mainWindow.hide();
            // Small delay to let the window hide before switching
            await new Promise(r => setTimeout(r, 100));
            restorePreviousApp();
            // Simulate Cmd+V
            if (process.platform === 'darwin') {
                setTimeout(() => {
                    try {
                        execSync('osascript -e \'tell application "System Events" to keystroke "v" using command down\'', { timeout: 1000 });
                    } catch {}
                }, 200);
            }
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('delete-snippet', async (_, id: number) => {
        try {
            deleteSnippet(id);
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('copy-to-clipboard', async (_, content: string) => {
        try {
            clipboard.writeText(content);
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('update-snippet', async (_, id: number, newContent: string) => {
        try {
            updateSnippet(id, newContent);
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('update-snippet-tags', async (_, id: number, newTags: string) => {
        try {
            updateSnippetTags(id, newTags);
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('update-snippet-language', async (_, id: number, newLanguage: string | null) => {
        try {
            updateSnippetLanguage(id, newLanguage);
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('generate-ai-response', async (_, prompt: string) => {
        try {
            const response = await callGroq(prompt);
            if (response) {
                return { success: true, response };
            }
            return { success: false, error: 'Groq returned empty response or error.' };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });

    // ── Activate ────────────────────────────────────────────────────────────
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else if (mainWindow && !mainWindow.isVisible()) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
});

// ─── Lifecycle ──────────────────────────────────────────────────────────────────

app.on('window-all-closed', () => {
    // Keep tray alive — don't quit on macOS
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (clipboardMonitor) clipboardMonitor.stop();
    stopEmbeddingWorker();
    closeDB();
    globalShortcut.unregisterAll();
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});