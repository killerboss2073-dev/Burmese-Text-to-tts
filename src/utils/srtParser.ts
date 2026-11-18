import { SubtitleTwoLineCue } from '../types';

/**
 * Splits text into 2 balanced lines for movie / video subtitle formatting (စာတန်းထိုး မျဉ်း ၂ ကြောင်း)
 */
export function splitTextIntoTwoLines(text: string): { line1: string; line2?: string; formatted: string } {
  const clean = text.trim().replace(/\r?\n/g, ' ');
  if (!clean) return { line1: '', formatted: '' };

  // If text is short (under ~22 characters), it can fit in 1 line
  if (clean.length <= 22) {
    return { line1: clean, formatted: clean };
  }

  // 1. Check for Myanmar comma '၊' near middle
  const commaIdx = clean.indexOf('၊');
  if (commaIdx >= 8 && commaIdx <= clean.length - 8) {
    const l1 = clean.slice(0, commaIdx + 1).trim();
    const l2 = clean.slice(commaIdx + 1).trim();
    return { line1: l1, line2: l2, formatted: `${l1}\n${l2}` };
  }

  // 2. Check for whitespace closest to midpoint
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
    const l1 = clean.slice(0, closestSpace).trim();
    const l2 = clean.slice(closestSpace).trim();
    return { line1: l1, line2: l2, formatted: `${l1}\n${l2}` };
  }

  // 3. Fallback: split near mid
  const l1 = clean.slice(0, mid).trim();
  const l2 = clean.slice(mid).trim();
  return { line1: l1, line2: l2, formatted: `${l1}\n${l2}` };
}

/**
 * Builds standard 2-line formatted SRT from word timing events with strict non-overlapping timestamps
 */
export function buildTwoLineSrtFromWords(
  words: { text: string; start: number; end: number }[]
): { srtContent: string; cues: SubtitleTwoLineCue[] } {
  if (!words || words.length === 0) {
    return { srtContent: '', cues: [] };
  }

  // 1. Sort & deduplicate words
  const validWords = words
    .filter((w) => w && w.text && w.text.trim())
    .sort((a, b) => a.start - b.start);

  const cleanedWords: { text: string; start: number; end: number }[] = [];
  for (let i = 0; i < validWords.length; i++) {
    const curr = validWords[i];
    const prev = cleanedWords[cleanedWords.length - 1];
    if (
      prev &&
      curr.text.trim() === prev.text.trim() &&
      Math.abs(curr.start - prev.start) < 0.25
    ) {
      continue;
    }
    let start = curr.start;
    let end = Math.max(start + 0.05, curr.end);
    if (prev && start < prev.start) {
      start = prev.start + 0.05;
      end = Math.max(start + 0.05, end);
    }
    cleanedWords.push({ text: curr.text.trim(), start, end });
  }

  const rawCues: { start: number; end: number; fullText: string; line1: string; line2?: string }[] = [];
  let currentGroup: { text: string; start: number; end: number }[] = [];
  const maxGroupDuration = 4.0;
  const maxGroupChars = 44;

  const flushGroup = () => {
    if (currentGroup.length === 0) return;
    const start = currentGroup[0].start;
    const lastWord = currentGroup[currentGroup.length - 1];
    const end = Math.max(start + 0.6, lastWord.end + 0.05);
    const combinedText = currentGroup
      .map((w) => w.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const split = splitTextIntoTwoLines(combinedText);

    rawCues.push({
      start,
      end,
      fullText: combinedText,
      line1: split.line1,
      line2: split.line2,
    });
    currentGroup = [];
  };

  for (let i = 0; i < cleanedWords.length; i++) {
    const w = cleanedWords[i];
    currentGroup.push(w);
    const groupDuration = currentGroup[currentGroup.length - 1].end - currentGroup[0].start;
    const groupChars = currentGroup.map((x) => x.text).join(' ').length;
    const endsWithPeriod = /[။.!?]$/.test(w.text.trim());

    if (endsWithPeriod || groupDuration >= maxGroupDuration || groupChars >= maxGroupChars) {
      flushGroup();
    }
  }
  flushGroup();

  // 2. Strict non-overlapping clamp pass: cue[i].end <= cue[i+1].start - 0.045s
  const minGap = 0.045;
  for (let i = 0; i < rawCues.length; i++) {
    if (i > 0) {
      const prev = rawCues[i - 1];
      if (rawCues[i].start <= prev.end + minGap) {
        if (rawCues[i].start - minGap > prev.start + 0.3) {
          prev.end = rawCues[i].start - minGap;
        } else {
          rawCues[i].start = prev.end + minGap;
          if (rawCues[i].end <= rawCues[i].start + 0.3) {
            rawCues[i].end = rawCues[i].start + 0.4;
          }
        }
      }
    }
    if (rawCues[i].end < rawCues[i].start + 0.35) {
      rawCues[i].end = rawCues[i].start + 0.35;
    }
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

  const cues: SubtitleTwoLineCue[] = rawCues.map((c, idx) => ({
    index: idx + 1,
    startTime: parseFloat(c.start.toFixed(3)),
    endTime: parseFloat(c.end.toFixed(3)),
    startTimeStr: formatSecondsToSrtTime(c.start),
    endTimeStr: formatSecondsToSrtTime(c.end),
    line1: c.line1,
    line2: c.line2,
    fullText: c.fullText,
  }));

  const srtContent = cues
    .map(
      (c) =>
        `${c.index}\r\n${c.startTimeStr} --> ${c.endTimeStr}\r\n${c.line1}${c.line2 ? '\r\n' + c.line2 : ''}\r\n`
    )
    .join('\r\n');

  return { srtContent, cues };
}

/**
 * Parses any SRT string into 2-line SubtitleTwoLineCue objects
 */
export function parseTwoLineCuesFromSrt(srtContent: string): SubtitleTwoLineCue[] {
  const parsed = parseSrtFile(srtContent);
  return parsed.map((item) => {
    const split = splitTextIntoTwoLines(item.text);
    return {
      index: item.index,
      startTime: item.startTime,
      endTime: item.endTime,
      startTimeStr: item.startTimeStr,
      endTimeStr: item.endTimeStr,
      line1: split.line1,
      line2: split.line2,
      fullText: item.text,
    };
  });
}

export function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().replace('.', ',');
  const parts = clean.split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const secParts = parts[2].split(',');
    const seconds = parseFloat(secParts[0]) || 0;
    const ms = secParts[1] ? parseFloat(secParts[1].padEnd(3, '0').slice(0, 3)) : 0;
    return hours * 3600 + minutes * 60 + seconds + ms / 1000;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const secParts = parts[1].split(',');
    const seconds = parseFloat(secParts[0]) || 0;
    const ms = secParts[1] ? parseFloat(secParts[1].padEnd(3, '0').slice(0, 3)) : 0;
    return minutes * 60 + seconds + ms / 1000;
  }
  return 0;
}

