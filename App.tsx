
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EBook, ReaderState, Chapter } from './types';
import Library from './components/Library';
import Reader from './components/Reader';
import { GeminiService, geminiService } from './services/geminiService';
import { Loader2, AlertCircle, X, Terminal, Cpu } from 'lucide-react';
import JSZip from 'jszip';

const INITIAL_BOOKS: EBook[] = [
  {
    id: '1',
    name: 'Introduction to ReadFlow',
    format: 'DOC',
    content: [
      "Welcome to ReadFlow, your professional AI-powered e-book dashboard.",
      "You can upload PDF, EPUB, and Text files to hear them read in various accents.",
      "The reader highlights each word as it is spoken, providing an immersive experience.",
      "Your library is stored locally in your browser for privacy and speed."
    ],
    chapters: [{ title: 'Welcome', startIndex: 0 }],
    lastPosition: 0,
    source: 'Local',
    isFullyLoaded: true,
    loadProgress: 100
  }
];

const MatrixRain: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const katakana = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン';
    const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = '0123456789';
    const alphabet = katakana + latin + nums;

    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const rainDrops: number[] = [];

    for (let x = 0; x < columns; x++) {
      rainDrops[x] = 1;
    }

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#0F0';
      ctx.font = fontSize + 'px monospace';

      for (let i = 0; i < rainDrops.length; i++) {
        const text = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        ctx.fillText(text, i * fontSize, rainDrops[i] * fontSize);

        if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          rainDrops[i] = 0;
        }
        rainDrops[i]++;
      }
    };

    const interval = setInterval(draw, 30);
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />;
};

