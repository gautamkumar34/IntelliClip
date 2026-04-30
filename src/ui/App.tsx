// src/ui/App.tsx — Command Palette (under 100 lines)
import { useEffect, useState, useCallback } from 'react';
import './App.css';
import type { Clip, FilterStat } from './types';
import { SearchBar } from './components/SearchBar';
import { ResultRow } from './components/ResultRow';

const TABS = ['all', 'code', 'text', 'url', 'command'] as const;
type Tab = typeof TABS[number];

function App() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [filterStats, setFilterStats] = useState<FilterStat[]>([]);

  const fetchRecent = useCallback(async (tab: Tab = activeTab) => {
    const recent = await window.electronAPI.getRecent(50);
    setClips(tab === 'all' ? recent : recent.filter(c => c.content_type === tab));
    setSelectedIdx(0);
  }, [activeTab]);

  const doSearch = useCallback(async (query: string, tab: Tab = activeTab) => {
    if (!query.trim()) { fetchRecent(tab); return; }
    const results = await window.electronAPI.searchClips(query, tab === 'all' ? undefined : tab);
    setClips(results);
    setSelectedIdx(0);
  }, [activeTab, fetchRecent]);

  useEffect(() => { fetchRecent(); }, []);
  useEffect(() => {
    const unsub = window.electronAPI.onSnippetSaved(() => { if (!searchTerm) fetchRecent(); });
    return unsub;
  }, [searchTerm, fetchRecent]);
  useEffect(() => { window.electronAPI.getFilterStats().then(setFilterStats).catch(() => {}); }, []);

  const handleSearch = (query: string) => { setSearchTerm(query); doSearch(query); };
  const handleTabChange = (tab: Tab) => { setActiveTab(tab); searchTerm ? doSearch(searchTerm, tab) : fetchRecent(tab); };
  const handlePaste = async (clip: Clip) => {
    const full = await window.electronAPI.getClipFull(clip.id);
    await window.electronAPI.pasteToLastApp(full.content);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, clips.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && clips[selectedIdx]) { e.preventDefault(); handlePaste(clips[selectedIdx]); }
  }, [clips, selectedIdx]);

  useEffect(() => { window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, [handleKeyDown]);

  const totalFiltered = filterStats.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="palette">
      <SearchBar onSearch={handleSearch} onEscape={() => window.close()} />
      <div className="palette__tabs">
        {TABS.map(tab => (
          <button key={tab} className={`tab ${activeTab === tab ? 'tab--active' : ''}`} onClick={() => handleTabChange(tab)}>
            {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <div className="palette__results" role="listbox">
        {clips.length > 0 ? clips.map((clip, i) => (
          <ResultRow key={clip.id} clip={clip} isSelected={i === selectedIdx}
            onSelect={() => setSelectedIdx(i)} onPaste={() => handlePaste(clip)} />
        )) : (
          <p className="palette__empty">{searchTerm ? 'No matches' : 'No clips yet — copy something!'}</p>
        )}
      </div>
      <div className="palette__footer">
        <span>{clips.length} items</span>
        <span className="palette__hints">↑↓ navigate · ↵ paste · esc close</span>
        {totalFiltered > 0 && <span className="palette__filtered">{totalFiltered} filtered this week</span>}
      </div>
    </div>
  );
}

export default App;