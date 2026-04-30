// src/ui/components/SearchBar.tsx
import { useEffect, useRef, useState } from 'react';

interface SearchBarProps {
    onSearch: (query: string) => void;
    onEscape: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onEscape }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Re-focus when window becomes visible
    useEffect(() => {
        const handleFocus = () => inputRef.current?.focus();
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    // 150ms debounced search
    useEffect(() => {
        const timer = setTimeout(() => onSearch(searchTerm), 150);
        return () => clearTimeout(timer);
    }, [searchTerm, onSearch]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onEscape();
        }
    };

    return (
        <input
            ref={inputRef}
            type="text"
            placeholder="Search your memory..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="search-input"
            id="palette-search"
            autoFocus
        />
    );
};
