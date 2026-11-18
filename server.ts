import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export const PRESET_VOICES: VoicePreset[] = [
  {
    id: 'giuseppe',
    name: 'Giuseppe Fast Vibe ⚡',
    characterName: 'မောင်ကျော်သူ',
    voiceName: 'it-IT-GiuseppeMultilingualNeural',
    locale: 'it-IT (Multilingual)',
    defaultSpeed: 1.3,
    rateStr: '+30%',
    description: 'ရယ်မောပျော်ရွှင်ဖွယ် သွက်လက်သောအသံ',
    category: 'Comedy / Energetic',
    badge: '⚡ Speed 1.3',
    sampleText: 'ဟေး အားလုံးပဲ မင်္ဂလာပါဗျာ၊ ဒီနေ့မှာတော့ ရယ်မောပျော်ရွှင်စရာ အလန်းစားဇာတ်ကားလေးတစ်ကားကို အတူတူ ကြည့်ကြရအောင်ခင်ဗျာ။',
  },
  {
    id: 'remy',
    name: 'Remy Fast Reviewer ⚡',
    characterName: 'မောင်သုတ',
    voiceName: 'fr-FR-RemyMultilingualNeural',
    locale: 'fr-FR (Multilingual)',
    defaultSpeed: 1.3,
    rateStr: '+30%',
    description: 'ဗဟုသုတနှင့် ထုတ်ကုန်များ သွက်လက်စွာ ရှင်းပြသံ',
    category: 'Review / Knowledge',
    badge: '⚡ Speed 1.3',
    sampleText: 'ဒီကိရိယာရဲ့ ထူးခြားချက်တွေနဲ့ ဘယ်လိုနည်းပညာတွေ သုံးထားတယ်ဆိုတာကို အသေးစိတ် သွက်သွက်လက်လက် ရှင်းပြပေးသွားမှာ ဖြစ်ပါတယ်။',
  },
  {
    id: 'ava',
    name: 'Ava Fast Narrator ⚡',
    characterName: 'မဆုမြတ်',
    voiceName: 'en-US-AvaMultilingualNeural',
    locale: 'en-US (Multilingual)',
    defaultSpeed: 1.3,
    rateStr: '+30%',
    description: 'သွက်လက်ကြည်လင်သော ဇာတ်လမ်းသုံးသပ်သံ (Speed 1.3)',
    category: 'Story Recap / Clear Female',
    badge: '⚡ Speed 1.3',
    sampleText: 'ဇာတ်လမ်းရဲ့ အစမှာတော့ မထင်မှတ်ထားတဲ့ အဖြစ်အပျက်တစ်ခု ဖြစ်ပွားခဲ့ပြီး ဇာတ်ကောင်တွေရဲ့ ဘဝက တစ်ဆစ်ချိုး ပြောင်းလဲသွားခဲ့ရပါတော့တယ်။',
  },
  {
    id: 'brian',
    name: 'Brian Hyper Epic ⚡',
    characterName: 'ကိုအောင်ကျော်',
    voiceName: 'en-US-BrianMultilingualNeural',
    locale: 'en-US (Multilingual)',
    defaultSpeed: 1.6,
    rateStr: '+60%',
    description: 'စိတ်လှုပ်ရှားဖွယ် အမြန်ဇာတ်လမ်းပြောသံ (Speed 1.6)',
    category: 'Epic Hyper / Action',
    badge: '⚡ Speed 1.6',
    sampleText: 'ချက်ချင်းပဲ ရန်သူတွေ ဝိုင်းရံထားတဲ့ကြားကနေ သူ ဘယ်လိုမှ မထင်မှတ်ထားတဲ့ အစီအစဉ်တစ်ခုကို အမြန်ဆုံး အကောင်အထည်ဖော်လိုက်ပါတော့တယ်!',
  },
];

interface WordTiming {
  text: string;
  start: number;
  end: number;
}

