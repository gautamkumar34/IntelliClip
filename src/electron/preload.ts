// src/electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    getAllSnippets: () => ipcRenderer.invoke('get-all-snippets'),
    onSnippetSaved: (callback: (event: Electron.IpcRendererEvent, id: number) => void) => {
        ipcRenderer.on('snippet-saved', callback);
        return () => {
            ipcRenderer.removeListener('snippet-saved', callback);
        };
    },
    deleteSnippet: (id: number) => ipcRenderer.invoke('delete-snippet', id),
    copyToClipboard: (content: string) => ipcRenderer.invoke('copy-to-clipboard', content),
    updateSnippet: (id: number, newContent: string) => ipcRenderer.invoke('update-snippet', id, newContent),
    updateSnippetTags: (id: number, newTags: string) => ipcRenderer.invoke('update-snippet-tags', id, newTags),
    updateSnippetLanguage: (id: number, newLanguage: string | null) => ipcRenderer.invoke('update-snippet-language', id, newLanguage),
    generateAiResponse: (prompt: string) => ipcRenderer.invoke('generate-ai-response', prompt),
});

console.log('Preload script loaded from src/electron/preload.ts');