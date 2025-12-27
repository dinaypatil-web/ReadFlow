
import React, { useEffect, useRef, useState } from 'react';
import { EBook, ReaderState } from '../types';
import { ArrowLeft, Bookmark, Share2, List, X, ChevronRight, Loader2, Zap } from 'lucide-react';
import Controls from './Controls';

interface ReaderProps {
  state: ReaderState;
  onBack: () => void;
  onUpdateState: (updates: Partial<ReaderState>) => void;
  onSentenceClick: (index: number) => void;
}

const Reader: React.FC<ReaderProps> = ({ state, onBack, onUpdateState, onSentenceClick }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeSentenceRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const [isTOCVisible, setIsTOCVisible] = useState(false);

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

  const currentChapter = [...state.currentBook.chapters]
    .reverse()
    .find(ch => ch.startIndex <= state.currentIndex) || state.currentBook.chapters[0];

  return (
    <div className="relative h-screen flex flex-col z-40 overflow-hidden font-sans bg-[#F9FBFC]">
      <div className={`fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-[60] transform transition-transform duration-500 ease-in-out ${isTOCVisible ? 'translate-x-0' : 'translate-x-full'} border-l border-gray-100 flex flex-col`}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-black text-[#2C3E50] text-xl">Chapters</h3>
          <button onClick={() => setIsTOCVisible(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {state.currentBook.chapters.map((chapter, idx) => {
            const isActive = currentChapter.startIndex === chapter.startIndex;
            return (
              <button
                key={idx}
                onClick={() => {
                  onSentenceClick(chapter.startIndex);
                  setIsTOCVisible(false);
                }}
                className={`w-full text-left p-4 rounded-2xl flex items-center justify-between transition-all group ${isActive ? 'bg-[#16A085] text-white shadow-lg' : 'hover:bg-gray-50 text-[#2C3E50]'}`}
              >
                <div className="flex flex-col">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-white/70' : 'text-gray-400'}`}>Chapter {idx + 1}</span>
                  <span className={`font-bold line-clamp-1 ${isActive ? 'text-white' : 'text-[#2C3E50]'}`}>{chapter.title}</span>
                </div>
                <ChevronRight size={16} className={`transition-transform ${isActive ? 'translate-x-1' : 'group-hover:translate-x-1 text-gray-300'}`} />
              </button>
            );
          })}
        </div>
      </div>

      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-100 h-16 flex items-center justify-between px-6 shrink-0 shadow-sm z-50">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 hover:bg-gray-100 rounded-2xl transition-all text-gray-600 active:scale-90">
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="font-black text-[#2C3E50] leading-tight text-xs md:text-sm truncate max-w-[150px] md:max-w-xs uppercase tracking-tight">
                {state.currentBook.name}
              </h2>
              {state.isPlaying && (
                <div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-md border border-yellow-100">
                  <Zap size={10} className="text-yellow-600 animate-pulse fill-yellow-600" />
                  <span className="text-[8px] font-black text-yellow-700 uppercase tracking-tighter">Stay Awake Active</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold text-[#16A085] uppercase tracking-widest">
                {currentChapter?.title}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsTOCVisible(true)}
            className="flex items-center gap-2 text-[#2C3E50] bg-gray-50 px-4 py-2 rounded-xl text-xs font-black hover:bg-gray-200 transition-all active:scale-95"
          >
            <List size={14} />
            Chapters
          </button>
          <button className="hidden sm:flex items-center gap-2 text-[#16A085] bg-teal-50 px-4 py-2 rounded-xl text-xs font-black hover:bg-[#16A085] hover:text-white transition-all active:scale-95">
            <Bookmark size={14} />
            Save
          </button>
          <button className="p-3 text-gray-400 hover:text-[#2C3E50] rounded-xl transition-all"><Share2 size={18} /></button>
        </div>
      </header>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pb-48 px-4 sm:px-8 bg-[#F9FBFC] smooth-scroll">
        <div className="max-w-4xl mx-auto my-12 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.05)] rounded-[3rem] p-10 md:p-20 border border-gray-100/50">
          <article className="serif-text text-xl md:text-2xl leading-[2.2] text-[#2C3E50] text-justify">
            {state.currentBook.content.map((sentence, idx) => {
              const isActive = state.currentIndex === idx;
              
              if (!isActive) {
                return (
                  <span
                    key={idx}
                    onClick={() => onSentenceClick(idx)}
                    className="cursor-pointer transition-all duration-300 rounded-lg px-1 hover:bg-gray-100 hover:text-black text-gray-400/80 mb-2 inline"
                  >
                    {sentence}{' '}
                  </span>
                );
              }

              const words = sentence.trim().split(/\s+/);
              
              return (
                <div 
                  key={idx} 
                  ref={activeSentenceRef} 
                  className="w-full bg-teal-50/40 border-l-[10px] border-[#16A085] rounded-3xl p-8 md:p-12 my-10 shadow-[0_15px_40px_rgba(22,160,133,0.1)] animate-in fade-in slide-in-from-left-4 duration-700"
                >
                  {words.map((word, wIdx) => {
                    const isWordActive = state.activeWordIndex === wIdx;
                    return (
                      <span
                        key={wIdx}
                        ref={isWordActive ? activeWordRef : null}
                        className={`inline-block px-1.5 py-0.5 rounded-xl transition-all duration-150 ease-out cursor-default ${
                          isWordActive 
                            ? 'bg-[#16A085] text-white shadow-[0_4px_12px_rgba(22,160,133,0.4)] scale-110 font-bold mx-1 translate-y-[-2px]' 
                            : 'text-[#2C3E50] hover:bg-teal-100/50'
                        }`}
                      >
                        {word}
                      </span>
                    );
                  })}
                </div>
              );
            })}
            
            {state.currentBook.isLoadingMore && (
              <div className="mt-16 flex flex-col items-center justify-center p-12 border-2 border-dashed border-teal-100 rounded-[2.5rem] bg-teal-50/20 animate-pulse">
                <Loader2 className="animate-spin text-[#16A085] mb-4" size={40} />
                <div className="text-center">
                  <p className="text-[#16A085] font-black text-sm uppercase tracking-widest mb-1">Expanding your library</p>
                  <p className="text-teal-600/60 text-xs font-medium italic">Gemini is transcribing the next section in the background...</p>
                </div>
              </div>
            )}

            {state.currentBook.isFullyLoaded && state.currentIndex === state.currentBook.content.length - 1 && (
              <div className="mt-20 border-t border-gray-100 pt-10 text-center">
                <div className="inline-block p-4 bg-gray-50 rounded-full mb-4">
                  <Bookmark className="text-[#16A085]" size={32} />
                </div>
                <h4 className="text-[#2C3E50] font-black text-xl mb-2">You've reached the end!</h4>
                <p className="text-gray-400 font-medium">This book has been completely transcribed.</p>
              </div>
            )}
          </article>
        </div>
      </div>

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
