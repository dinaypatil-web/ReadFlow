
import { GoogleGenAI, Modality } from "@google/genai";
import { Accent, VoiceStyle, Gender } from "../types";

// Mapping gender to prebuilt voices
const GENDER_VOICE_MAP: Record<Gender, string> = {
  'Female': 'Kore',
  'Male': 'Charon'
};

const SUPPORTED_DOC_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
];

export class GeminiService {
  private ai: GoogleGenAI;
  private ttsCache: Map<string, string> = new Map();

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  private async callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const isQuotaError = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
        if (isQuotaError && i < maxRetries - 1) {
          const waitTime = Math.pow(2, i) * 1000 + Math.random() * 1000;
          console.warn(`Quota exceeded. Retrying in ${Math.round(waitTime)}ms...`);
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

    if (this.ttsCache.has(cacheKey)) {
      return this.ttsCache.get(cacheKey)!;
    }

    const prompt = `Act as a ${gender.toLowerCase()} reader. Read the following text with a ${accent} accent in a ${style.toLowerCase()} style: "${text}"`;

    const base64Audio = await this.callWithRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!data) throw new Error("No audio data received from Gemini TTS");
      return data;
    });

    if (this.ttsCache.size > 100) {
      const firstKey = this.ttsCache.keys().next().value;
      if (firstKey !== undefined) this.ttsCache.delete(firstKey);
    }
    this.ttsCache.set(cacheKey, base64Audio);

    return base64Audio;
  }

  async extractText(base64Data: string, mimeType: string): Promise<string[]> {
    if (!SUPPORTED_DOC_TYPES.includes(mimeType)) {
      throw new Error(`Unsupported MIME type for AI extraction: ${mimeType}.`);
    }

    return this.callWithRetry(async () => {
      // Switched to gemini-3-flash-preview for fast and reliable extraction
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: "TRANSCRIPTION TASK: You are an expert document parser. Read the attached file and provide a complete, word-for-word transcription of all text found within. Do not summarize. Do not skip any pages or sections. Maintain the original reading order. If it is a PDF or image, use high-precision OCR. Output only the transcribed text, separated by natural paragraph breaks. Do not include headers, footers, or any commentary about the process." }
          ]
        }]
      });

      const fullText = response.text || "";
      const cleanedText = fullText.trim();
      
      if (!cleanedText) {
        // Log the response structure for debugging if needed
        console.warn("Gemini returned empty text for document. Candidates:", response.candidates);
        throw new Error("No text content could be extracted. The file may be image-only without recognizable text, or the AI service encountered a temporary issue.");
      }

      return this.splitIntoChunks(cleanedText);
    });
  }

  async processText(rawText: string): Promise<string[]> {
    return this.callWithRetry(async () => {
      const truncatedText = rawText.slice(0, 30000);
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{
          parts: [
            { text: `Clean and structure the following extracted book text into a list of logical sentences or paragraphs for a reader app. Ensure there are no broken lines or odd characters. Return only the cleaned content:\n\n${truncatedText}` }
          ]
        }]
      });

      const fullText = response.text || "";
      return this.splitIntoChunks(fullText);
    });
  }

  private splitIntoChunks(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  async decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number = 24000,
    numChannels: number = 1,
  ): Promise<AudioBuffer> {
    const sampleCount = Math.floor(data.byteLength / 2);
    const dataInt16 = new Int16Array(data.buffer, data.byteOffset, sampleCount);
    const frameCount = sampleCount / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
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
}

export const geminiService = new GeminiService();