export function formatSecondsToSrtTime(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds % 1) * 1000);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(ms, 3)}`;
}

export function formatSecondsToDisplay(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds % 1) * 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(minutes)}:${pad(seconds)}.${ms}`;
}

export interface ParsedSrtItem {
  index: number;
  startTime: number;
  endTime: number;
  startTimeStr: string;
  endTimeStr: string;
  text: string;
}

/**
 * Ultra-robust SRT parser:
 * - Strips UTF-8 BOM (\uFEFF)
 * - Tolerates Windows \r\n, Mac \r, and Unix \n
 * - Supports both comma (00:00:00,000) and dot (00:00:00.000)
 * - Strips WebVTT header or stray metadata
 * - Cleans HTML tags like <i>, <b>, <font>
 * - Tolerates missing numeric indices or malformed empty lines
 */
export function parseSrtFile(rawContent: string): ParsedSrtItem[] {
  if (!rawContent || !rawContent.trim()) return [];

  // 1. Remove UTF-8 BOM and clean whitespace
  let cleanText = rawContent.replace(/^\uFEFF/, '').trim();

  // 2. Remove WEBVTT header if user imported a VTT file
  cleanText = cleanText.replace(/^WEBVTT[^\n]*\n+/i, '');

  // 3. Normalize all line breaks to \n
  const normalized = cleanText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 4. Regex pattern matching SRT / VTT cue headers:
  // e.g. "00:01:23,456 --> 00:01:25,789" or "01:23.456 --> 01:25.789"
  const timeRegex = /((?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{1,3})/;

  // Split into blocks by double newline (or flexible blank lines)
  const blocks = normalized.split(/\n\s*\n+/);
  const result: ParsedSrtItem[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let timeLineIdx = -1;
    let match: RegExpMatchArray | null = null;

    for (let i = 0; i < lines.length; i++) {
      match = lines[i].match(timeRegex);
      if (match) {
        timeLineIdx = i;
        break;
      }
    }

    if (timeLineIdx === -1 || !match) {
      continue;
    }

    const startStr = match[1];
    const endStr = match[2];
    const startTime = parseTimeToSeconds(startStr);
    const endTime = parseTimeToSeconds(endStr);

    // Text lines are everything after the timestamp line
    const textLines = lines.slice(timeLineIdx + 1);
    // Strip HTML tags like <i>, </i>, <font color="...">, etc.
    const cleanSubtitle = textLines
      .join('\n')
      .replace(/<[^>]*>/g, '')
      .trim();

    if (cleanSubtitle) {
      result.push({
        index: result.length + 1,
        startTime,
        endTime,
        startTimeStr: formatSecondsToSrtTime(startTime),
        endTimeStr: formatSecondsToSrtTime(endTime),
        text: cleanSubtitle,
      });
    }
  }

  // Fallback: If block-based split yielded nothing, run global regex across full text
  if (result.length === 0) {
    const globalRegex = /(?:(\d+)\n)?((?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{1,3})\n([\s\S]*?)(?=(?:\n\d+\n(?:\d{1,2}:)?\d{1,2}:\d{2})|(?:\n(?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{1,3}\s*-->)|$)/g;
    let m;
    while ((m = globalRegex.exec(normalized)) !== null) {
      const startStr = m[2];
      const endStr = m[3];
      const txt = m[4].replace(/<[^>]*>/g, '').trim();
      if (txt) {
        const startTime = parseTimeToSeconds(startStr);
        const endTime = parseTimeToSeconds(endStr);
        result.push({
          index: result.length + 1,
          startTime,
          endTime,
          startTimeStr: formatSecondsToSrtTime(startTime),
          endTimeStr: formatSecondsToSrtTime(endTime),
          text: txt,
        });
      }
    }
  }

  // Strictly sanitize all parsed cues so NO cues overlap in time
  return sanitizeParsedSrtItems(result);
}

/**
 * Strict non-overlapping sanitization for SRT cue lists:
 * - Chronologically sorts cues
 * - Deduplicates consecutive repeated words/text
 * - Clamps every cue's end time so: cue[i].endTime <= cue[i+1].startTime - 0.045s
 * - Prevents on-screen subtitle collision in video editors and web players
 */
export function sanitizeParsedSrtItems(items: ParsedSrtItem[]): ParsedSrtItem[] {
  if (!items || items.length === 0) return [];

  // 1. Sort strictly by start time
  const sorted = [...items]
    .filter((item) => item && item.text && item.text.trim())
    .sort((a, b) => a.startTime - b.startTime);

  if (sorted.length === 0) return [];

  // 2. Remove duplicate consecutive cues
  const deduped: ParsedSrtItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    const prev = deduped[deduped.length - 1];
    if (
      prev &&
      curr.text.trim() === prev.text.trim() &&
      Math.abs(curr.startTime - prev.startTime) < 0.25
    ) {
      continue;
    }
    deduped.push({ ...curr });
  }

  // 3. Strict non-overlapping clamp pass
  const minGap = 0.045; // 45ms gap between cues
  for (let i = 0; i < deduped.length; i++) {
    // If not first cue, clamp with previous cue
    if (i > 0) {
      const prev = deduped[i - 1];
      if (deduped[i].startTime <= prev.endTime + minGap) {
        if (deduped[i].startTime - minGap > prev.startTime + 0.3) {
          prev.endTime = deduped[i].startTime - minGap;
        } else {
          deduped[i].startTime = prev.endTime + minGap;
          if (deduped[i].endTime <= deduped[i].startTime + 0.3) {
            deduped[i].endTime = deduped[i].startTime + 0.4;
          }
        }
      }
    }

    // Minimum reasonable duration (at least 0.35s)
    if (deduped[i].endTime < deduped[i].startTime + 0.35) {
      deduped[i].endTime = deduped[i].startTime + 0.35;
    }

    // Check with next cue ahead
    if (i < deduped.length - 1) {
      const next = deduped[i + 1];
      if (deduped[i].endTime >= next.startTime - minGap) {
        if (next.startTime - minGap > deduped[i].startTime + 0.35) {
          deduped[i].endTime = next.startTime - minGap;
        } else {
          deduped[i].endTime = deduped[i].startTime + 0.35;
          next.startTime = deduped[i].endTime + minGap;
        }
      }
    }

    // Refresh index and formatted strings
    deduped[i].index = i + 1;
    deduped[i].startTimeStr = formatSecondsToSrtTime(deduped[i].startTime);
    deduped[i].endTimeStr = formatSecondsToSrtTime(deduped[i].endTime);
  }

  return deduped;
}

/**
 * Downloads valid UTF-8 BOM standard SRT file
 */
export function downloadStandardSrt(content: string, filename: string): void {
  // Ensure lines end in \r\n and blocks separated by \r\n\r\n
  const normalized = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  const formattedBlocks = normalized
    .split(/\n\s*\n/)
    .map((block) => block.trim().replace(/\n/g, '\r\n'))
    .join('\r\n\r\n');

  // Prepend \uFEFF UTF-8 Byte Order Mark so all players (VLC, CapCut, Windows, Premiere) recognize Burmese text perfectly
  const blob = new Blob(['\uFEFF' + formattedBlocks + '\r\n'], {
    type: 'application/x-subrip;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.srt') ? filename : `${filename}.srt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
