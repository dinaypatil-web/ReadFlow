
import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";
import { Accent, VoiceStyle, Gender } from "../types";

const GENDER_VOICE_MAP: Record<Gender, string> = {
  'Female': 'Kore',
  'Male': 'Charon'
};

export class GeminiService {
  private ai: GoogleGenAI;
  private ttsCache: Map<string, string> = new Map();

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  static splitTextLocally(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])|(?<=\n)\s*(?=\n)/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  async decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  private async callWithRetry<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const errorMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
        const isQuotaError = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED');
        if (isQuotaError && i < maxRetries - 1) {
          const waitTime = Math.pow(2, i) * 3000 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  async generateSpeech(text: string, accent: Accent, style: VoiceStyle, gender: Gender): Promise<string> {
    const voiceName = GENDER_VOICE_MAP[gender];
    const cacheKey = `${voiceName}_${accent}_${style}_${text}`;
    if (this.ttsCache.has(cacheKey)) return this.ttsCache.get(cacheKey)!;

    const prompt = `Strictly read verbatim: "${text}" with ${accent} accent, ${style} style.`;
    const response = await this.callWithRetry<GenerateContentResponse>(() => 
      this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
          },
        },
      })
    );

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data received.");
    this.ttsCache.set(cacheKey, base64Audio);
    return base64Audio;
  }

  /**
   * Optimized OCR extracting roughly 5% batches for rapid feedback loops.
   */
  async extractTextVerbatim(base64: string, mimeType: string, options?: { continueFromText?: string, isInitialChunk?: boolean }): Promise<string> {
    let systemPrompt = '';
    
    if (options?.isInitialChunk) {
      systemPrompt = `SYSTEM: You are a robotic OCR engine. Extract EXACTLY the first small batch (approx 5% of content) from this document. 
         Verbatim transcription. NO conversational fillers. NO summaries. 
         OUTPUT ONLY THE RAW TEXT. STOP ABRUPTLY ONCE THE FIRST 5% IS EXTRACTED.`;
    } else if (options?.continueFromText) {
      systemPrompt = `SYSTEM: You are a robotic OCR engine. Continue verbatim transcription. 
         Extract the NEXT batch (approx 5% more).
         Start exactly where this ends: "...${options.continueFromText.slice(-300)}".
         OUTPUT ONLY THE RAW TEXT. NO CONVERSATION.
         IF YOU REACH THE ABSOLUTE END, OUTPUT "EOF_REACHED" AT THE VERY END.`;
    } else {
      systemPrompt = `SYSTEM: You are a robotic OCR engine. Extract text verbatim. 
         OUTPUT ONLY RAW TEXT.`;
    }

    const response = await this.callWithRetry<GenerateContentResponse>(() =>
      this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64, mimeType } },
            { text: systemPrompt }
          ]
        }
      })
    );
    return response.text || "";
  }

  async detectChapters(segments: string[]): Promise<{ title: string; startIndex: number }[]> {
    if (segments.length < 5) return [{ title: 'Main Content', startIndex: 0 }];
    const sampleSize = Math.min(segments.length, 800); 
    const sample = segments.slice(0, sampleSize)
      .map((s, i) => `[idx:${i}] ${s.slice(0, 100)}`)
      .join('\n');

    try {
      const response = await this.callWithRetry<GenerateContentResponse>(() =>
        this.ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `SYSTEM: Identify structural chapter starts. Return ONLY JSON array of objects with "title" and "startIndex".
          
          Segments:
          ${sample}`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  startIndex: { type: Type.INTEGER }
                },
                required: ["title", "startIndex"]
              }
            }
          }
        })
      );
      
      const chapters = JSON.parse(response.text || "[]");
      if (chapters.length === 0) return [{ title: 'Main Content', startIndex: 0 }];
      if (chapters[0].startIndex !== 0) chapters.unshift({ title: 'Beginning', startIndex: 0 });
      return chapters;
    } catch (e) {
      return [{ title: 'Start', startIndex: 0 }];
    }
  }
}

export const geminiService = new GeminiService();
