import Database from 'better-sqlite3'
// @ts-ignore
import * as sqliteVec from 'sqlite-vec'
import path from 'path'
import { app } from 'electron'

let db: Database.Database | null = null

export function initDB(): Database.Database {
  const dbPath = path.join(app.getPath('userData'), 'intelliclip.db')
  db = new Database(dbPath)
  
  sqliteVec.load(db)

  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  db.pragma('cache_size = -32000')
  
  // Migration for old 'snippets' table and 'timestamp' before creating clips
  try {
    const hasSnippets = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='snippets'").get()
    if (hasSnippets) {
      db.exec('ALTER TABLE snippets RENAME TO clips')
    }
  } catch(e) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS clips (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      content       TEXT NOT NULL,
      content_type  TEXT NOT NULL DEFAULT 'text',
      language      TEXT,
      source_app    TEXT,
      source_file   TEXT,
      captured_at   INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      session_id    INTEGER,
      is_embedded   INTEGER NOT NULL DEFAULT 0,
      summary       TEXT,
      FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      pinned      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS snippet_tags (
      snippet_id  INTEGER NOT NULL,
      tag         TEXT NOT NULL,
      PRIMARY KEY (snippet_id, tag),
      FOREIGN KEY (snippet_id) REFERENCES clips(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS filter_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      reason      TEXT NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS clips_fts 
    USING fts5(content, content='clips', content_rowid='id');

    CREATE VIRTUAL TABLE IF NOT EXISTS clips_vec
    USING vec0(embedding FLOAT[768]);

    CREATE INDEX IF NOT EXISTS idx_clips_captured_at 
    ON clips(captured_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_clips_content_type 
    ON clips(content_type);
    
    CREATE INDEX IF NOT EXISTS idx_clips_session_id 
    ON clips(session_id);
    
    CREATE INDEX IF NOT EXISTS idx_clips_is_embedded 
    ON clips(is_embedded) WHERE is_embedded = 0;

    CREATE TRIGGER IF NOT EXISTS clips_ai 
    AFTER INSERT ON clips BEGIN
      INSERT INTO clips_fts(rowid, content) VALUES (new.id, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS clips_ad 
    AFTER DELETE ON clips BEGIN
      INSERT INTO clips_fts(clips_fts, rowid, content) 
      VALUES ('delete', old.id, old.content);
    END;

    CREATE TRIGGER IF NOT EXISTS clips_au 
    AFTER UPDATE OF content ON clips BEGIN
      INSERT INTO clips_fts(clips_fts, rowid, content) 
      VALUES ('delete', old.id, old.content);
      INSERT INTO clips_fts(rowid, content) VALUES (new.id, new.content);
    END;
  `)

  runMigrations(db)
  return db
}

export function getDB(): Database.Database {
  if (!db) throw new Error('DB not initialized — call initDB() first')
  return db
}

export function closeDB(): void {
  if (db) {
    db.pragma('wal_checkpoint(TRUNCATE)')
    db.close()
    db = null
  }
}

function runMigrations(db: Database.Database): void {
  const addColumnIfMissing = (table: string, column: string, def: string) => {
    const cols = db.pragma(`table_info(${table})`) as Array<{name: string}>
    if (!cols.find(c => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`)
    }
  }
  
  // Custom migration requested by T2
  const clipsCols = db.pragma('table_info(clips)') as Array<{name: string}>
  
  if (clipsCols.find(c => c.name === 'timestamp')) {
    db.exec('ALTER TABLE clips RENAME COLUMN timestamp TO updated_at')
  }

  if (clipsCols.find(c => c.name === 'tags')) {
    const rows = db.prepare('SELECT id, tags FROM clips WHERE tags IS NOT NULL AND tags != ""').all() as any[]
    const insertTag = db.prepare('INSERT OR IGNORE INTO snippet_tags (snippet_id, tag) VALUES (?, ?)')
    
    const tx = db.transaction(() => {
      for (const row of rows) {
        const tags = String(row.tags).split(',').map(t => t.trim()).filter(Boolean)
        for (const tag of tags) {
          insertTag.run(row.id, tag)
        }
      }
    })
    tx()
    
    // We optionally could drop the 'tags' column, but let's avoid schema errors if unsupported.
    // SQLite supports DROP COLUMN since 3.35, better-sqlite3 usually uses a recent version.
    try {
      db.exec('ALTER TABLE clips DROP COLUMN tags')
    } catch (e) {}
  }

  addColumnIfMissing('clips', 'content_type', "TEXT NOT NULL DEFAULT 'text'")
  addColumnIfMissing('clips', 'source_app', 'TEXT')
  addColumnIfMissing('clips', 'captured_at', 'INTEGER NOT NULL DEFAULT (unixepoch())')
  addColumnIfMissing('clips', 'is_embedded', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing('sessions', 'pinned', 'INTEGER NOT NULL DEFAULT 0')
}
