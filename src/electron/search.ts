// src/electron/search.ts
// Hybrid search engine: BM25 (FTS5) + Vector (sqlite-vec) with performance logging

import { getDB } from './db.js';
import { generateEmbedding } from './embedder.js';

export interface SearchResult {
    id: number;
    content_type: string;
    language: string | null;
    source_app: string | null;
    preview: string;
    captured_at: number;
    final_score: number;
}

// ─── Hybrid Search ──────────────────────────────────────────────────────────────

export async function hybridSearch(
    query: string,
    contentType?: string
): Promise<SearchResult[]> {
    const startTime = performance.now();

    const db = getDB();
    const safeQuery = query.replace(/['\"*]/g, ' ').trim();
    if (!safeQuery) return [];

    const typeFilter = contentType && contentType !== 'all'
        ? `AND c.content_type = '${contentType.replace(/'/g, "''")}'`
        : '';

    // ── BM25 Results (FTS5) ─────────────────────────────────────────────────
    let ftsResults: any[] = [];
    try {
        const bm25Stmt = db.prepare(`
            SELECT c.id, c.content_type, c.language, c.source_app,
                   substr(c.content, 1, 120) as preview, c.captured_at,
                   rank as bm25_score
            FROM clips_fts
            JOIN clips c ON c.id = clips_fts.rowid
            WHERE clips_fts MATCH ? ${typeFilter}
            LIMIT 100
        `);
        ftsResults = bm25Stmt.all(safeQuery) as any[];
    } catch (e) {
        // FTS MATCH can throw on certain queries — fallback gracefully
        console.warn('FTS5 search error:', e);
    }

    // ── Vector Results (sqlite-vec) ─────────────────────────────────────────
    let vecResults: any[] = [];
    const embedding = await generateEmbedding(query);
    if (embedding && embedding.length > 0) {
        try {
            const vecStmt = db.prepare(`
                SELECT c.id, c.content_type, c.language, c.source_app,
                       substr(c.content, 1, 120) as preview, c.captured_at,
                       v.distance as vec_score
                FROM clips c
                JOIN (
                    SELECT rowid, distance
                    FROM clips_vec
                    WHERE embedding MATCH ? AND k = 100
                ) v ON c.id = v.rowid
                WHERE 1=1 ${typeFilter}
            `);
            vecResults = vecStmt.all(new Float32Array(embedding)) as any[];
        } catch (e) {
            console.warn('Vector search error:', e);
        }
    }

    // ── Merge & Score ───────────────────────────────────────────────────────
    const scoreMap = new Map<number, any>();

    for (const res of ftsResults) {
        scoreMap.set(res.id, { ...res, vec_score: null });
    }
    for (const res of vecResults) {
        if (scoreMap.has(res.id)) {
            scoreMap.get(res.id).vec_score = res.vec_score;
        } else {
            scoreMap.set(res.id, { ...res, bm25_score: null });
        }
    }

    // Normalize and combine: 60% vector, 40% BM25
    // BM25 scores are negative (lower = better), vec distances are positive (lower = better)
    const allMerged = Array.from(scoreMap.values()).map(r => {
        let score = 0;
        // BM25: rank is negative, more negative = better match
        if (r.bm25_score != null) score -= Math.abs(r.bm25_score) * 0.4;
        // Vector: distance, lower = better
        if (r.vec_score != null) score += r.vec_score * 0.6;
        else score += 1.0; // Penalty if no vector score
        return { ...r, final_score: score };
    });

    allMerged.sort((a, b) => a.final_score - b.final_score);
    const results = allMerged.slice(0, 50);

    // ── Performance Logging ─────────────────────────────────────────────────
    const elapsed = performance.now() - startTime;
    if (elapsed > 120) {
        console.warn(`⚠️  Search for "${safeQuery}" took ${elapsed.toFixed(1)}ms (threshold: 120ms)`);
    }

    return results;
}