const App: React.FC = () => {
  const [books, setBooks] = useState<EBook[]>(INITIAL_BOOKS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
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
  const wakeLockRef = useRef<any>(null);

  // PREFETCH BUFFER SYSTEM
  const bufferRef = useRef<Map<number, AudioBuffer>>(new Map());
  const fetchingIndicesRef = useRef<Set<number>>(new Set());

  // WAKE LOCK & MEDIA SESSION LOGIC
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      }
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  const updateMediaSession = useCallback(() => {
    if ('mediaSession' in navigator && readerState.currentBook) {
      const currentSentence = readerState.currentBook.content[readerState.currentIndex];
      (navigator as any).mediaSession.metadata = new (window as any).MediaMetadata({
        title: readerState.currentBook.name,
        artist: currentSentence ? currentSentence.slice(0, 100) + '...' : 'ReadFlow AI',
        album: 'ReadFlow Dashboard',
      });

      (navigator as any).mediaSession.setActionHandler('play', () => setReaderState(p => ({ ...p, isPlaying: true })));
      (navigator as any).mediaSession.setActionHandler('pause', () => setReaderState(p => ({ ...p, isPlaying: false })));
      (navigator as any).mediaSession.setActionHandler('previoustrack', () => {
        const prevIdx = Math.max(0, readerState.currentIndex - 1);
        setReaderState(p => ({ ...p, currentIndex: prevIdx, isPlaying: true }));
      });
      (navigator as any).mediaSession.setActionHandler('nexttrack', () => {
        const nextIdx = Math.min(readerState.currentBook!.content.length - 1, readerState.currentIndex + 1);
        setReaderState(p => ({ ...p, currentIndex: nextIdx, isPlaying: true }));
      });
    }
  }, [readerState.currentBook, readerState.currentIndex]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && readerState.isPlaying) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [readerState.isPlaying, requestWakeLock]);

  useEffect(() => {
    if (readerState.isPlaying) {
      requestWakeLock();
      updateMediaSession();
      if ('mediaSession' in navigator) (navigator as any).mediaSession.playbackState = 'playing';
    } else {
      releaseWakeLock();
      if ('mediaSession' in navigator) (navigator as any).mediaSession.playbackState = 'paused';
    }
  }, [readerState.isPlaying, requestWakeLock, releaseWakeLock, updateMediaSession]);

  useEffect(() => {
    const savedBooks = localStorage.getItem('readflow_v16_books');
    if (savedBooks) {
      try {
        const parsed = JSON.parse(savedBooks);
        if (Array.isArray(parsed) && parsed.length > 0) setBooks(parsed);
      } catch (e) { console.error("Persistence Load Error", e); }
    }
  }, []);

  useEffect(() => {
    if (books !== INITIAL_BOOKS) {
      localStorage.setItem('readflow_v16_books', JSON.stringify(books));
    }
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
    } catch (e) { return null; }
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

  const prefetchSentences = useCallback(async (startIndex: number) => {
    if (!readerState.currentBook) return;
    const ctx = await resumeAudioContext();
    if (!ctx) return;

    const { accent, style, gender } = readerState;
    const lookahead = 5;
    const content = readerState.currentBook.content;

    for (let i = startIndex; i < Math.min(startIndex + lookahead, content.length); i++) {
      if (bufferRef.current.has(i) || fetchingIndicesRef.current.has(i)) continue;

      const text = content[i];
      if (!text?.trim()) continue;

      fetchingIndicesRef.current.add(i);
      
      (async () => {
        try {
          const base64Audio = await geminiService.generateSpeech(text, accent, style, gender);
          const audioData = geminiService.decode(base64Audio);
          const decodedBuffer = await geminiService.decodeAudioData(audioData, ctx, 24000, 1);
          bufferRef.current.set(i, decodedBuffer);
        } catch (e) {
          console.error(`Prefetch failed for index ${i}`, e);
        } finally {
          fetchingIndicesRef.current.delete(i);
        }
      })();
    }
  }, [readerState.currentBook, readerState.accent, readerState.style, readerState.gender, resumeAudioContext]);

  const playSentence = useCallback(async (index: number) => {
    if (!readerState.currentBook || isTransitioningRef.current) return;
    const ctx = await resumeAudioContext();
    if (!ctx) return;

    isTransitioningRef.current = true;
    stopAudio();

    const text = readerState.currentBook.content[index];
    if (!text?.trim()) {
      setReaderState(prev => ({
        ...prev,
        currentIndex: (index + 1) < (prev.currentBook?.content.length || 0) ? index + 1 : index,
        isPlaying: (index + 1) < (prev.currentBook?.content.length || 0)
      }));
      isTransitioningRef.current = false;
      return;
    }

    try {
      let decodedBuffer: AudioBuffer;

      if (bufferRef.current.has(index)) {
        decodedBuffer = bufferRef.current.get(index)!;
      } else {
        const base64Audio = await geminiService.generateSpeech(
          text, readerState.accent, readerState.style, readerState.gender
        );
        const audioData = geminiService.decode(base64Audio);
        decodedBuffer = await geminiService.decodeAudioData(audioData, ctx, 24000, 1);
      }
      
      prefetchSentences(index + 1);

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
          if (elapsed >= wordTimestamps[i]) activeIdx = i;
          else break;
        }
        setReaderState(prev => prev.activeWordIndex !== activeIdx ? { ...prev, activeWordIndex: activeIdx } : prev);
      }, 50);
      
      source.onended = () => {
        if (wordUpdateIntervalRef.current) window.clearInterval(wordUpdateIntervalRef.current);
        bufferRef.current.delete(index);
        setReaderState(prev => {
          if (prev.isPlaying && prev.currentIndex === index && index < prev.currentBook!.content.length - 1) {
            return { ...prev, currentIndex: index + 1, activeWordIndex: -1 };
          }
          return { ...prev, isPlaying: false, activeWordIndex: -1 };
        });
      };
      audioSourceRef.current = source;
      source.start(0);
    } catch (err) {
      console.error("Playback Error", err);
      setReaderState(prev => ({ ...prev, isPlaying: false }));
    } finally {
      isTransitioningRef.current = false;
    }
  }, [readerState.currentBook, readerState.accent, readerState.style, readerState.gender, readerState.speed, readerState.volume, stopAudio, resumeAudioContext, prefetchSentences]);

  useEffect(() => {
    bufferRef.current.clear();
    fetchingIndicesRef.current.clear();
    if (readerState.isPlaying) {
      prefetchSentences(readerState.currentIndex + 1);
    }
  }, [readerState.accent, readerState.gender, readerState.style, prefetchSentences]);

  useEffect(() => {
    if (readerState.isPlaying) {
      playSentence(readerState.currentIndex);
    } else {
      stopAudio();
    }
  }, [readerState.isPlaying, readerState.currentIndex, playSentence, stopAudio]);

  useEffect(() => {
    const incompleteBook = books.find(b => !b.isFullyLoaded && !b.isLoadingMore);
    if (incompleteBook) {
      loadMoreContent(incompleteBook.id);
    }
  }, [books]);

  const loadMoreContent = async (bookId: string) => {
    const book = books.find(b => b.id === bookId);
    if (!book || !book.originalFileBase64 || !book.mimeType || book.isLoadingMore) return;

    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, isLoadingMore: true } : b));
    if (readerState.currentBook?.id === bookId) {
      setReaderState(prev => ({ ...prev, currentBook: { ...prev.currentBook!, isLoadingMore: true } }));
    }

    try {
      const lastTextChunk = book.content.slice(-3).join(' ');
      const rawText = await geminiService.extractTextVerbatim(book.originalFileBase64, book.mimeType, {
        continueFromText: lastTextChunk
      });

      const isEOF = rawText.includes("EOF_REACHED");
      const cleanedText = cleanText(rawText).replace("EOF_REACHED", "").trim();
      const newSegments = GeminiService.splitTextLocally(cleanedText);

      if (newSegments.length === 0 && !isEOF) {
        setBooks(prev => prev.map(b => b.id === bookId ? { ...b, isLoadingMore: false, isFullyLoaded: true, loadProgress: 100 } : b));
        return;
      }

      const updatedFullContent = [...book.content, ...newSegments];
      const updatedChapters = updatedFullContent.length % 50 === 0 
        ? await geminiService.detectChapters(updatedFullContent)
        : book.chapters;

      const currentProgress = book.loadProgress || 5;
      const nextProgress = isEOF ? 100 : Math.min(99, currentProgress + 5);

      const updateBookInList = (prev: EBook[]) => prev.map(b => {
        if (b.id !== bookId) return b;
        return { 
          ...b, 
          content: updatedFullContent, 
          chapters: updatedChapters,
          isLoadingMore: false, 
          isFullyLoaded: isEOF,
          loadProgress: nextProgress
        };
      });

      setBooks(updateBookInList);

      setReaderState(prev => {
        if (prev.currentBook?.id !== bookId) return prev;
        return { 
          ...prev, 
          currentBook: { 
            ...prev.currentBook, 
            content: updatedFullContent, 
            chapters: updatedChapters,
            isLoadingMore: false, 
            isFullyLoaded: isEOF,
            loadProgress: nextProgress
          } 
        };
      });

    } catch (err) {
      console.error("Batch Stream Failure", err);
      await new Promise(r => setTimeout(r, 4000));
      setBooks(prev => prev.map(b => b.id === bookId ? { ...b, isLoadingMore: false } : b));
    }
  };

  const cleanText = (text: string) => {
    return text
      .replace(/Would you like the transcription of the next few chapters\??/gi, '')
      .replace(/I have extracted the text up to this point\..*/gi, '')
      .replace(/Next chapters.*/gi, '')
      .replace(/\[\.\.\.\]/g, '')
      .trim();
  };

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setUploadProgress(0);
    setProcessingStatus(`Initializing data-stream for ${file.name}...`);
    setError(null);
    try {
      const mimeType = file.type;
      let extractedContent: string[] = [];
      let detectedChapters: Chapter[] = [];
      let originalBase64: string | undefined = undefined;
      let isFullyLoaded = false;

      if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
        setProcessingStatus('Downloading initial 5% of matrix...');
        setUploadProgress(10);
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        originalBase64 = base64;
        setUploadProgress(30);
        
        const rawText = await geminiService.extractTextVerbatim(base64, mimeType, { isInitialChunk: true });
        setUploadProgress(70);
        extractedContent = GeminiService.splitTextLocally(cleanText(rawText));
        
        setProcessingStatus('Formatting voice stream...');
        detectedChapters = await geminiService.detectChapters(extractedContent);
        setUploadProgress(100);
        isFullyLoaded = false; 
      } else if (mimeType === 'text/plain') {
        const text = await file.text();
        extractedContent = GeminiService.splitTextLocally(text);
        detectedChapters = await geminiService.detectChapters(extractedContent);
        isFullyLoaded = true;
      } else if (file.name.endsWith('.epub')) {
        const zip = await JSZip.loadAsync(file);
        const files = Object.keys(zip.files).filter(f => f.endsWith('.xhtml') || f.endsWith('.html')).sort();
        let currentIndex = 0;
        for (let i = 0; i < files.length; i++) {
          const content = await zip.files[files[i]].async('text');
          const doc = new DOMParser().parseFromString(content, 'text/html');
          const title = doc.querySelector('h1, h2, h3, title')?.textContent || `Chapter ${i + 1}`;
          const rawText = (doc.body.innerText || doc.body.textContent || '').trim();
          if (rawText) {
            const segments = GeminiService.splitTextLocally(rawText);
            detectedChapters.push({ title: title.trim(), startIndex: currentIndex });
            extractedContent.push(...segments);
            currentIndex += segments.length;
          }
          setUploadProgress(10 + ((i + 1) / files.length) * 80);
        }
        isFullyLoaded = true;
      } else {
        throw new Error("Link to matrix failed. Unsupported file format.");
      }

      const newBook: EBook = {
        id: Date.now().toString(),
        name: file.name.replace(/\.[^/.]+$/, ""),
        format: file.name.split('.').pop()?.toUpperCase() || 'DOC',
        content: extractedContent,
        chapters: detectedChapters.length > 0 ? detectedChapters : [{ title: 'Main', startIndex: 0 }],
        lastPosition: 0,
        source: 'Local',
        originalFileBase64: originalBase64,
        mimeType: mimeType,
        isFullyLoaded: isFullyLoaded,
        loadProgress: isFullyLoaded ? 100 : 5
      };

      setBooks(prev => [...prev, newBook]);
      setProcessingStatus('Decryption complete. Initializing playback...');
      
      setReaderState(prev => ({
        ...prev,
        currentBook: newBook,
        currentIndex: 0,
        isPlaying: true,
        activeWordIndex: -1
      }));

      setTimeout(() => setIsProcessing(false), 800);
    } catch (err: any) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  const activeBookProcessing = readerState.currentBook && !readerState.currentBook.isFullyLoaded;
  const activeLoadProgress = readerState.currentBook?.loadProgress || 0;

  return (
    <div className="min-h-screen bg-[#ECF0F1]">
      {isProcessing && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden">
          <MatrixRain />
          <div className="relative z-10 flex flex-col items-center text-center p-8">
            <div className="matrix-text text-[#0F0] text-9xl font-black mb-8 animate-pulse drop-shadow-[0_0_20px_rgba(0,255,0,0.5)]">
              {Math.round(uploadProgress)}%
            </div>
            <div className="flex items-center gap-3 matrix-text text-[#0F0] text-xl font-bold uppercase tracking-[0.2em] bg-black/60 px-8 py-4 rounded-full border border-[#0F0]/50 shadow-[0_0_30px_rgba(0,255,0,0.2)]">
              <Terminal size={24} className="animate-bounce" />
              {processingStatus}
            </div>
            <div className="mt-12 w-80 h-1.5 bg-[#0F0]/20 rounded-full overflow-hidden border border-[#0F0]/10">
              <div 
                className="h-full bg-[#0F0] shadow-[0_0_25px_rgba(0,255,0,1)] transition-all duration-700 ease-in-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[110] bg-white border-4 border-red-500 rounded-[2rem] p-6 shadow-2xl flex items-center gap-4 animate-in slide-in-from-top">
          <AlertCircle className="text-red-500" size={32} />
          <div>
            <p className="text-xs font-black text-red-400 uppercase tracking-widest">System Error</p>
            <p className="text-lg font-bold text-red-700">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-4 p-2 hover:bg-red-50 rounded-xl transition-all">
            <X size={24} />
          </button>
        </div>
      )}

      {readerState.currentBook ? (
        <Reader 
          state={readerState}
          onBack={() => setReaderState(prev => ({ ...prev, currentBook: null, isPlaying: false }))}
          onUpdateState={(updates) => setReaderState(prev => ({ ...prev, ...updates }))}
          onSentenceClick={(index) => setReaderState(prev => ({ ...prev, currentIndex: index, isPlaying: true, activeWordIndex: -1 }))}
        />
      ) : (
        <Library 
          books={books}
          onUpload={handleFileUpload}
          onOpenBook={(book) => setReaderState(prev => ({ ...prev, currentBook: book, currentIndex: book.lastPosition || 0, isPlaying: false }))}
          onDeleteBook={(id) => setBooks(prev => prev.filter(b => b.id !== id))}
        />
      )}

      {activeBookProcessing && (
        <div className="fixed bottom-24 right-8 z-[100] group animate-in slide-in-from-right fade-in duration-500">
          <div className="relative w-20 h-20 bg-white/40 backdrop-blur-xl rounded-full border border-white/20 shadow-2xl flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 border-4 border-[#16A085]/10 rounded-full animate-ping duration-[3000ms]" />
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-gray-200/20" />
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="currentColor"
                strokeWidth="4"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 36}`}
                strokeDashoffset={`${2 * Math.PI * 36 * (1 - activeLoadProgress / 100)}`}
                className="text-[#16A085] transition-all duration-1000 ease-out"
                strokeLinecap="round"
              />
            </svg>
            <div className="flex flex-col items-center">
              <span className="text-xs font-black text-[#2C3E50]">{activeLoadProgress}%</span>
              <Cpu size={12} className="text-[#16A085] animate-pulse mt-0.5" />
            </div>
            <div className="absolute bottom-full right-0 mb-4 bg-[#2C3E50] text-white text-[10px] px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold pointer-events-none shadow-xl">
               Gemini background processing...
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
