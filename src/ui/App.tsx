// src/ui/App.tsx
import React, { useEffect, useState, useRef, useMemo } from 'react';
import './App.css'; 
import Fuse from 'fuse.js';
import type { IpcRendererEvent } from 'electron';
import hljs from 'highlight.js/lib/core'; 

// Importing specific language modules you want to support for highlighting and auto-detection
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
import markdown from 'highlight.js/lib/languages/markdown'; 


import 'highlight.js/styles/atom-one-dark.css'; 

// Register the imported languages with highlight.js core
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml); 
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('php', php);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('markdown', markdown); 


interface Snippet {
  id: number;
  content: string;
  timestamp: number;
  language?: string;
  tags?: string;
  summary?: string;
}

declare global {
  interface Window {
      electronAPI: {
          getAllSnippets: () => Promise<Snippet[]>;
          onSnippetSaved: (callback: (event: IpcRendererEvent, id: number) => void) => () => void;
          deleteSnippet: (id: number) => Promise<{ success: boolean; error?: string }>;
          copyToClipboard: (content: string) => Promise<{ success: boolean; error?: string }>;
          updateSnippet: (id: number, newContent: string) => Promise<{ success: boolean; error?: string }>;
          updateSnippetTags: (id: number, newTags: string) => Promise<{ success: boolean; error?: string }>;
          updateSnippetLanguage: (id: number, newLanguage: string | null) => Promise<{ success: boolean; error?: string }>;
          generateAiResponse: (prompt: string) => Promise<{ success: boolean; response?: string; error?: string }>;
      };
  }
}

