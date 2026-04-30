export interface Clip {
  id: number;
  content_type: string;
  language?: string;
  source_app?: string;
  preview: string;
  captured_at: number;
  bm25_score?: number;
  final_score?: number;
}

export interface ClipFull extends Clip {
  content: string;
  summary?: string;
  tags?: string;
}

export interface EmbedderStatus {
  status: 'loading' | 'ready' | 'error';
}

export interface GroqStatus {
  groq: boolean;
}

export interface FilterStat {
  reason: string;
  count: number;
}

declare global {
  interface Window {
      electronAPI: {
          getRecent: (limit?: number) => Promise<Clip[]>;
          searchClips: (query: string, contentType?: string) => Promise<Clip[]>;
          getClipFull: (id: number) => Promise<ClipFull>;
          getFilterStats: () => Promise<FilterStat[]>;
          getEmbedderStatus: () => Promise<EmbedderStatus>;
          getGroqStatus: () => Promise<GroqStatus>;
          onSnippetSaved: (callback: (event: any, id: number) => void) => () => void;
          deleteSnippet: (id: number) => Promise<{ success: boolean; error?: string }>;
          copyToClipboard: (content: string) => Promise<{ success: boolean; error?: string }>;
          pasteToLastApp: (content: string) => Promise<{ success: boolean; error?: string }>;
          updateSnippet: (id: number, newContent: string) => Promise<{ success: boolean; error?: string }>;
          updateSnippetTags: (id: number, newTags: string) => Promise<{ success: boolean; error?: string }>;
          updateSnippetLanguage: (id: number, newLanguage: string | null) => Promise<{ success: boolean; error?: string }>;
          generateAiResponse: (prompt: string) => Promise<{ success: boolean; response?: string; error?: string }>;
      };
  }
}
