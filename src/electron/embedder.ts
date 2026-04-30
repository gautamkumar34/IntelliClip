// src/electron/embedder.ts
import { app } from 'electron';
import path from 'path';
import { getLlama } from 'node-llama-cpp';
import { getDB } from './db.js';

let llama: any = null;
let embeddingModel: any = null;
let embeddingContext: any = null;
let status: 'loading' | 'ready' | 'error' = 'loading';

let workerInterval: NodeJS.Timeout | null = null;
const NORMAL_INTERVAL_MS = 2000;
const BATCH_SIZE = 5;
const MAX_CHARS = 2000;

// ─── Initialization ─────────────────────────────────────────────────────────────

async function initEmbedder() {
    if (status === 'ready') return;
    status = 'loading';
    try {
        const modelPath = app.isPackaged
            ? path.join(process.resourcesPath, 'models', 'nomic-embed-text-v1.5.Q4_K_M.gguf')
            : path.join(app.getAppPath(), 'resources', 'models', 'nomic-embed-text-v1.5.Q4_K_M.gguf');

        console.log(`Loading embedding model from: ${modelPath}`);
        
        llama = await getLlama();
        embeddingModel = await llama.loadModel({
            modelPath: modelPath
        });
        embeddingContext = await embeddingModel.createEmbeddingContext();
        
        status = 'ready';
        console.log('Embedding model loaded successfully.');
    } catch (e) {
        console.error('Failed to load embedding model:', e);
        status = 'error';
    }
}

// ─── Embedding Generation ───────────────────────────────────────────────────────

export async function generateEmbedding(text: string): Promise<Float32Array | number[] | null> {
    if (status !== 'ready') {
        await initEmbedder();
    }
    if (status !== 'ready' || !embeddingContext) return null;

    try {
        const truncated = text.slice(0, MAX_CHARS);
        const embedding = await embeddingContext.getEmbeddingFor(truncated);
        return embedding.vector; // node-llama-cpp returns an object with vector property
    } catch (e) {
        console.error('Embedding generation failed:', e);
        return null;
    }
}

// ─── Health & Status ────────────────────────────────────────────────────────────

export async function checkEmbedHealth(): Promise<boolean> {
    if (status === 'loading') await initEmbedder();
    return status === 'ready';
}

export function getEmbedderStatus(): 'loading' | 'ready' | 'error' {
    return status;
}

// ─── Worker Loop ────────────────────────────────────────────────────────────────

async function processQueue() {
    if (status !== 'ready') return;

    const db = getDB();
    const toEmbed = db.prepare(
        'SELECT id, content FROM clips WHERE is_embedded = 0 LIMIT ?'
    ).all(BATCH_SIZE) as any[];

    if (toEmbed.length === 0) return;

    const insertVec = db.prepare('INSERT INTO clips_vec(rowid, embedding) VALUES (?, ?)');
    const markEmbedded = db.prepare('UPDATE clips SET is_embedded = 1 WHERE id = ?');

    for (const clip of toEmbed) {
        const vec = await generateEmbedding(clip.content);
        if (vec) {
            const clipId = BigInt(clip.id);
            const tx = db.transaction(() => {
                insertVec.run(clipId, new Float32Array(vec));
                markEmbedded.run(clipId);
            });
            try {
                tx();
                console.log(`Embedded clip ID: ${clip.id}`);
            } catch (e) {
                console.error(`Failed to save embedding for clip ${clip.id}:`, e);
            }
        }
    }
}

// ─── Public API ─────────────────────────────────────────────────────────────────

export async function startEmbeddingWorker() {
    if (workerInterval) return;
    await initEmbedder();
    workerInterval = setInterval(processQueue, NORMAL_INTERVAL_MS);
}

export function stopEmbeddingWorker() {
    if (workerInterval) {
        clearInterval(workerInterval);
        workerInterval = null;
    }
}
