import { getDB } from '../db.js';

export interface Snippet {
    id?: number;
    content: string;
    captured_at: number;
    updated_at: number;
    language?: string | null;
    tags?: string;
    summary?: string | null; 
}

export function saveSnippet(content: string, language: string | null = null, summary: string | null = null): number {
    const stmt = getDB().prepare('INSERT INTO clips (content, captured_at, updated_at, language, summary) VALUES (?, unixepoch(), unixepoch(), ?, ?)');
    const info = stmt.run(content, language, summary); 
    console.log(`Saved snippet with ID: ${info.lastInsertRowid}, Language: ${language || 'N/A'}, Summary: ${summary ? 'Present' : 'N/A'}`);
    return Number(info.lastInsertRowid);
}

export function getAllSnippets(): Snippet[] {
    // Need to fetch tags from snippet_tags table
    const stmt = getDB().prepare(`
        SELECT c.id, c.content, c.captured_at, c.updated_at, c.language, c.summary,
               (SELECT GROUP_CONCAT(tag, ',') FROM snippet_tags WHERE snippet_id = c.id) as tags
        FROM clips c 
        ORDER BY c.captured_at DESC
    `);
    const snippets = stmt.all() as Snippet[];
    console.log('Retrieved snippets:', snippets.length);
    return snippets;
}

export function deleteSnippet(id: number): void {
    const stmt = getDB().prepare('DELETE FROM clips WHERE id = ?');
    const info = stmt.run(id);
    if (info.changes && info.changes > 0) {
        console.log(`Deleted snippet with ID: ${id}`);
    } else {
        console.warn(`No snippet found with ID: ${id} to delete.`);
    }
}

export function updateSnippet(id: number, newContent: string): void {
    const stmt = getDB().prepare('UPDATE clips SET content = ?, updated_at = unixepoch() WHERE id = ?');
    const info = stmt.run(newContent, id);
    if (info.changes && info.changes > 0) {
        console.log(`Updated snippet with ID: ${id}`);
    } else {
        console.warn(`No snippet found with ID: ${id} to update.`);
    }
}

export function updateSnippetTags(id: number, newTags: string): void {
    const db = getDB();
    const transaction = db.transaction(() => {
        db.prepare('DELETE FROM snippet_tags WHERE snippet_id = ?').run(id);
        const insertStmt = db.prepare('INSERT OR IGNORE INTO snippet_tags (snippet_id, tag) VALUES (?, ?)');
        const tagsList = newTags.split(',').map(t => t.trim()).filter(Boolean);
        for (const tag of tagsList) {
            insertStmt.run(id, tag);
        }
        db.prepare('UPDATE clips SET updated_at = unixepoch() WHERE id = ?').run(id);
    });
    transaction();
    console.log(`Updated tags for snippet with ID: ${id} to: "${newTags}"`);
}

export function updateSnippetLanguage(id: number, newLanguage: string | null): void {
    const stmt = getDB().prepare('UPDATE clips SET language = ?, updated_at = unixepoch() WHERE id = ?');
    const info = stmt.run(newLanguage, id);
    if (info.changes && info.changes > 0) {
        console.log(`Updated language for snippet with ID: ${id} to: "${newLanguage || 'N/A'}"`);
    } else {
        console.warn(`No snippet found with ID: ${id} to update language.`);
    }
}
