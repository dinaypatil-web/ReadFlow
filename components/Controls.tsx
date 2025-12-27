
import React from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, 
  Globe, Music, FastForward, User, UserCircle 
} from 'lucide-react';
import { Accent, VoiceStyle, Gender } from '../types';

interface ControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  volume: number;
  onVolumeChange: (val: number) => void;
  speed: number;
  onSpeedChange: (val: number) => void;
  accent: Accent;
  onAccentChange: (val: Accent) => void;
  style: VoiceStyle;
  onStyleChange: (val: VoiceStyle) => void;
  gender: Gender;
  onGenderChange: (val: Gender) => void;
  progress: number;
}

const Controls: React.FC<ControlsProps> = ({
  isPlaying, onTogglePlay, onNext, onPrev,
  volume, onVolumeChange, speed, onSpeedChange,
  accent, onAccentChange, style, onStyleChange,
  gender, onGenderChange,
  progress
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-6xl mx-auto bg-white/90 backdrop-blur-md border border-gray-200 shadow-2xl rounded-2xl p-4 flex flex-col gap-4">
        {/* Progress Bar */}
        <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#16A085] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Main Playback Controls */}
          <div className="flex items-center gap-4">
            <button onClick={onPrev} className="p-2 text-gray-600 hover:text-[#16A085] transition-colors">
              <SkipBack size={24} fill="currentColor" />
            </button>
            <button 
              onClick={onTogglePlay}
              className="w-12 h-12 flex items-center justify-center bg-[#16A085] text-white rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" className="ml-1" />}
            </button>
            <button onClick={onNext} className="p-2 text-gray-600 hover:text-[#16A085] transition-colors">
              <SkipForward size={24} fill="currentColor" />
            </button>
          </div>

          {/* Settings Section */}
          <div className="flex items-center gap-4 lg:gap-6 flex-wrap">
            {/* Gender Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
              <button
                onClick={() => onGenderChange('Male')}
                className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium transition-all ${gender === 'Male' ? 'bg-white shadow-sm text-[#16A085]' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <User size={14} />
                Male
              </button>
              <button
                onClick={() => onGenderChange('Female')}
                className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium transition-all ${gender === 'Female' ? 'bg-white shadow-sm text-[#16A085]' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <UserCircle size={14} />
                Female
              </button>
            </div>

            {/* Accent Selector */}
            <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
              <Globe size={16} className="text-gray-500" />
              <select 
                value={accent} 
                onChange={(e) => onAccentChange(e.target.value as Accent)}
                className="bg-transparent text-sm font-medium text-[#2C3E50] outline-none cursor-pointer"
              >
                <option value="American">American</option>
                <option value="British">British</option>
                <option value="Indian">Indian</option>
                <option value="African">African</option>
                <option value="Middle Eastern">Middle Eastern</option>
                <option value="Australian">Australian</option>
              </select>
            </div>

            {/* Style Selector */}
            <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
              <Music size={16} className="text-gray-500" />
              <select 
                value={style} 
                onChange={(e) => onStyleChange(e.target.value as VoiceStyle)}
                className="bg-transparent text-sm font-medium text-[#2C3E50] outline-none cursor-pointer"
              >
                <option value="Storytelling">Storytelling</option>
                <option value="Podcast">Podcast</option>
                <option value="Dramatic">Dramatic</option>
                <option value="Educational">Educational</option>
              </select>
            </div>

            {/* Speed Control */}
            <div className="flex items-center gap-2">
              <FastForward size={18} className="text-gray-500" />
              <select 
                value={speed} 
                onChange={(e) => onSpeedChange(Number(e.target.value))}
                className="bg-transparent text-sm font-bold text-[#2C3E50] outline-none cursor-pointer"
              >
                <option value={0.75}>0.75x</option>
                <option value={1.0}>1.0x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2.0}>2.0x</option>
              </select>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2 group">
              <Volume2 size={18} className="text-gray-500" />
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01"
                value={volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="w-20 lg:w-24 h-1.5 bg-gray-200 rounded-full appearance-none accent-[#16A085] cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Controls;
