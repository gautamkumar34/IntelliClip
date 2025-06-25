// src/electron/core/storage.ts
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface Snippet {
    id?: number;
    content: string;
    timestamp: number;
    language?: string;
    tags?: string;
    summary?: string; 
}

const dbPath = path.join(app.getPath('userData'), 'intelliclipboard.db');
console.log('Database path:', dbPath);

const db = new Database(dbPath);

function initDb() {
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS snippets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                language TEXT,
                tags TEXT,
                summary TEXT -- MODIFIED: Added summary column
            )
        `);
        console.log('Snippets table ensured to exist.');


        const columnCheck = db.prepare("PRAGMA table_info(snippets);").all() as { name: string; }[];
        const hasTagsColumn = columnCheck.some(column => column.name === 'tags');
        const hasLanguageColumn = columnCheck.some(column => column.name === 'language');
        const hasSummaryColumn = columnCheck.some(column => column.name === 'summary'); 

        if (!hasTagsColumn) {
            db.exec('ALTER TABLE snippets ADD COLUMN tags TEXT;');
            console.log('Added "tags" column to "snippets" table.');
        }
        if (!hasLanguageColumn) {
            db.exec('ALTER TABLE snippets ADD COLUMN language TEXT;');
            console.log('Added "language" column to "snippets" table.');
        }
        if (!hasSummaryColumn) { 
            db.exec('ALTER TABLE snippets ADD COLUMN summary TEXT;');
            console.log('Added "summary" column to "snippets" table.');
        }

    } catch (error) {
        console.error('Error initializing database or performing migration:', error);
    }
}

initDb();

export async function saveSnippet(content: string, language: string | null = null, summary: string | null = null): Promise<number> {
    const stmt = db.prepare('INSERT INTO snippets (content, timestamp, language, summary) VALUES (?, ?, ?, ?)'); // MODIFIED: Included summary
    const info = stmt.run(content, Date.now(), language, summary); 
    console.log(`Saved snippet with ID: ${info.lastInsertRowid}, Language: ${language || 'N/A'}, Summary: ${summary ? 'Present' : 'N/A'}`); // More descriptive log
    return info.lastInsertRowid as number;
}

export async function getAllSnippets(): Promise<Snippet[]> {
    const stmt = db.prepare('SELECT id, content, timestamp, language, tags, summary FROM snippets ORDER BY timestamp DESC');
    const snippets = stmt.all() as Snippet[];
    console.log('Retrieved snippets:', snippets.length);
    return snippets;
}

export async function deleteSnippet(id: number): Promise<void> {
    const stmt = db.prepare('DELETE FROM snippets WHERE id = ?');
    const info = stmt.run(id);
    if (info.changes && info.changes > 0) {
        console.log(`Deleted snippet with ID: ${id}`);
    } else {
        console.warn(`No snippet found with ID: ${id} to delete.`);
    }
}

export async function updateSnippet(id: number, newContent: string): Promise<void> {
    const stmt = db.prepare('UPDATE snippets SET content = ?, timestamp = ? WHERE id = ?');
    const info = stmt.run(newContent, Date.now(), id);
    if (info.changes && info.changes > 0) {
        console.log(`Updated snippet with ID: ${id}`);
    } else {
        console.warn(`No snippet found with ID: ${id} to update.`);
    }
}

export async function updateSnippetTags(id: number, newTags: string): Promise<void> {
    const stmt = db.prepare('UPDATE snippets SET tags = ?, timestamp = ? WHERE id = ?');
    const info = stmt.run(newTags, Date.now(), id);
    if (info.changes && info.changes > 0) {
        console.log(`Updated tags for snippet with ID: ${id} to: "${newTags}"`);
    } else {
        console.warn(`No snippet found with ID: ${id} to update tags.`);
    }
}

export async function updateSnippetLanguage(id: number, newLanguage: string | null): Promise<void> {
    const stmt = db.prepare('UPDATE snippets SET language = ?, timestamp = ? WHERE id = ?');
    const info = stmt.run(newLanguage, Date.now(), id);
    if (info.changes && info.changes > 0) {
        console.log(`Updated language for snippet with ID: ${id} to: "${newLanguage || 'N/A'}"`);
    } else {
        console.warn(`No snippet found with ID: ${id} to update language.`);
    }
}

export async function updateSnippetSummary(id: number, newSummary: string | null): Promise<void> {
    const stmt = db.prepare('UPDATE snippets SET summary = ?, timestamp = ? WHERE id = ?'); 
    const info = stmt.run(newSummary, Date.now(), id);
    if (info.changes && info.changes > 0) {
        console.log(`Snippet with ID ${id} summary updated in DB.`);
    } else {
        console.warn(`No snippet found with ID: ${id} to update summary.`);
    }
}

app.on('before-quit', () => {
    if (db.open) {
        db.close();
        console.log('Database closed.');
    }
});