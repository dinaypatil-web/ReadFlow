
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