function formatSecondsToSrtTime(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds % 1) * 1000);
  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(ms, 3)}`;
}

// Split text into 2 balanced lines (မျဉ်း ၂ ကြောင်း)
function splitTextIntoTwoLines(text: string): string {
  const clean = text.trim().replace(/\r?\n/g, ' ');
  if (clean.length <= 22) return clean;

  const commaIdx = clean.indexOf('၊');
  if (commaIdx >= 8 && commaIdx <= clean.length - 8) {
    return clean.slice(0, commaIdx + 1).trim() + '\n' + clean.slice(commaIdx + 1).trim();
  }

  const mid = Math.floor(clean.length / 2);
  const spaces: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === ' ') spaces.push(i);
  }

  if (spaces.length > 0) {
    let closestSpace = spaces[0];
    let minDiff = Math.abs(closestSpace - mid);
    for (const s of spaces) {
      if (Math.abs(s - mid) < minDiff) {
        minDiff = Math.abs(s - mid);
        closestSpace = s;
      }
    }
    return clean.slice(0, closestSpace).trim() + '\n' + clean.slice(closestSpace).trim();
  }

  return clean.slice(0, mid).trim() + '\n' + clean.slice(mid).trim();
}

// Build standard 2-line formatted SRT from WordTiming events with strict non-overlapping timestamps
function generateTwoLineSrt(words: WordTiming[]): string {
  if (!words || words.length === 0) return '';

  // 1. Clean and sort words by start time
  const validWords = words
    .filter((w) => w && w.text && w.text.trim())
    .sort((a, b) => a.start - b.start);

  if (validWords.length === 0) return '';

  // 2. Remove duplicate consecutive words and clamp overlapping word timings
  const cleanedWords: WordTiming[] = [];
  for (let i = 0; i < validWords.length; i++) {
    const curr = validWords[i];
    const prev = cleanedWords[cleanedWords.length - 1];

    // Skip duplicate word boundary events from TTS metadata
    if (
      prev &&
      curr.text.trim() === prev.text.trim() &&
      Math.abs(curr.start - prev.start) < 0.25
    ) {
      continue;
    }

    // Clamp word start so it never begins before previous word starts
    let start = curr.start;
    let end = Math.max(start + 0.05, curr.end);

    if (prev && start < prev.start) {
      start = prev.start + 0.05;
      end = Math.max(start + 0.05, end);
    }

    cleanedWords.push({
      text: curr.text.trim(),
      start,
      end,
    });
  }

  // 3. Group words into natural 2-line subtitle chunks
  interface RawCue {
    start: number;
    end: number;
    text: string;
  }
  const rawCues: RawCue[] = [];
  let currentGroup: WordTiming[] = [];
  const maxGroupDuration = 4.0;
  const maxGroupChars = 44;

  const flushGroup = () => {
    if (currentGroup.length === 0) return;
    const start = currentGroup[0].start;
    const lastWord = currentGroup[currentGroup.length - 1];
    const end = Math.max(start + 0.6, lastWord.end + 0.05);

    // Combine words with clean spacing (deduplicate extra spaces)
    const combinedText = currentGroup
      .map((w) => w.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const twoLines = splitTextIntoTwoLines(combinedText);

    rawCues.push({
      start,
      end,
      text: twoLines,
    });
    currentGroup = [];
  };

  for (let i = 0; i < cleanedWords.length; i++) {
    const w = cleanedWords[i];
    currentGroup.push(w);
    const groupDuration = currentGroup[currentGroup.length - 1].end - currentGroup[0].start;
    const groupChars = currentGroup.map((x) => x.text).join(' ').length;
    const isSentenceEnd = /[။.!?]$/.test(w.text.trim());

    if (isSentenceEnd || groupDuration >= maxGroupDuration || groupChars >= maxGroupChars) {
      flushGroup();
    }
  }
  flushGroup();

  if (rawCues.length === 0) return '';

  // 4. STRICT NON-OVERLAPPING SANITIZATION PASS:
  // Guarantees cue[i].end <= cue[i+1].start - 0.04s across all cues!
  // No subtitle text will ever overlap or collide with another on-screen.
  const minGap = 0.045; // 45ms gap between cues
  for (let i = 0; i < rawCues.length; i++) {
    // If not first cue, ensure it starts strictly after previous cue ended
    if (i > 0) {
      const prev = rawCues[i - 1];
      if (rawCues[i].start <= prev.end + minGap) {
        // Clamp previous cue's end time so it ends before current cue starts
        if (rawCues[i].start - minGap > prev.start + 0.3) {
          prev.end = rawCues[i].start - minGap;
        } else {
          // If previous cue would become too short, shift current cue forward
          rawCues[i].start = prev.end + minGap;
          if (rawCues[i].end <= rawCues[i].start + 0.3) {
            rawCues[i].end = rawCues[i].start + 0.4;
          }
        }
      }
    }

    // Ensure this cue has a reasonable minimum duration (at least 0.4s)
    if (rawCues[i].end < rawCues[i].start + 0.35) {
      rawCues[i].end = rawCues[i].start + 0.35;
    }

    // Check with next cue ahead to guarantee no forward collision
    if (i < rawCues.length - 1) {
      const next = rawCues[i + 1];
      if (rawCues[i].end >= next.start - minGap) {
        if (next.start - minGap > rawCues[i].start + 0.35) {
          rawCues[i].end = next.start - minGap;
        } else {
          rawCues[i].end = rawCues[i].start + 0.35;
          next.start = rawCues[i].end + minGap;
        }
      }
    }
  }

  // 5. Output cleanly formatted standard SRT
  return rawCues
    .map((c, idx) => {
      const startStr = formatSecondsToSrtTime(c.start);
      const endStr = formatSecondsToSrtTime(c.end);
      return `${idx + 1}\r\n${startStr} --> ${endStr}\r\n${c.text.replace(/\r?\n/g, '\r\n')}\r\n`;
    })
    .join('\r\n');
}

// Helper to synthesize a single piece of text with Edge TTS & extract word timing metadata
async function synthesizeTextChunk(
  text: string,
  voiceName: string,
  rateString: string,
  pitchString?: string,
  timeOffsetSeconds = 0
): Promise<{ buffer: Buffer; words: WordTiming[]; duration: number }> {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
      sentenceBoundaryEnabled: true,
      wordBoundaryEnabled: true,
    });

    const { audioStream, metadataStream } = tts.toStream(text, {
      rate: rateString,
      pitch: pitchString || '+0Hz',
    });

    const chunks: Buffer[] = [];
    const words: WordTiming[] = [];

    if (metadataStream) {
      metadataStream.on('data', (data: Buffer) => {
        try {
          const json = JSON.parse(data.toString());
          if (json.Metadata && Array.isArray(json.Metadata)) {
            for (const item of json.Metadata) {
              if (item.Type === 'WordBoundary' && item.Data?.text?.Text) {
                const startSec = item.Data.Offset / 10000000 + timeOffsetSeconds;
                const durSec = item.Data.Duration / 10000000;
                words.push({
                  text: item.Data.text.Text,
                  start: parseFloat(startSec.toFixed(3)),
                  end: parseFloat((startSec + durSec).toFixed(3)),
                });
              }
            }
          }
        } catch (e) {}
      });
    }

    const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
      let isSettled = false;
      let lastDataTime = Date.now();

      // Check for streaming stalls (no data for 25s)
      const stallCheck = setInterval(() => {
        if (!isSettled && Date.now() - lastDataTime > 25000) {
          cleanup();
          reject(new Error('Edge TTS audio stream stalled (no data received for 25 seconds).'));
        }
      }, 2000);

      // Hard max timeout safety (65 seconds)
      const maxTimer = setTimeout(() => {
        if (!isSettled) {
          cleanup();
          reject(new Error('Edge TTS audio stream timed out after 65 seconds.'));
        }
      }, 65000);

      const cleanup = () => {
        isSettled = true;
        clearInterval(stallCheck);
        clearTimeout(maxTimer);
        try {
          tts.close();
        } catch (e) {}
      };

      audioStream.on('data', (chunk: Buffer) => {
        lastDataTime = Date.now();
        chunks.push(chunk);
      });

      audioStream.on('end', () => {
        if (!isSettled) {
          cleanup();
          resolve(Buffer.concat(chunks));
        }
      });

      audioStream.on('error', (err) => {
        if (!isSettled) {
          cleanup();
          reject(err);
        }
      });
    });

    // Approximate audio duration: 24kHz mono mp3 48kbps = 6000 bytes per second
    const estimatedDuration = audioBuffer.length / 6000;
    const actualDuration =
      words.length > 0 ? Math.max(words[words.length - 1].end - timeOffsetSeconds, estimatedDuration) : estimatedDuration;

    return {
      buffer: audioBuffer,
      words,
      duration: actualDuration,
    };
  } catch (err) {
    try {
      tts.close();
    } catch (e) {}
    throw err;
  }
}

// Resilient wrapper with automatic retry and auto-subdivision for individual chunks
async function synthesizeTextChunkWithRetry(
  text: string,
  voiceName: string,
  rateString: string,
  pitchString?: string,
  timeOffsetSeconds = 0
): Promise<{ buffer: Buffer; words: WordTiming[]; duration: number }> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await synthesizeTextChunk(text, voiceName, rateString, pitchString, timeOffsetSeconds);
    } catch (err: any) {
      lastError = err;
      console.warn(`[EdgeTTS] Chunk attempt ${attempt} failed (${text.length} chars):`, err.message);

      // If chunk is larger than 250 chars and failed, automatically split it into two halves and synthesize
      if (text.length > 250) {
        try {
          console.log(`[EdgeTTS] Auto-subdividing failed chunk of ${text.length} chars into two smaller pieces...`);
          const mid = Math.floor(text.length / 2);
          const puncMatch = text.slice(Math.max(0, mid - 70), Math.min(text.length, mid + 70)).search(/[၊။\s\n,]/);
          const splitIdx = puncMatch !== -1 ? Math.max(0, mid - 70) + puncMatch + 1 : mid;
          const partA = text.slice(0, splitIdx).trim();
          const partB = text.slice(splitIdx).trim();

          if (partA && partB) {
            const resA = await synthesizeTextChunk(partA, voiceName, rateString, pitchString, timeOffsetSeconds);
            const partADur = resA.duration;
            const resB = await synthesizeTextChunk(partB, voiceName, rateString, pitchString, timeOffsetSeconds + partADur);
            return {
              buffer: Buffer.concat([resA.buffer, resB.buffer]),
              words: [...resA.words, ...resB.words],
              duration: partADur + resB.duration,
            };
          }
        } catch (subErr: any) {
          console.warn('[EdgeTTS] Subdivision attempt failed:', subErr.message);
        }
      }

      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }

  throw lastError;
}

// Split text into manageable chunks (optimal 350 - 400 chars) for ultra-reliable Edge TTS streaming
function splitTextIntoChunks(text: string, maxChunkLength = 380): string[] {
  const clean = text.trim();
  if (clean.length <= maxChunkLength) return [clean];

  const sentences = clean.split(/(?<=[။\n\.!\?])/g);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if (!sentence.trim()) continue;

    if ((currentChunk + sentence).length <= maxChunkLength) {
      currentChunk += sentence;
    } else {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      if (sentence.length <= maxChunkLength) {
        currentChunk = sentence;
      } else {
        // Long sentence without sentence-ending punctuation: split by commas or spaces
        const subParts = sentence.split(/(?<=[,၊\s])/g);
        for (const part of subParts) {
          if (!part.trim()) continue;
          if ((currentChunk + part).length <= maxChunkLength) {
            currentChunk += part;
          } else {
            if (currentChunk.trim()) {
              chunks.push(currentChunk.trim());
              currentChunk = '';
            }
            if (part.length <= maxChunkLength) {
              currentChunk = part;
            } else {
              // Forced slice for continuous strings without spaces/punctuations
              for (let i = 0; i < part.length; i += maxChunkLength) {
                const slice = part.slice(i, i + maxChunkLength);
                if (slice.trim()) chunks.push(slice.trim());
              }
            }
          }
        }
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [clean];
}

// In-memory cache for generated 2-line SRT files (avoids 8KB HTTP Header Overflow on long scripts)
const srtCache = new Map<string, { srt: string; createdAt: number }>();

interface TtsTask {
  id: string;
  status: 'processing' | 'completed' | 'error';
  percent: number;
  stageName: string;
  detailMessage: string;
  audioBuffer?: Buffer;
  srtContent?: string;
  srtId?: string;
  error?: string;
  createdAt: number;
}

const ttsTaskMap = new Map<string, TtsTask>();

setInterval(() => {
  const now = Date.now();
  for (const [id, item] of srtCache.entries()) {
    if (now - item.createdAt > 30 * 60 * 1000) {
      srtCache.delete(id);
    }
  }
  for (const [id, task] of ttsTaskMap.entries()) {
    if (now - task.createdAt > 30 * 60 * 1000) {
      ttsTaskMap.delete(id);
    }
  }
}, 10 * 60 * 1000);

async function runBackgroundTtsTask(
  task: TtsTask,
  params: { text: string; voiceId?: string; voiceName?: string; speed?: number; pitch?: string }
) {
  try {
    task.percent = 3;
    task.stageName = '၁. စာသားစစ်ဆေးခြင်းနှင့် ကြိုတင်ပြင်ဆင်ခြင်း';
    task.detailMessage = 'စာသားစစ်ဆေးနေပါသည်... (၃%)';

    let selectedVoiceName = 'it-IT-GiuseppeMultilingualNeural';
    let speedMultiplier = 1.3;

    if (params.voiceId) {
      const found = PRESET_VOICES.find((v) => v.id === params.voiceId);
      if (found) {
        selectedVoiceName = found.voiceName;
        speedMultiplier = found.defaultSpeed;
      }
    } else if (params.voiceName) {
      selectedVoiceName = params.voiceName;
    }

    if (typeof params.speed === 'number' && !isNaN(params.speed) && params.speed > 0.4 && params.speed <= 3.0) {
      speedMultiplier = params.speed;
    }

    const diffPercent = Math.round((speedMultiplier - 1.0) * 100);
    const rateString = diffPercent >= 0 ? `+${diffPercent}%` : `${diffPercent}%`;
    const pitchString = params.pitch || '+0Hz';

    task.percent = 8;
    task.detailMessage = 'စာသားများကို အပိုင်းခွဲထုတ်နေပါသည်... (၈%)';

    const chunks = splitTextIntoChunks(params.text, 380);
    const totalChunks = chunks.length;
    const audioBuffers: Buffer[] = [];
    const allWords: WordTiming[] = [];
    let cumulativeTime = 0;

    task.stageName = '၂. Microsoft Edge Neural Cloud အသံလှိုင်း ဖန်တီးခြင်း';

    for (let i = 0; i < totalChunks; i++) {
      const chunk = chunks[i];
      if (!chunk.trim()) continue;

      const chunkStartPercent = Math.round(10 + (i / totalChunks) * 75);
      const chunkEndPercent = Math.round(10 + ((i + 1) / totalChunks) * 75);

      task.percent = chunkStartPercent;
      task.detailMessage = totalChunks > 1
        ? `အပိုင်း ${i + 1}/${totalChunks} အသံလှိုင်း ဖန်တီးနေပါသည်... (${chunkStartPercent}%)`
        : `အသံထွက် မြန်နှုန်း ${speedMultiplier}x ဖြင့် အသံလှိုင်း ဖန်တီးနေပါသည်... (${chunkStartPercent}%)`;

      const resChunk = await synthesizeTextChunkWithRetry(
        chunk,
        selectedVoiceName,
        rateString,
        pitchString,
        cumulativeTime
      );

      audioBuffers.push(resChunk.buffer);
      allWords.push(...resChunk.words);
      const lastWordEnd = resChunk.words.length > 0 ? resChunk.words[resChunk.words.length - 1].end : cumulativeTime + resChunk.duration;
      cumulativeTime = Math.max(cumulativeTime + resChunk.duration, lastWordEnd + 0.08);

      task.percent = chunkEndPercent;
    }

    task.stageName = '၃. မျဉ်း ၂ ကြောင်း စာတန်းထိုး (SRT) ပေါင်းစပ်ခြင်း';
    task.percent = 88;
    task.detailMessage = 'မျဉ်း ၂ ကြောင်း စာတန်းထိုး (SRT) တွက်ချက်နေပါသည်... (၈၈%)';

    const finalAudio = Buffer.concat(audioBuffers);
    const srtContent = generateTwoLineSrt(allWords);

    task.percent = 94;
    task.detailMessage = 'အသံဖိုင်နှင့် စာတန်းထိုး ပြီးစီးရန် အတည်ပြုနေပါသည်... (၉၄%)';

    const srtId = `srt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    srtCache.set(srtId, { srt: srtContent, createdAt: Date.now() });

    task.audioBuffer = finalAudio;
    task.srtContent = srtContent;
    task.srtId = srtId;
    task.percent = 100;
    task.status = 'completed';
    task.stageName = 'ပြီးစီးပါပြီ';
    task.detailMessage = 'အသံဖိုင်နှင့် မျဉ်း ၂ ကြောင်း စာတန်းထိုး အောင်မြင်စွာ ထုတ်လုပ်ပြီးပါပြီ! (၁၀၀%)';
  } catch (err: any) {
    console.error(`[TtsTask ${task.id}] Error:`, err);
    task.status = 'error';
    task.error = err.message || 'Failed to synthesize speech.';
    task.detailMessage = `အမှားဖြစ်ပေါ်ပါသည်: ${task.error}`;
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '300mb' }));
  app.use(express.urlencoded({ extended: true, limit: '300mb' }));

  // API Route: List Voices
  app.get('/api/tts/voices', (_req: Request, res: Response) => {
    res.json({
      success: true,
      voices: PRESET_VOICES,
    });
  });

  // API Route: Retrieve 2-line SRT by ID (for long scripts where SRT exceeds 8KB HTTP Header limit)
  app.get('/api/tts/srt/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const item = srtCache.get(id);
    if (!item) {
      res.status(404).json({ error: 'SRT content not found or expired.' });
      return;
    }
    res.json({ success: true, srtContent: item.srt });
  });

  // API Route: Start background TTS task with real 1% - 100% progress tracking
  app.post('/api/tts/start-task', (req: Request, res: Response): void => {
    const { text, voiceId, voiceName, speed, pitch } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Text is required for TTS synthesis.' });
      return;
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const task: TtsTask = {
      id: taskId,
      status: 'processing',
      percent: 2,
      stageName: '၁. စာသားစစ်ဆေးခြင်းနှင့် ကြိုတင်ပြင်ဆင်ခြင်း',
      detailMessage: 'စာသားနှင့် အသံလှိုင်း အင်ဂျင် ချိတ်ဆက်နေပါသည်... (၂%)',
      createdAt: Date.now(),
    };
    ttsTaskMap.set(taskId, task);

    // Run asynchronously in background
    runBackgroundTtsTask(task, { text, voiceId, voiceName, speed, pitch });

    res.json({ success: true, taskId });
  });

  // API Route: Poll status of background TTS task with live percentage
  app.get('/api/tts/task-status/:taskId', (req: Request, res: Response): void => {
    const { taskId } = req.params;
    const task = ttsTaskMap.get(taskId);
    if (!task) {
      res.status(404).json({ error: 'Task not found or expired.' });
      return;
    }

    res.json({
      success: true,
      status: task.status,
      percent: task.percent,
      stageName: task.stageName,
      detailMessage: task.detailMessage,
      srtId: task.srtId,
      srtContent: task.srtContent,
      error: task.error,
    });
  });

  // API Route: Retrieve generated audio buffer for completed task
  app.get('/api/tts/task-audio/:taskId', (req: Request, res: Response): void => {
    const { taskId } = req.params;
    const task = ttsTaskMap.get(taskId);
    if (!task || !task.audioBuffer) {
      res.status(404).json({ error: 'Audio not ready or expired.' });
      return;
    }

    const base64Srt = task.srtContent ? Buffer.from(task.srtContent, 'utf-8').toString('base64') : '';

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', task.audioBuffer.length.toString());
    res.setHeader('Content-Disposition', 'inline; filename="edge_tts_voice.mp3"');
    if (task.srtId) res.setHeader('X-SRT-Id', task.srtId);
    if (base64Srt && base64Srt.length < 3500) {
      res.setHeader('X-SRT-Base64', base64Srt);
    }
    res.setHeader('Access-Control-Expose-Headers', 'X-SRT-Id, X-SRT-Base64, Content-Disposition, Content-Length');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(task.audioBuffer);
  });

  // API Route: Generate Sound via Microsoft Edge TTS with synchronized 2-line SRT
  app.post('/api/tts/generate', async (req: Request, res: Response): Promise<void> => {
    try {
      const { text, voiceId, voiceName, speed, pitch } = req.body;

      if (!text || typeof text !== 'string' || !text.trim()) {
        res.status(400).json({ error: 'Text is required for TTS synthesis.' });
        return;
      }

      let selectedVoiceName = 'it-IT-GiuseppeMultilingualNeural';
      let speedMultiplier = 1.3;

      if (voiceId) {
        const found = PRESET_VOICES.find((v) => v.id === voiceId);
        if (found) {
          selectedVoiceName = found.voiceName;
          speedMultiplier = found.defaultSpeed;
        }
      } else if (voiceName) {
        selectedVoiceName = voiceName;
      }

      if (typeof speed === 'number' && !isNaN(speed) && speed > 0.4 && speed <= 3.0) {
        speedMultiplier = speed;
      }

      const diffPercent = Math.round((speedMultiplier - 1.0) * 100);
      const rateString = diffPercent >= 0 ? `+${diffPercent}%` : `${diffPercent}%`;
      const pitchString = pitch || '+0Hz';

      const chunks = splitTextIntoChunks(text, 380);
      const audioBuffers: Buffer[] = [];
      const allWords: WordTiming[] = [];
      let cumulativeTime = 0;

      for (const chunk of chunks) {
        if (!chunk.trim()) continue;
        const resChunk = await synthesizeTextChunkWithRetry(chunk, selectedVoiceName, rateString, pitchString, cumulativeTime);
        audioBuffers.push(resChunk.buffer);
        allWords.push(...resChunk.words);
        const lastWordEnd = resChunk.words.length > 0 ? resChunk.words[resChunk.words.length - 1].end : cumulativeTime + resChunk.duration;
        cumulativeTime = Math.max(cumulativeTime + resChunk.duration, lastWordEnd + 0.08);
      }

      const finalAudio = Buffer.concat(audioBuffers);
      const srtContent = generateTwoLineSrt(allWords);

      const srtId = `srt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      srtCache.set(srtId, { srt: srtContent, createdAt: Date.now() });

      const base64Srt = Buffer.from(srtContent, 'utf-8').toString('base64');

      // Return MP3 audio
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', finalAudio.length.toString());
      res.setHeader('Content-Disposition', 'inline; filename="edge_tts_voice.mp3"');
      res.setHeader('X-SRT-Id', srtId);

      // CRITICAL: Only set X-SRT-Base64 if safely under 3.5KB (prevents Cloud Run 502 / Header Overflow crash on long texts!)
      if (base64Srt.length < 3500) {
        res.setHeader('X-SRT-Base64', base64Srt);
      }
      res.setHeader('Access-Control-Expose-Headers', 'X-SRT-Id, X-SRT-Base64, Content-Disposition, Content-Length');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(finalAudio);
    } catch (error: any) {
      console.error('Edge TTS generation error:', error);
      res.status(500).json({
        error: error?.message || 'Failed to synthesize speech using Microsoft Edge TTS.',
      });
    }
  });

  // API Route: JSON endpoint for speech + 2-line SRT
  app.post('/api/tts/generate-with-srt', async (req: Request, res: Response): Promise<void> => {
    try {
      const { text, voiceId, voiceName, speed, pitch } = req.body;

      if (!text || typeof text !== 'string' || !text.trim()) {
        res.status(400).json({ error: 'Text is required.' });
        return;
      }

      let selectedVoiceName = 'it-IT-GiuseppeMultilingualNeural';
      let speedMultiplier = 1.3;

      if (voiceId) {
        const found = PRESET_VOICES.find((v) => v.id === voiceId);
        if (found) {
          selectedVoiceName = found.voiceName;
          speedMultiplier = found.defaultSpeed;
        }
      } else if (voiceName) {
        selectedVoiceName = voiceName;
      }

      if (typeof speed === 'number' && !isNaN(speed) && speed > 0.4 && speed <= 3.0) {
        speedMultiplier = speed;
      }

      const diffPercent = Math.round((speedMultiplier - 1.0) * 100);
      const rateString = diffPercent >= 0 ? `+${diffPercent}%` : `${diffPercent}%`;
      const pitchString = pitch || '+0Hz';

      const chunks = splitTextIntoChunks(text, 380);
      const audioBuffers: Buffer[] = [];
      const allWords: WordTiming[] = [];
      let cumulativeTime = 0;

      for (const chunk of chunks) {
        if (!chunk.trim()) continue;
        const resChunk = await synthesizeTextChunkWithRetry(chunk, selectedVoiceName, rateString, pitchString, cumulativeTime);
        audioBuffers.push(resChunk.buffer);
        allWords.push(...resChunk.words);
        const lastWordEnd = resChunk.words.length > 0 ? resChunk.words[resChunk.words.length - 1].end : cumulativeTime + resChunk.duration;
        cumulativeTime = Math.max(cumulativeTime + resChunk.duration, lastWordEnd + 0.08);
      }

      const finalAudio = Buffer.concat(audioBuffers);
      const srtContent = generateTwoLineSrt(allWords);

      res.json({
        success: true,
        audioBase64: finalAudio.toString('base64'),
        srtContent,
        duration: cumulativeTime,
        wordCount: allWords.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Route: Preview sample audio for preset voice
  app.get('/api/tts/sample/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const preset = PRESET_VOICES.find((v) => v.id === id) || PRESET_VOICES[0];
      const sampleResult = await synthesizeTextChunk(preset.sampleText, preset.voiceName, preset.rateStr);

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', sampleResult.buffer.length.toString());
      res.setHeader('Content-Disposition', `inline; filename="${preset.id}_sample.mp3"`);
      res.send(sampleResult.buffer);
    } catch (error: any) {
      console.error('Sample voice preview error:', error);
      res.status(500).json({ error: error?.message || 'Failed to generate voice preview.' });
    }
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, next: any) => {
    if (err) {
      if (err.status === 413 || err.code === 'LIMIT_FILE_SIZE' || err.type === 'entity.too.large') {
        res.status(413).json({
          error: 'ဖိုင်အရွယ်အစား ကြီးမားလွန်းပါသည် (Payload Too Large).',
        });
        return;
      }
      console.error('Server unhandled error:', err);
      res.status(err.status || 500).json({ error: err.message || 'Server error occurred.' });
      return;
    }
    next();
  });

  // Serve Frontend
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ATM Movie & Edge TTS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
