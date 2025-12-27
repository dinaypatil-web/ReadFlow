
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EBook, ReaderState, Accent, VoiceStyle, Gender } from './types';
import Library from './components/Library';
import Reader from './components/Reader';
import { geminiService } from './services/geminiService';
import { Loader2, AlertCircle } from 'lucide-react';
import JSZip from 'jszip';

const INITIAL_BOOKS: EBook[] = [
  {
    id: '1',
    name: 'The Philosophy of Modern Art',
    format: 'PDF',
    content: [
      "Modern art is often defined as the artistic work produced during the period extending roughly from the 1860s to the 1970s.",
      "The term 'Modern Art' is associated with art in which the traditions of the past have been thrown aside in a spirit of experimentation.",
      "Modern artists experimented with new ways of seeing and with fresh ideas about the nature of materials and functions of art.",
      "A tendency away from the narrative, which was characteristic for the traditional arts, toward abstraction is characteristic of much modern art.",
      "More recent artistic production is often called contemporary art or postmodern art."
    ],
    chapters: [{ title: 'Introduction', startIndex: 0 }],
    lastPosition: 0,
    source: 'Local'
  }
];

const App: React.FC = () => {
  const [books, setBooks] = useState<EBook[]>(INITIAL_BOOKS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [readerState, setReaderState] = useState<ReaderState>({
    currentBook: null,
    isPlaying: false,
    currentIndex: 0,
    activeWordIndex: -1,
    volume: 0.8,
    speed: 1.0,
    accent: 'American',
    style: 'Storytelling',
    gender: 'Female'
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isTransitioningRef = useRef(false);
  const wordUpdateIntervalRef = useRef<number | null>(null);

  // Load persistence
  useEffect(() => {
    const savedBooks = localStorage.getItem('readflow_v5_books');
    if (savedBooks) {
      const parsed = JSON.parse(savedBooks);
      if (parsed.length > 0) setBooks(parsed);
    }
  }, []);

  // Save changes
  useEffect(() => {
    localStorage.setItem('readflow_v5_books', JSON.stringify(books));
  }, [books]);

  const resumeAudioContext = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      return audioContextRef.current;
    } catch (e) {
      return null;
    }
  }, []);

  const stopAudio = useCallback(() => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.onended = null;
        audioSourceRef.current.stop();
      } catch (e) {}
      audioSourceRef.current = null;
    }
    if (wordUpdateIntervalRef.current) {
      window.clearInterval(wordUpdateIntervalRef.current);
      wordUpdateIntervalRef.current = null;
    }
    setReaderState(prev => ({ ...prev, activeWordIndex: -1 }));
  }, []);

  const playSentence = useCallback(async (index: number) => {
    if (!readerState.currentBook || isTransitioningRef.current) return;
    
    const ctx = await resumeAudioContext();
    if (!ctx) return;

    isTransitioningRef.current = true;
    stopAudio();

    const text = readerState.currentBook.content[index];
    if (!text || text.trim().length === 0) {
      setReaderState(prev => {
        const nextIdx = index + 1;
        if (nextIdx < (prev.currentBook?.content.length || 0)) {
          return { ...prev, currentIndex: nextIdx };
        }
        return { ...prev, isPlaying: false };
      });
      isTransitioningRef.current = false;
      return;
    }

    try {
      const base64Audio = await geminiService.generateSpeech(
        text, 
        readerState.accent, 
        readerState.style,
        readerState.gender
      );
      
      const audioData = geminiService.decode(base64Audio);
      const decodedBuffer = await geminiService.decodeAudioData(audioData, ctx, 24000, 1);
      
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      
      source.buffer = decodedBuffer;
      source.playbackRate.value = readerState.speed;
      gainNode.gain.value = readerState.volume;
      
      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      const words = text.trim().split(/\s+/);
      const totalChars = text.length;
      const totalDuration = decodedBuffer.duration / readerState.speed;
      const startTime = ctx.currentTime;

      let charAcc = 0;
      const wordTimestamps = words.map(word => {
        const start = (charAcc / totalChars) * totalDuration;
        charAcc += word.length + 1;
        return start;
      });

      wordUpdateIntervalRef.current = window.setInterval(() => {
        const elapsed = ctx.currentTime - startTime;
        let activeIdx = 0;
        for (let i = 0; i < wordTimestamps.length; i++) {
          if (elapsed >= wordTimestamps[i]) {
            activeIdx = i;
          } else {
            break;
          }
        }
        setReaderState(prev => prev.activeWordIndex !== activeIdx ? { ...prev, activeWordIndex: activeIdx } : prev);
      }, 50);
      
      source.onended = () => {
        if (wordUpdateIntervalRef.current) window.clearInterval(wordUpdateIntervalRef.current);
        setReaderState(prev => {
          if (prev.isPlaying && prev.currentIndex === index && index < prev.currentBook!.content.length - 1) {
            return { ...prev, currentIndex: index + 1, activeWordIndex: -1 };
          }
          return { ...prev, isPlaying: false, activeWordIndex: -1 };
        });
      };

      audioSourceRef.current = source;
      source.start(0);
    } catch (error: any) {
      const isQuotaError = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
      if (isQuotaError) {
        setError("AI Quota limit reached. Pausing for a moment...");
        setReaderState(prev => ({ ...prev, isPlaying: false }));
      } else {
        setReaderState(prev => {
          const nextIdx = index + 1;
          if (nextIdx < (prev.currentBook?.content.length || 0)) {
            return { ...prev, currentIndex: nextIdx, activeWordIndex: -1 };
          }
          return { ...prev, isPlaying: false, activeWordIndex: -1 };
        });
      }
    } finally {
      isTransitioningRef.current = false;
    }
  }, [readerState.currentBook, readerState.accent, readerState.style, readerState.gender, readerState.speed, readerState.volume, stopAudio, resumeAudioContext]);

  useEffect(() => {
    if (readerState.isPlaying && readerState.currentBook) {
      playSentence(readerState.currentIndex);
    } else {
      stopAudio();
    }
    return () => stopAudio();
  }, [readerState.isPlaying, readerState.currentIndex, readerState.accent, readerState.style, readerState.gender, playSentence, stopAudio]);

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    try {
      let extractedContent: string[] = [];
      const mimeType = file.type || 'application/octet-stream';
      const isEpub = mimeType === 'application/epub+zip' || file.name.endsWith('.epub');

      if (isEpub) {
        const zip = await JSZip.loadAsync(file);
        let raw = '';
        const files = Object.keys(zip.files);
        for (const f of files) {
          if (f.endsWith('.xhtml') || f.endsWith('.html')) {
            const text = await zip.files[f].async('string');
            raw += text;
          }
        }
        extractedContent = await geminiService.processText(raw.replace(/<[^>]*>/g, ' '));
      } else if (mimeType.startsWith('text/')) {
        const text = await file.text();
        extractedContent = text.split(/\n+/).filter(l => l.trim().length > 0);
      } else if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        extractedContent = await geminiService.extractText(base64, mimeType);
      } else {
        throw new Error("Unsupported file type. Please upload a PDF, EPUB, or text file.");
      }

      if (!extractedContent || extractedContent.length === 0) {
        throw new Error("Could not extract any readable content from this file.");
      }

      const newBook: EBook = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name.replace(/\.[^/.]+$/, ""),
        format: file.name.split('.').pop()?.toUpperCase() || 'FILE',
        content: extractedContent,
        chapters: [{ title: 'Chapter 1', startIndex: 0 }],
        lastPosition: 0,
        source: 'Local'
      };
      setBooks(prev => [...prev, newBook]);
      openBook(newBook);
    } catch (err: any) {
      console.error("File processing error:", err);
      setError(err.message || "Failed to process book. Ensure the file is valid and readable.");
    } finally {
      setIsProcessing(false);
    }
  };

  const openBook = (book: EBook) => {
    setReaderState(prev => ({ 
      ...prev, 
      currentBook: book, 
      currentIndex: book.lastPosition, 
      isPlaying: false, 
      activeWordIndex: -1 
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeReader = () => {
    stopAudio();
    setReaderState(prev => ({ ...prev, currentBook: null, isPlaying: false }));
  };

  const handleSentenceClick = (index: number) => {
    setReaderState(prev => ({ ...prev, currentIndex: index, isPlaying: true, activeWordIndex: -1 }));
  };

  return (
    <div className={`min-h-screen bg-[#F9FBFC] ${readerState.currentBook ? 'overflow-hidden' : ''}`}>
      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[210] flex flex-col items-center justify-center text-white p-6 text-center animate-in fade-in duration-300">
          <Loader2 className="w-12 h-12 animate-spin text-[#16A085] mb-4" />
          <h2 className="text-xl font-bold">Parsing Document...</h2>
          <p className="text-sm text-gray-300 mt-2">Our AI is extracting and cleaning your text.</p>
        </div>
      )}

      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[220] w-full max-w-md px-4 pointer-events-none animate-in slide-in-from-top-4 duration-300">
          <div className="bg-white border-l-4 border-amber-500 p-6 rounded-2xl shadow-2xl flex items-start gap-4 pointer-events-auto ring-1 ring-amber-100">
            <AlertCircle className="text-amber-500 shrink-0" size={24} />
            <div className="flex-1">
              <h3 className="text-amber-800 font-black text-sm uppercase tracking-widest">Notice</h3>
              <p className="text-amber-700 text-xs mt-1 font-bold">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
          </div>
        </div>
      )}

      <nav className="bg-[#2C3E50] text-white p-4 shadow-md flex justify-between items-center h-16 shrink-0 sticky top-0 z-[100]">
        <div className="flex items-center gap-2 cursor-pointer" onClick={closeReader}>
          <div className="w-8 h-8 bg-[#16A085] rounded flex items-center justify-center font-bold">E</div>
          <span className="font-bold text-xl tracking-tight">ReadFlow</span>
        </div>
        <div className="hidden md:flex gap-6 text-sm font-bold">
          <button className="hover:text-[#16A085] transition-colors" onClick={closeReader}>My Bookshelf</button>
        </div>
        <div className="w-8 h-8 bg-gray-600 rounded-full border-2 border-[#16A085] flex items-center justify-center overflow-hidden">
          <img src="https://picsum.photos/32/32" alt="Avatar" />
        </div>
      </nav>

      <main className="relative min-h-[calc(100vh-64px)]">
        {!readerState.currentBook ? (
          <Library 
            books={books} 
            onUpload={handleFileUpload} 
            onOpenBook={openBook} 
            onDeleteBook={(id) => setBooks(prev => prev.filter(b => b.id !== id))}
          />
        ) : (
          <div className="h-full">
            <Reader 
              state={readerState}
              onBack={closeReader}
              onUpdateState={(updates) => setReaderState(prev => ({ ...prev, ...updates }))}
              onSentenceClick={handleSentenceClick}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
