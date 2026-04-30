// src/electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // Data
    getRecent: (limit?: number) => ipcRenderer.invoke('get-recent', limit),
    searchClips: (query: string, contentType?: string) => ipcRenderer.invoke('search-clips', query, contentType),
    getClipFull: (id: number) => ipcRenderer.invoke('get-clip-full', id),
    getFilterStats: () => ipcRenderer.invoke('get-filter-stats'),

    // Status
    getEmbedderStatus: () => ipcRenderer.invoke('get-embedder-status'),
    getGroqStatus: () => ipcRenderer.invoke('get-groq-status'),

    // Actions
    deleteSnippet: (id: number) => ipcRenderer.invoke('delete-snippet', id),
    copyToClipboard: (content: string) => ipcRenderer.invoke('copy-to-clipboard', content),
    pasteToLastApp: (content: string) => ipcRenderer.invoke('paste-to-last-app', content),
    updateSnippet: (id: number, newContent: string) => ipcRenderer.invoke('update-snippet', id, newContent),
    updateSnippetTags: (id: number, newTags: string) => ipcRenderer.invoke('update-snippet-tags', id, newTags),
    updateSnippetLanguage: (id: number, newLanguage: string | null) => ipcRenderer.invoke('update-snippet-language', id, newLanguage),
    generateAiResponse: (prompt: string) => ipcRenderer.invoke('generate-ai-response', prompt),

    // Events
    onSnippetSaved: (callback: (event: Electron.IpcRendererEvent, id: number) => void) => {
        ipcRenderer.on('snippet-saved', callback);
        return () => { ipcRenderer.removeListener('snippet-saved', callback); };
    },
});