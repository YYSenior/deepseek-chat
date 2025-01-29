'use client';

import { useChat, Message } from 'ai/react';
import { useState } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';

interface SearchResult {
  title: string;
  url: string;
  text: string;
  author?: string;
  publishedDate?: string;
}

// Add this helper function before the Page component
const parseMessageContent = (content: string) => {
  // If we find a complete think tag
  if (content.includes('</think>')) {
    const [thinking, ...rest] = content.split('</think>');
    return {
      thinking: thinking.replace('<think>', '').trim(),
      finalResponse: rest.join('</think>').trim(),
      isComplete: true
    };
  }
  // If we only find opening think tag, everything after it is thinking
  if (content.includes('<think>')) {
    return {
      thinking: content.replace('<think>', '').trim(),
      finalResponse: '',
      isComplete: false
    };
  }
  // No think tags, everything is final response
  return {
    thinking: '',
    finalResponse: content,
    isComplete: true
  };
};

export default function Page() {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [previousQueries, setPreviousQueries] = useState<string[]>([]);

  const { messages, input, handleInputChange, handleSubmit: handleChatSubmit, setMessages } = useChat({
    api: '/api/chat',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Reset states
    setIsSearching(true);
    setSearchResults([]);
    setSearchError(null);

    try {
      // First, get web search results
      const searchResponse = await fetch('/api/exawebsearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: input,
          previousQueries: previousQueries.slice(-3)
        }),
      });

      if (!searchResponse.ok) {
        throw new Error('Search failed');
      }

      const { results } = await searchResponse.json();
      setSearchResults(results);

      // Format search context
      const searchContext = results.length > 0
        ? `Web Search Results:\n\n${results.map((r: SearchResult, i: number) => 
            `Source [${i + 1}]:\nTitle: ${r.title}\nURL: ${r.url}\n${r.author ? `Author: ${r.author}\n` : ''}${r.publishedDate ? `Date: ${r.publishedDate}\n` : ''}Content: ${r.text}\n---`
          ).join('\n\n')}\n\nInstructions: Based on the above search results, please provide an answer to the user's query. When referencing information, cite the source number in brackets like [1], [2], etc. Use simple english. Use simple words.`
        : '';

      // Send both system context and user message in one request
      if (searchContext) {
        // First, update the messages state with both messages
        const newMessages: Message[] = [
          ...messages,
          {
            id: Date.now().toString(),
            role: 'system',
            content: searchContext
          }
        ];
        setMessages(newMessages);
        
        // Then trigger the API call
        handleChatSubmit(e);
      } else {
        handleChatSubmit(e);
      }

      // Update previous queries after successful search
      setPreviousQueries(prev => [...prev, input].slice(-3));

    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
      console.error('Error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 bg-[var(--secondary-default)]">
      <div className="space-y-6">
        {messages.filter(m => m.role !== 'system').map((message) => (
          <div key={message.id}>
            <div
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`rounded px-4 py-3 max-w-[85%] ${
                  message.role === 'user'
                    ? 'bg-[var(--secondary-darker)] text-black'
                    : 'text-gray-900'
                }`}
              >
                {message.role === 'assistant' ? (
                  <>
                    {(() => {
                      const { thinking, finalResponse, isComplete } = parseMessageContent(message.content);
                      return (
                        <>
                          {(thinking || !isComplete) && (
                            <div className="my-6 space-y-3">
                              <div className="flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                <h3 className="text-sm font-medium">Thinking</h3>
                              </div>
                              <div className="pl-4 relative">
                                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                                <div className="text-sm text-gray-600 whitespace-pre-wrap">{thinking}</div>
                              </div>
                            </div>
                          )}
                          {isComplete && finalResponse && (
                            <div className="prose prose-sm max-w-none">
                              <ReactMarkdown>{finalResponse}</ReactMarkdown>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <div className="whitespace-pre-wrap text-[15px]">{message.content}</div>
                )}
              </div>
            </div>
            
            {/* Show search results after user message */}
            {message.role === 'user' && !isSearching && searchResults.length > 0 && (
              <div className="my-6 space-y-3">
                {/* Header with logo */}
                <div className="flex items-center gap-2">
                  <Image src="/exa_logo.png" alt="Exa" width={40} height={40} />
                  <h3 className="text-sm font-medium">Search Results</h3>
                </div>

                {/* Results with vertical line */}
                <div className="pl-4 relative">
                  {/* Vertical line */}
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  
                  {/* Content */}
                  <div className="space-y-2">
                    {searchResults.map((result, idx) => (
                      <div key={idx} className="text-sm">
                        <a href={result.url} target="_blank" rel="noopener noreferrer" 
                           className="text-gray-600 hover:text-[var(--brand-default)]">
                          [{idx + 1}] {result.title}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {searchError && (
        <div className="p-4 bg-red-50 rounded border border-red-100">
          <p className="text-sm text-red-800">⚠️ {searchError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="sticky bottom-6">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask something..."
            className="flex-1 p-3 bg-white border-0 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-default)] text-[15px]"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isSearching}
            className="px-5 py-3 bg-[var(--brand-default)] text-white rounded hover:bg-[var(--brand-muted)] disabled:opacity-50 font-medium"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>
    </div>
  );
}