export interface VoicePreset {
  id: string;
  name: string;
  characterName: string;
  voiceName: string;
  locale: string;
  defaultSpeed: number;
  rateStr: string;
  description: string;
  category: string;
  badge: string;
  sampleText: string;
}

export interface SubtitleHistoryItem {
  id: string;
  fileName: string;
  dateStr: string;
  status: 'completed' | 'processing' | 'error';
  transcriptId?: string;
  originalSrt: string;
  file3Text: string;
}

export interface SubtitleTwoLineCue {
  index: number;
  startTime: number;
  endTime: number;
  startTimeStr: string;
  endTimeStr: string;
  line1: string;
  line2?: string;
  fullText: string;
}

export interface GeneratedAudioItem {
  id: string;
  voiceId: string;
  characterName: string;
  voiceDisplayName: string;
  speed: number;
  textSnippet: string;
  audioBlobUrl: string;
  createdAt: string;
  fileSizeFormatted: string;
  duration?: number;
  srtContent?: string;
  twoLineCues?: SubtitleTwoLineCue[];
}

