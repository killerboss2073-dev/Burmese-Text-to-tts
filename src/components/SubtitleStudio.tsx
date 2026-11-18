import React, { useState, useEffect, useRef } from 'react';
import {
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  UploadCloud,
  FileCheck,
  ShieldCheck,
  Rocket,
  Download,
  Copy,
  Sparkles,
  Volume2,
  Trash2,
} from 'lucide-react';
import { SubtitleHistoryItem } from '../types';

interface SubtitleStudioProps {
  onSendToSoundStudio: (text: string) => void;
  historyList: SubtitleHistoryItem[];
  currentHistoryId: string | null;
  onSelectHistory: (id: string) => void;
  onUpdateHistoryItem: (item: Partial<SubtitleHistoryItem> & { id: string }) => void;
  baseFileName: string;
  setBaseFileName: (name: string) => void;
  file3Text: string;
  setFile3Text: (text: string) => void;
  originalSrt: string;
  setOriginalSrt: (text: string) => void;
}

export const SubtitleStudio: React.FC<SubtitleStudioProps> = ({
  onSendToSoundStudio,
  historyList,
  currentHistoryId,
  onSelectHistory,
  onUpdateHistoryItem,
  baseFileName,
  setBaseFileName,
  file3Text,
  setFile3Text,
  originalSrt,
  setOriginalSrt,
}) => {
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('atm_assembly_key') || '');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [saveBadge, setSaveBadge] = useState<string>('API Key အမြဲတမ်း သိမ်းဆည်းထားသည်');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  // Status & Progress
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [subStatusMessage, setSubStatusMessage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusType, setStatusType] = useState<'normal' | 'error' | 'done'>('normal');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('atm_assembly_key', apiKey.trim());
      setSaveBadge('API Key အမြဲတမ်း သိမ်းဆည်းပြီး ✓');
    }
  }, [apiKey]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    setBaseFileName(cleanName);

    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(URL.createObjectURL(file));
  };

  // Ultra-Light 8kHz Mono WAV compressor from ATM Movie engine
  const audioBufferToTinyWav = (audioBuffer: AudioBuffer): Blob => {
    const targetSampleRate = 8000;
    const ratio = audioBuffer.sampleRate / targetSampleRate;
    const rawData = audioBuffer.getChannelData(0);
    const newLength = Math.floor(rawData.length / ratio);
    const buffer = new ArrayBuffer(44 + newLength * 2);
    const view = new DataView(buffer);

    const writeString = (v: DataView, offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        v.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + newLength * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, targetSampleRate, true);
    view.setUint32(28, targetSampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, newLength * 2, true);

    let offset = 44;
    for (let i = 0; i < newLength; i++) {
      const sampleIndex = Math.floor(i * ratio);
      const sample = Math.max(-1, Math.min(1, rawData[sampleIndex]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  const compressVideoToTinyAudio = async (file: File): Promise<Blob | File> => {
    try {
      setStatusMessage('Load Failed မဖြစ်စေရန် Video မှ အသံကို အသေးဆုံးချုံ့နေပါသည်...');
      setProgressPercent(10);
      setSubStatusMessage('ဖိုင်ဆိုဒ် 95% လျှော့ချနေပါသည်...');
      const arrayBuffer = await file.arrayBuffer();
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass({ sampleRate: 8000 });
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      const wavBlob = audioBufferToTinyWav(decoded);
      if (audioCtx.close) await audioCtx.close();
      return wavBlob;
    } catch (e) {
      console.warn('Audio compression fallback to raw file:', e);
      return file;
    }
  };

  const uploadToAssemblyResilient = async (blob: Blob | File, key: string): Promise<string> => {
    let lastErr: any = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
        setStatusMessage(`AssemblyAI Cloud သို့ တင်ပို့နေပါသည် (အကြိမ် ${attempt}/4)...`);
        setProgressPercent(25);
        setSubStatusMessage(`ချုံ့ထားသော အသံဖိုင်ပမာဏ: ${sizeMB} MB သာရှိပါသည်`);

        const res = await fetch('https://api.assemblyai.com/v2/upload', {
          method: 'POST',
          headers: {
            Authorization: key,
            'Content-Type': 'application/octet-stream',
          },
          body: blob,
        });

        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        return data.upload_url;
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
    throw new Error('ဖိုင်တင်ပို့မှု မအောင်မြင်ပါ (' + (lastErr?.message || '') + ')။ အင်တာနက်လိုင်း သို့မဟုတ် API Key စစ်ဆေးပါ။');
  };

  const startProcess = async () => {
    const key = apiKey.trim();
    if (!key) {
      alert('AssemblyAI API Key ထည့်သွင်းပေးပါ။');
      return;
    }
    if (!selectedFile) {
      alert('Video သို့မဟုတ် Audio ဖိုင် အရင်ရွေးချယ်ပေးပါ။');
      return;
    }

    setIsProcessing(true);
    setStatusType('normal');

    const historyId = 'job_' + Date.now();
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      const lightBlob = await compressVideoToTinyAudio(selectedFile);
      const uploadUrl = await uploadToAssemblyResilient(lightBlob, key);

      setStatusMessage('Background Cloud Job စတင်နေပါသည်...');
      setProgressPercent(45);

      const transcriptResp = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          Authorization: key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_url: uploadUrl,
          language_detection: true,
          punctuate: true,
          format_text: true,
        }),
      });

      if (!transcriptResp.ok) throw new Error('Transcription Job စတင်မရပါ။');
      const { id: transcriptId } = await transcriptResp.json();

      onUpdateHistoryItem({
        id: historyId,
        fileName: selectedFile.name,
        dateStr: nowStr,
        status: 'processing',
        transcriptId,
        originalSrt: '',
        file3Text: '',
      });

      setStatusMessage('Cloud Background တွင် စာသားထုတ်နေပါပြီ (ဖုန်းပိတ်ထားနိုင်ပါပြီ)!');
      setProgressPercent(60);
      setSubStatusMessage('✓ History ထဲတွင် မှတ်သားပြီးပါပြီ။ Website မှ ထွက်သွားလျှင်လည်း ပြန်ဝင်လာချိန် အသင့်ရရှိပါမည်။');

      await pollTranscriptStatus(historyId, transcriptId, key);
    } catch (err: any) {
      setStatusType('error');
      setStatusMessage('အမှားအယွင်း: ' + err.message);
      onUpdateHistoryItem({
        id: historyId,
        fileName: selectedFile ? selectedFile.name : 'Unknown',
        dateStr: nowStr,
        status: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const pollTranscriptStatus = async (historyId: string, transcriptId: string, key: string) => {
    let pollProgress = 65;
    while (true) {
      try {
        const checkResp = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
          headers: { Authorization: key },
        });
        const checkData = await checkResp.json();

        if (checkData.status === 'completed') {
          const srtResp = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}/srt`, {
            headers: { Authorization: key },
          });
          const original = (await srtResp.text()).trim();

          setOriginalSrt(original);
          onUpdateHistoryItem({
            id: historyId,
            status: 'completed',
            originalSrt: original,
          });

          setStatusType('done');
          setProgressPercent(100);
          setStatusMessage('အောင်မြင်စွာ ပြီးဆုံးပါပြီ။ History ထဲတွင်လည်း အမြဲသိမ်းဆည်းပြီးပါပြီ။');
          break;
        } else if (checkData.status === 'error') {
          setStatusType('error');
          setStatusMessage('AssemblyAI Error: ' + checkData.error);
          onUpdateHistoryItem({ id: historyId, status: 'error' });
          break;
        } else {
          pollProgress = Math.min(pollProgress + 5, 92);
          setProgressPercent(pollProgress);
          setStatusMessage(`Cloud Server ပေါ်တွင် စာသားထုတ်နေပါသည် (${checkData.status})...`);
        }
      } catch (e) {
        // network retry
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
  };

  const extractDialogueLinesFromSrt = (srtText: string): string => {
    return srtText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => {
        if (!line) return false;
        if (/^\d+$/.test(line)) return false;
        if (line.includes('-->')) return false;
        return true;
      })
      .join('\n');
  };

  const copyGeminiAppPrompt = () => {
    const text = originalSrt.trim();
    if (!text) {
      alert('မူရင်း SRT စာသား မရှိသေးပါ။');
      return;
    }
    const cleanDialogues = extractDialogueLinesFromSrt(text);
    const promptText = `You are a professional movie translator for ATM Movie.
Translate the following dialogue lines into natural, concise spoken Burmese (မြန်မာစကားပြော).

STRICT RULES:
1. DO NOT include any timestamps (00:00:00), index numbers, or JSON formatting.
2. Output ONLY pure Myanmar script (မြန်မာစာသားသီးသန့်).
3. Translate line-by-line, keeping each sentence short, natural, and clear.
4. DO NOT include ANY English, Chinese, or foreign characters. Transliterate all names phonetically into Burmese script.
5. Do NOT wrap output in markdown code blocks.

DIALOGUES TO TRANSLATE:
${cleanDialogues}`;

    navigator.clipboard.writeText(promptText).then(() => {
      alert(
        'Timestamp မပါသော မြန်မာဘာသာပြန် Prompt အား Copy ကူးယူပြီးပါပြီ!\n\nGemini App ထဲတွင် Paste ချပြီး ပို့လိုက်ပါ။ ရလာသော မြန်မာစာသားများကို SRT File 3 ထဲသို့ ပြန်ထည့်ပါ။'
      );
    });
  };

  const stripTimestampsAndCleanMyanmar = () => {
    let rawText = file3Text.trim() || originalSrt.trim();
    if (!rawText) {
      alert('သန့်စင်ရန် စာသား မရှိသေးပါ။');
      return;
    }

    rawText = rawText.replace(/```[a-zA-Z]*\n?/gi, '').replace(/```/g, '').trim();

    let extractedLines: string[] = [];
    if (rawText.startsWith('[') && rawText.endsWith(']')) {
      try {
        const parsed = JSON.parse(rawText);
        extractedLines = parsed.map((item: any) => item.burmese || item.text || '');
      } catch (e) {
        extractedLines = rawText.split(/\r?\n/);
      }
    } else {
      extractedLines = rawText.split(/\r?\n/);
    }

    const pureMyanmarLines = extractedLines
      .map((line) => {
        return line
          .replace(/^\d+\s*$/, '')
          .replace(/\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/g, '')
          .replace(/"(index|timestamp|burmese|text)"\s*:\s*/gi, '')
          .replace(/\([A-Za-z0-9\s,.'"-]+\)/g, '')
          .replace(/\[[A-Za-z0-9\s,.'"-]+\]/g, '')
          .replace(/[A-Za-z0-9"{}\[\]]+/g, '')
          .replace(/^\s*[,:-]+\s*|\s*[,:-]+\s*$/g, '')
          .replace(/\s{2,}/g, ' ')
          .trim();
      })
      .filter((line) => line.length > 0);

    const finalPureText = pureMyanmarLines.join('\n');
    setFile3Text(finalPureText);

    if (currentHistoryId) {
      onUpdateHistoryItem({
        id: currentHistoryId,
        file3Text: finalPureText,
      });
    }
  };

  const copyPureMyanmarText = () => {
    if (!file3Text.trim()) {
      alert('ကူးယူရန် စာသား မရှိသေးပါ။');
      return;
    }
    navigator.clipboard.writeText(file3Text.trim()).then(() => {
      alert('မြန်မာစာသားသီးသန့်ကို Copy ကူးယူပြီးပါပြီ!');
    });
  };

  const downloadFile = (type: 'original' | 'file3') => {
    let content = '';
    let fileName = '';

    if (type === 'original') {
      content = originalSrt.trim();
      fileName = `${baseFileName || 'atm_movie'}_File1_Original.srt`;
    } else {
      content = file3Text.trim();
      fileName = `${baseFileName || 'atm_movie'}_File3_Myanmar_Text.srt`;
    }

    if (!content) {
      alert('ဒေါင်းလုဒ်ဆွဲရန် စာသား မရှိသေးပါ။');
      return;
    }

    const blob = new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* STEP 1: API KEY */}
      <section className="step-card p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
          <h2 className="text-base font-bold text-white flex items-center">
            <span className="bg-red-600 text-white w-6 h-6 rounded-full inline-flex items-center justify-center text-xs mr-2.5">
              1
            </span>
            AssemblyAI API Key
          </h2>
          <div className="text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-lg flex items-center w-fit">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            <span>{saveBadge}</span>
          </div>
        </div>

        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AssemblyAI API Key ထည့်ပါ..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-3 top-3 text-slate-400 hover:text-white"
          >
            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </section>

      {/* STEP 2: UPLOAD & ANTI-LOAD FAILED ENGINE */}
      <section className="step-card p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <h2 className="text-base font-bold text-white flex items-center">
            <span className="bg-red-600 text-white w-6 h-6 rounded-full inline-flex items-center justify-center text-xs mr-2.5">
              2
            </span>
            Video တင်ပြီး Background တွင် စာသားထုတ်ယူရန်
          </h2>
          <span className="text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Ultra-Light Audio (Load Failed 100% ကာကွယ်ပြီး)</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
          <div
            className="border-2 border-dashed border-slate-600 hover:border-red-500 rounded-xl p-6 text-center transition cursor-pointer bg-slate-900/50"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="video/*,audio/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <UploadCloud className="w-10 h-10 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-white">
              {selectedFile ? (
                <span className="text-emerald-400 font-bold flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
              ) : (
                'Video သို့မဟုတ် Audio ဖိုင် ရွေးချယ်ရန် နှိပ်ပါ'
              )}
            </p>
            <p className="text-xs text-slate-400 mt-1">ဖိုင်ကြီးများကို အသံဖိုင်အသေးသို့ အလိုအလျောက် ချုံ့တင်ပေးပါသည်</p>
          </div>

          <div className="space-y-3">
            {videoPreviewUrl && (
              <video
                src={videoPreviewUrl}
                controls
                playsInline
                className="w-full h-40 bg-black rounded-lg object-contain border border-slate-700"
              />
            )}

            <button
              onClick={startProcess}
              disabled={isProcessing || !selectedFile}
              className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold py-3 px-5 rounded-xl shadow-lg transition flex items-center justify-center space-x-2"
            >
              <Rocket className="w-4 h-4" />
              <span>{isProcessing ? 'စာသားထုတ်ယူနေပါသည်...' : 'စာသားစတင်ထုတ်မည် (Background Cloud)'}</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {isProcessing && (
          <div className="mt-5 bg-slate-900 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <i className="fa-solid fa-circle-notch fa-spin text-red-500"></i>
                <span className="text-sm font-medium text-slate-200">{statusMessage}</span>
              </div>
              <span className="text-xs font-bold text-red-400">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  statusType === 'done' ? 'bg-emerald-500' : statusType === 'error' ? 'bg-red-600' : 'bg-red-600'
                }`}
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            {subStatusMessage && <p className="text-xs text-emerald-400 mt-2">{subStatusMessage}</p>}
          </div>
        )}
      </section>

      {/* STEP 3: SRT FILE 1 & SRT FILE 3 */}
      <section className="step-card p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white flex items-center">
            <span className="bg-red-600 text-white w-6 h-6 rounded-full inline-flex items-center justify-center text-xs mr-2.5">
              3
            </span>
            SRT File 1 (မူရင်း) နှင့် SRT File 3 (မြန်မာစာသားသီးသန့်)
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {baseFileName ? `ဖိုင်: ${baseFileName}` : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* SRT File 1: Original */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded">
                  SRT File 1
                </span>
                <button
                  onClick={() => downloadFile('original')}
                  disabled={!originalSrt}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition flex items-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>မူရင်း SRT ဒေါင်းမယ်</span>
                </button>
              </div>
              <h3 className="text-sm font-bold text-white mb-2">မူရင်းစာသား (Original Subtitle)</h3>
              <textarea
                rows={13}
                value={originalSrt}
                onChange={(e) => {
                  setOriginalSrt(e.target.value);
                  if (currentHistoryId) {
                    onUpdateHistoryItem({ id: currentHistoryId, originalSrt: e.target.value });
                  }
                }}
                placeholder="AssemblyAI မှ ထွက်လာသော မူရင်း Timestamp နှင့် စာသား..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-blue-500 resize-y"
              ></textarea>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800">
              <button
                onClick={copyGeminiAppPrompt}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition flex items-center justify-center space-x-2 shadow-lg"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Gemini App ဘာသာပြန်ရန် Prompt ကူးမည် (Timestamp မပါ)</span>
              </button>
            </div>
          </div>

          {/* SRT File 3: Gemini App Pure Burmese Text */}
          <div className="bg-slate-900 border-2 border-purple-500/50 rounded-xl p-4 flex flex-col justify-between shadow-lg shadow-purple-950/20">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 px-2.5 py-1 rounded">
                  SRT File 3 (Gemini App)
                </span>
                <button
                  onClick={() => downloadFile('file3')}
                  disabled={!file3Text}
                  className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition flex items-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>မြန်မာစာသား ဒေါင်းမယ်</span>
                </button>
              </div>
              <h3 className="text-sm font-bold text-purple-300 mb-2">မြန်မာစာသားသီးသန့် (Timestamp ဖျက်ပြီး)</h3>
              <textarea
                rows={13}
                value={file3Text}
                onChange={(e) => {
                  setFile3Text(e.target.value);
                  if (currentHistoryId) {
                    onUpdateHistoryItem({ id: currentHistoryId, file3Text: e.target.value });
                  }
                }}
                placeholder="Gemini App မှ ရလာသော မြန်မာဘာသာပြန်စာသားများကို ဒီနေရာတွင် ကူးထည့်ပါ..."
                className="w-full bg-slate-950 border border-purple-900/50 rounded-lg p-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-purple-500 resize-y leading-relaxed"
              ></textarea>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={stripTimestampsAndCleanMyanmar}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition flex items-center justify-center space-x-2 shadow-lg"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Timestamp ဖျက်ပြီး မြန်မာစာသီးသန့် ထုတ်မည်</span>
                </button>
                <button
                  onClick={copyPureMyanmarText}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 px-3 rounded-lg text-xs transition border border-slate-700"
                  title="Copy Text"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* DIRECT ACTION: Send into Microsoft Edge TTS Sound Studio */}
              <button
                onClick={() => onSendToSoundStudio(file3Text)}
                disabled={!file3Text.trim()}
                className="w-full bg-gradient-to-r from-red-600 to-indigo-600 hover:from-red-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition flex items-center justify-center space-x-2 shadow-xl"
              >
                <Volume2 className="w-4 h-4 text-amber-300" />
                <span>🔊 ဤမြန်မာစာသားကို Microsoft Edge TTS ဖြင့် အသံဖိုင်ထုတ်မည်</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