function App() {
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [displayedSnippets, setDisplayedSnippets] = useState<Snippet[]>([]);
    const [editingSnippetId, setEditingSnippetId] = useState<number | null>(null);
    const [editingContent, setEditingContent] = useState<string>('');
    const [editingSnippetTags, setEditingSnippetTags] = useState<string>('');

    const [aiPrompt, setAiPrompt] = useState<string>('');
    const [aiResponse, setAiResponse] = useState<string>('');
    const [aiLoading, setAiLoading] = useState<boolean>(false);
    const [aiError, setAiError] = useState<string>('');
    const [selectedSnippetForAi, setSelectedSnippetForAi] = useState<number | null>(null);


    const fetchSnippets = async () => {
        try {
            const fetched = await window.electronAPI.getAllSnippets();
            setSnippets(fetched);
        } catch (error) {
            console.error('Failed to fetch snippets:', error);
        }
    };

    useEffect(() => {
        fetchSnippets();

        const unsubscribe = window.electronAPI.onSnippetSaved((_event, id) => {
            console.log('Received snippet-saved event from main process:', id);
            fetchSnippets();
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const fuseOptions = {
      keys: ['content', 'language', 'tags', 'summary'],
      threshold: 0.5,          
      includeScore: true,
      isCaseSensitive: false,  
    };

    const memoizedFuse = useMemo(() => {
        console.log("Re-creating Fuse instance...");
        return new Fuse(snippets, fuseOptions);
    }, [snippets]);

    useEffect(() => {
        console.log("Search useEffect running...", { searchTerm, snippetsLength: snippets.length });
        if (searchTerm.trim() === '') {
            setDisplayedSnippets(snippets);
        } else {
            const result = memoizedFuse.search(searchTerm);
            setDisplayedSnippets(result.map(item => item.item));
        }
    }, [searchTerm, snippets, memoizedFuse]);

    const HighlightedCode: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
        const codeRef = useRef<HTMLElement>(null);

        useEffect(() => {
            if (codeRef.current) {
                codeRef.current.removeAttribute('data-highlighted');

                let highlightedResult;
                if (language && hljs.getLanguage(language)) {
                    highlightedResult = hljs.highlight(code, { language: language });
                } else {
                    highlightedResult = hljs.highlightAuto(code);
                    if (!highlightedResult.language) {
                        console.warn(`[HighlightedCode] Auto-detection failed for snippet. Falling back to plaintext.`);
                    } else {
                        console.log(`[HighlightedCode] Auto-detected language: ${highlightedResult.language}`);
                    }
                }

                codeRef.current.innerHTML = highlightedResult.value;
                codeRef.current.className = `language-${highlightedResult.language || 'plaintext'}`;
            }
        }, [code, language]);

        return (
            <pre>
                <code ref={codeRef}>
                    {/* Content will be set by useEffect using innerHTML */}
                </code>
            </pre>
        );
    };


    const handleSnippetDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this snippet?')) {
            try {
                const result = await window.electronAPI.deleteSnippet(id);
                if (result.success) {
                    console.log(`Snippet with ID ${id} deleted.`);
                    fetchSnippets();
                    if (editingSnippetId === id) {
                        setEditingSnippetId(null);
                        setEditingContent('');
                        setEditingSnippetTags('');
                    }
                    if (selectedSnippetForAi === id) {
                        setSelectedSnippetForAi(null);
                        setAiResponse('');
                        setAiError('');
                    }
                } else {
                    console.error(`Failed to delete snippet with ID ${id}: ${result.error}`);
                    alert(`Error deleting snippet: ${result.error}`);
                }
            } catch (error) {
                console.error('Error calling deleteSnippet IPC:', error);
                alert('An unexpected error occurred while deleting the snippet.');
            }
        }
    };

    const handleCopySnippet = async (content: string) => {
        try {
            const result = await window.electronAPI.copyToClipboard(content);
            if (result.success) {
                console.log('Snippet content copied to clipboard.');
                alert('Snippet copied to clipboard!');
            } else {
                console.error(`Failed to copy snippet: ${result.error}`);
                alert(`Error copying snippet: ${result.error}`);
            }
        } catch (error) {
            console.error('Error calling copyToClipboard IPC:', error);
            alert('An unexpected error occurred while copying the snippet.');
        }
    };

    const handleEditSnippet = (snippet: Snippet) => {
        setEditingSnippetId(snippet.id!);
        setEditingContent(snippet.content);
        setEditingSnippetTags(snippet.tags || '');
        setSelectedSnippetForAi(null); 
    };

    const handleSaveEdit = async (originalSnippet: Snippet) => {
        const id = originalSnippet.id!;
        let contentChanged = false;
        let tagsChanged = false;

        if (editingContent.trim().length === 0) {
            alert('Snippet content cannot be empty.');
            return;
        }

        if (editingContent !== originalSnippet.content) {
            contentChanged = true;
        }

        const normalizedOriginalTags = (originalSnippet.tags || '').split(',').map(tag => tag.trim()).filter(tag => tag !== '').sort().join(',');
        const normalizedEditingTags = (editingSnippetTags || '').split(',').map(tag => tag.trim()).filter(tag => tag !== '').sort().join(',');

        if (normalizedEditingTags !== normalizedOriginalTags) {
            tagsChanged = true;
        }

        if (!contentChanged && !tagsChanged) {
            alert('No changes detected.');
            setEditingSnippetId(null);
            setEditingContent('');
            setEditingSnippetTags('');
            return;
        }

        try {
            let updatePromises: Promise<{ success: boolean; error?: string }>[] = [];

            if (contentChanged) {
                updatePromises.push(window.electronAPI.updateSnippet(id, editingContent));
            }
            if (tagsChanged) {
                updatePromises.push(window.electronAPI.updateSnippetTags(id, normalizedEditingTags));
            }

            const results = await Promise.all(updatePromises);

            const allSuccess = results.every(result => result.success);

            if (allSuccess) {
                console.log(`Snippet with ID ${id} updated.`);
                fetchSnippets();
                setEditingSnippetId(null);
                setEditingContent('');
                setEditingSnippetTags('');
            } else {
                const failedResults = results.filter(result => !result.success);
                const errors = failedResults.map(result => result.error).join('\n');
                console.error(`Failed to update snippet with ID ${id}: ${errors}`);
                alert(`Error updating snippet: ${errors}`);
            }
        } catch (error) {
            console.error('Error calling update IPCs:', error);
            alert('An unexpected error occurred while updating the snippet.');
        }
    };

    const handleCancelEdit = () => {
        setEditingSnippetId(null);
        setEditingContent('');
        setEditingSnippetTags('');
    };

    const handleGenerateAiResponse = async () => {
        if (!aiPrompt.trim()) {
            setAiError('Please enter a prompt for the AI.');
            return;
        }

        setAiLoading(true);
        setAiResponse('');
        setAiError('');

        try {
            const result = await window.electronAPI.generateAiResponse(aiPrompt);
            if (result.success && result.response) {
                setAiResponse(result.response);
            } else {
                setAiError(result.error || 'Failed to get AI response.');
            }
        } catch (error: any) {
            console.error('Error calling AI IPC:', error);
            setAiError(error.message || 'An unexpected error occurred.');
        } finally {
            setAiLoading(false);
        }
    };

    const handleAskAiAboutSnippet = (snippet: Snippet) => {
        setSelectedSnippetForAi(snippet.id!);
        setAiPrompt(`Tell me more about this ${snippet.language || 'text'} snippet:\n\n\`\`\`${snippet.language || ''}\n${snippet.content}\n\`\`\`\n\nPlease keep the answer concise and to the point.`);
        setAiResponse('');
        setAiError('');
    };

    return (
        <div className="App">
            <h1>IntelliClip Snippets</h1>
            <input
                type="text"
                placeholder="Search snippets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input" 
            />

            <div className="snippet-list"> 
                {displayedSnippets.length > 0 ? (
                    displayedSnippets.map((snippet) => (
                        <div key={snippet.id} className="snippet-item"> 
                            {editingSnippetId === snippet.id ? (
                                <>
                                    <textarea
                                        value={editingContent}
                                        onChange={(e) => setEditingContent(e.target.value)}
                                        className="edit-textarea" 
                                    />
                                    <input
                                        type="text"
                                        placeholder="Add tags (comma-separated, e.g., javascript,react)"
                                        value={editingSnippetTags}
                                        onChange={(e) => setEditingSnippetTags(e.target.value)}
                                        className="edit-input" 
                                    />
                                </>
                            ) : (
                                <HighlightedCode code={snippet.content} language={snippet.language} />
                            )}

                            <small className="snippet-timestamp"> 
                                {new Date(snippet.timestamp).toLocaleString()}
                            </small>
                            {snippet.language && (
                                <small className="snippet-language"> 
                                    Language: {snippet.language}
                                </small>
                            )}
                            {snippet.summary && (
                                <small className="snippet-summary"> 
                                    Summary: {snippet.summary}
                                </small>
                            )}
                            {snippet.tags && snippet.tags.split(',').filter(tag => tag.trim() !== '').length > 0 && (
                                <div className="snippet-tags-container"> 
                                    {snippet.tags.split(',').map((tag, index) => tag.trim() !== '' && (
                                        <span key={index} className="snippet-tag"> 
                                            {tag.trim()}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="snippet-actions"> 
                                {editingSnippetId === snippet.id ? (
                                    <>
                                        <button onClick={() => handleSaveEdit(snippet)} className="action-button button-save" title="Save Changes">
                                            Save
                                        </button>
                                        <button onClick={handleCancelEdit} className="action-button button-cancel" title="Cancel Edit">
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => handleEditSnippet(snippet)} className="action-button button-edit" title="Edit Snippet">
                                            Edit
                                        </button>
                                        <button onClick={() => handleCopySnippet(snippet.content)} className="action-button button-copy" title="Copy to Clipboard">
                                            Copy
                                        </button>
                                        <button onClick={() => snippet.id && handleSnippetDelete(snippet.id)} className="action-button button-delete" title="Delete Snippet">
                                            Delete
                                        </button>
                                        <button onClick={() => handleAskAiAboutSnippet(snippet)} className="action-button button-ask-ai" title="Ask AI about this snippet">
                                            Ask AI
                                        </button>
                                    </>
                                )}
                            </div>

                            {selectedSnippetForAi === snippet.id && (
                                <div className="ai-section"> 
                                    <h3>Ask AI about this Snippet</h3>
                                    <textarea
                                        value={aiPrompt}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                        placeholder="Type your question or request for the AI here..."
                                        rows={4}
                                        className="ai-textarea" 
                                    />
                                    <button
                                        onClick={handleGenerateAiResponse}
                                        disabled={aiLoading}
                                        className="ai-button" 
                                    >
                                        {aiLoading ? 'Generating...' : 'Generate AI Response'}
                                    </button>
                                    <button
                                        onClick={() => setSelectedSnippetForAi(null)}
                                        className="ai-close-button" 
                                        title="Close AI Tab"
                                    >
                                        X
                                    </button>

                                    {aiError && <p className="ai-error">Error: {aiError}</p>} 

                                    {aiResponse && (
                                        <div className="ai-response-container"> 
                                            <h4>AI Response:</h4>
                                            <HighlightedCode code={aiResponse} language="markdown" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <p style={{ color: '#aaa' }}>{searchTerm ? 'No matching snippets found.' : 'No snippets saved yet. Use Shift+Command+C to save code!'}</p>
                )}
            </div>
        </div>
    );
}

export default App;