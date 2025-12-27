
export type Accent = 'American' | 'British' | 'Indian' | 'Middle Eastern' | 'African' | 'Australian';
export type VoiceStyle = 'Storytelling' | 'Podcast' | 'Dramatic' | 'Educational';
export type Gender = 'Male' | 'Female';
export type BookSource = 'Local';

export interface EBook {
  id: string;
  name: string;
  format: string;
  content: string[]; // Chunks of text (sentences or paragraphs)
  chapters: Chapter[];
  lastPosition: number; // Current chunk index
  source?: BookSource;
  originalFileBase64?: string; // Stored for background OCR continuation
  mimeType?: string;
  isFullyLoaded: boolean;
  isLoadingMore?: boolean; // UI state for background loading
  loadProgress?: number; // 0 to 100 percentage of file processed
}

export interface Chapter {
  title: string;
  startIndex: number;
}

export interface ReaderState {
  currentBook: EBook | null;
  isPlaying: boolean;
  currentIndex: number;
  activeWordIndex: number;
  volume: number;
  speed: number;
  accent: Accent;
  style: VoiceStyle;
  gender: Gender;
}
