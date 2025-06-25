// src/electron/main.ts
import { app, BrowserWindow, globalShortcut, clipboard, ipcMain } from 'electron';
import path from 'path';
import { isDev } from './utils.js';
import hljs from 'highlight.js/lib/core';
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import dotenv from 'dotenv'; 

dotenv.config({ path: path.join(app.getAppPath(), '.env') }); 

app.disableHardwareAcceleration(); 

// Importing specific language modules for the main process
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml'; 
import bash from 'highlight.js/lib/languages/bash';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';

// Register the languages with highlight.js core for the main process
if (!hljs.listLanguages().length) { 
    hljs.registerLanguage('javascript', javascript);
    hljs.registerLanguage('typescript', typescript);
    hljs.registerLanguage('json', json);
    hljs.registerLanguage('css', css);
    hljs.registerLanguage('html', xml); 
    hljs.registerLanguage('java', java);
    hljs.registerLanguage('cpp', cpp);
    hljs.registerLanguage('csharp', csharp);
    hljs.registerLanguage('php', php);
    hljs.registerLanguage('ruby', ruby);
    hljs.registerLanguage('go', go);
    hljs.registerLanguage('rust', rust);

}

const geminiApiKey = process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
    console.error('GEMINI_API_KEY is not set in the .env file!');
}
const genAI = new GoogleGenerativeAI(geminiApiKey || '');
const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE, 
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
];

const geminiModel = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    safetySettings: safetySettings 
});

import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { saveSnippet, getAllSnippets, deleteSnippet ,updateSnippet, updateSnippetTags,updateSnippetLanguage, updateSnippetSummary} from './core/storage.js';

let mainWindow: BrowserWindow | null = null;

const REACT_PROD_BUILD_PATH = path.join(app.getAppPath(), 'dist-react', 'index.html');
console.log('React production build path for loadFile:', REACT_PROD_BUILD_PATH);


function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
    });

    if (isDev()) {
        mainWindow.loadURL('http://localhost:5123');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(REACT_PROD_BUILD_PATH);
    }

    mainWindow.once('ready-to-show', () => {
        if (mainWindow) {
            mainWindow.show();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    globalShortcut.register('Shift+Command+C', async () => { 
        const content = clipboard.readText();
        if (content.trim().length > 0) {
            let detectedLanguage: string | null = null;
            try {
                const result = hljs.highlightAuto(content);
                if (result.language) {
                    detectedLanguage = result.language;
                    console.log(`Detected language: ${detectedLanguage}`);
                } else {
                    console.log('Could not detect specific language for snippet.');
                }
            } catch (e) {
                console.error('Error during language detection:', e);
            }

            let snippetId: number | null = null;
            try {
                snippetId = await saveSnippet(content, detectedLanguage, null); 
                console.log(`Saved snippet with ID: ${snippetId}`);

                // Generate AI Summary in the background
                let generatedSummary: string | null = null;
                if (geminiApiKey) { 
                    try {
                        const summaryPrompt = `Please provide a concise summary of the following content in less than 3-4 lines depending upon the content need. And check if its a code snippet of some standard problems solution from leetcode or cses like problemset or standard data structure(like hashmap , linked list, set...etc) and algorithm(like dp , backtracking , bfs , two pointer ...etc) , if it is important then only mention it , if it hasn't any standard dsa just tell what does it doo. Also add one most relevant tags(#) for easy search of the the snippet . Focus on the main purpose or key points:\n\n${content}`;
                        console.log('Generating AI summary for snippet...');
                        const summaryResult = await geminiModel.generateContent(summaryPrompt);
                        generatedSummary = summaryResult.response.text();
                        console.log('AI Summary Generated:', generatedSummary);

                        if (snippetId) {
                            await updateSnippetSummary(snippetId, generatedSummary); 
                            console.log(`Snippet ID ${snippetId} updated with summary.`);
                        }
                    } catch (aiError: any) {
                        console.error('Error generating AI summary:', aiError);
                        if (snippetId) {
                             await updateSnippetSummary(snippetId, `Error generating summary: ${aiError.message || 'Unknown AI error'}`);
                        }
                    }
                } else {
                    console.warn('GEMINI_API_KEY not set. Skipping AI summarization.');
                }

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('snippet-saved', snippetId);
                }
            } catch (err: any) {
                console.error('Failed to save snippet or update with summary:', err);
            }
        } else {
            console.log('Clipboard content is empty or only whitespace, not saving.');
        }
    });
    console.log('Global shortcut "Shift+Command+C" registered.');


    ipcMain.handle('get-all-snippets', async () => {
        try {
            const snippets = await getAllSnippets();
            return snippets;
        } catch (error) {
            console.error('Failed to get snippets from DB:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('delete-snippet', async (_event, id: number) => {
        try {
            await deleteSnippet(id);
            return { success: true };
        } catch (error) {
            console.error('Failed to delete snippet from DB:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('copy-to-clipboard', async (_event, content: string) => {
        try {
            clipboard.writeText(content);
            console.log('Content copied to clipboard.');
            return { success: true };
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('update-snippet', async (_event, id: number, newContent: string) => {
        try {
            await updateSnippet(id, newContent);
            return { success: true };
        } catch (error) {
            console.error('Failed to update snippet in DB:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('update-snippet-tags', async (_event, id: number, newTags: string) => {
        try {
            await updateSnippetTags(id, newTags);
            return { success: true };
        } catch (error) {
            console.error('Failed to update snippet tags in DB:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });
    ipcMain.handle('update-snippet-language', async (_event, id: number, newLanguage: string | null) => {
        try {
            await updateSnippetLanguage(id, newLanguage);
            return { success: true };
        } catch (error) {
            console.error('Failed to update snippet language in DB:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('generate-ai-response', async (_event, prompt: string) => {
        if (!geminiApiKey) {
            return { success: false, error: 'AI API key not configured.' };
        }
    
        try {
            console.log('Generating AI response for prompt:', prompt);
            const result = await geminiModel.generateContent(prompt); 
            const response = result.response;
            const text = response.text();
            console.log('AI Response:', text);
            return { success: true, response: text };
        } catch (error: any) {
            console.error('Error generating AI response:', error);
            if (error.response && error.response.promptFeedback) {
                console.error('Prompt Feedback:', error.response.promptFeedback);
                return { success: false, error: `AI prompt feedback: ${JSON.stringify(error.response.promptFeedback)}` };
            }
            return { success: false, error: error.message || 'Unknown AI generation error' };
        }
    });


    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    globalShortcut.unregisterAll();
    console.log('All windows closed. Global shortcuts unregistered.');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    console.log('App is quitting. All global shortcuts unregistered.');
});