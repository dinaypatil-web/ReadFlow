
import React, { useEffect, useRef } from 'react';
import { EBook, ReaderState } from '../types';
import { ArrowLeft, Bookmark, Share2, MoreVertical } from 'lucide-react';
import Controls from './Controls';

interface ReaderProps {
  state: ReaderState;
  onBack: () => void;
  onUpdateState: (updates: Partial<ReaderState>) => void;
  onSentenceClick: (index: number) => void;
}

const Reader: React.FC<ReaderProps> = ({ state, onBack, onUpdateState, onSentenceClick }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeSentenceRef = useRef<HTMLSpanElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);

  // Auto-scroll logic for both sentence and active word
  useEffect(() => {
    if (activeWordRef.current) {
      activeWordRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });
    } else if (activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [state.currentIndex, state.activeWordIndex]);

  const progress = state.currentBook 
    ? (state.currentIndex / (state.currentBook.content.length - 1)) * 100 
    : 0;

  if (!state.currentBook) return null;

  return (
    <div className="relative h-[calc(100vh-64px)] flex flex-col z-40 overflow-hidden font-sans bg-[#F9FBFC]">
      {/* Reader Toolbar */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-100 h-16 flex items-center justify-between px-6 shrink-0 shadow-sm z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 hover:bg-gray-100 rounded-2xl transition-all text-gray-600 active:scale-90"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <h2 className="font-black text-[#2C3E50] leading-tight text-sm md:text-base truncate max-w-[150px] md:max-w-xs uppercase tracking-tight">
              {state.currentBook.name}
            </h2>
            <div className="flex items-center gap-2">
              <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">
                Position {state.currentIndex + 1} / {state.currentBook.content.length} 
                • {Math.round(progress)}%
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="hidden sm:flex items-center gap-2 text-[#16A085] bg-teal-50 px-4 py-2 rounded-xl text-xs font-black hover:bg-[#16A085] hover:text-white transition-all active:scale-95">
            <Bookmark size={14} />
            Bookmark
          </button>
          <button className="p-3 text-gray-400 hover:text-[#2C3E50] hover:bg-gray-50 rounded-xl transition-all"><Share2 size={18} /></button>
          <button className="p-3 text-gray-400 hover:text-[#2C3E50] hover:bg-gray-50 rounded-xl transition-all"><MoreVertical size={18} /></button>
        </div>
      </header>

      {/* Main Text Content Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto pb-48 px-4 sm:px-8 bg-[#F9FBFC] smooth-scroll scroll-pt-24"
      >
        <div className="max-w-3xl mx-auto my-12 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.05)] rounded-[3rem] p-10 md:p-20 border border-gray-100/50">
          <article className="serif-text text-xl md:text-2xl leading-[2] text-[#2C3E50] text-justify">
            {state.currentBook.content.map((sentence, idx) => {
              const isActive = state.currentIndex === idx;
              
              if (!isActive) {
                return (
                  <span
                    key={idx}
                    onClick={() => onSentenceClick(idx)}
                    className="inline cursor-pointer transition-all duration-300 rounded-lg px-1.5 py-0.5 hover:bg-gray-100 hover:text-black text-gray-400/80 mb-2 inline-block"
                  >
                    {sentence}{' '}
                  </span>
                );
              }

              // Active sentence with word-by-word highlighting
              const words = sentence.split(' ');
              return (
                <div
                  key={idx}
                  ref={activeSentenceRef}
                  className="w-full bg-teal-50/50 border-l-8 border-[#16A085] rounded-3xl p-8 my-6 shadow-xl animate-in fade-in zoom-in-95 duration-500 ring-1 ring-teal-100"
                >
                  {words.map((word, wIdx) => {
                    const isWordActive = state.activeWordIndex === wIdx;
                    return (
                      <span
                        key={wIdx}
                        ref={isWordActive ? activeWordRef : null}
                        className={`
                          inline-block px-1.5 py-0.5 rounded-xl transition-all duration-200 cursor-pointer
                          ${isWordActive 
                            ? 'bg-[#16A085] text-white shadow-lg scale-110 font-black mx-1 translate-y-[-2px]' 
                            : 'text-[#2C3E50] hover:bg-teal-100'
                          }
                        `}
                      >
                        {word}{' '}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </article>
        </div>
      </div>

      {/* Floating Controls Overlay */}
      <Controls 
        isPlaying={state.isPlaying}
        onTogglePlay={() => onUpdateState({ isPlaying: !state.isPlaying })}
        onNext={() => onSentenceClick(Math.min(state.currentIndex + 1, state.currentBook!.content.length - 1))}
        onPrev={() => onSentenceClick(Math.max(state.currentIndex - 1, 0))}
        volume={state.volume}
        onVolumeChange={(volume) => onUpdateState({ volume })}
        speed={state.speed}
        onSpeedChange={(speed) => onUpdateState({ speed })}
        accent={state.accent}
        onAccentChange={(accent) => onUpdateState({ accent })}
        style={state.style}
        onStyleChange={(style) => onUpdateState({ style })}
        gender={state.gender}
        onGenderChange={(gender) => onUpdateState({ gender })}
        progress={progress}
      />
    </div>
  );
};

export default Reader;
