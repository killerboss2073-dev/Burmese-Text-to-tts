import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Volume2,
  Play,
  Pause,
  Download,
  RotateCcw,
  Sliders,
  FileText,
  Trash2,
  Zap,
  Info,
  Radio,
  Clock,
  AudioLines,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { VoicePreset, GeneratedAudioItem, SubtitleTwoLineCue } from '../types';
import { EDGE_VOICE_PRESETS } from '../constants/voices';
import { parseTwoLineCuesFromSrt, buildTwoLineSrtFromWords, downloadStandardSrt } from '../utils/srtParser';
import { UnifiedProcessBarModal, ProcessBarState } from './UnifiedProcessBarModal';

interface SoundStudioProps {
  initialText?: string;
  onClearInitialText?: () => void;
  subtitleFile3Text?: string;
  onGeneratingChange?: (isGenerating: boolean, percent: number, detailMessage: string) => void;
}

export const SoundStudio: React.FC<SoundStudioProps> = ({
  initialText = '',
  onClearInitialText,
  subtitleFile3Text = '',
  onGeneratingChange,
}) => {
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('giuseppe');
  const [inputText, setInputText] = useState<string>(initialText || '');
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.3);
  const [pitchOffset, setPitchOffset] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  const [justCompletedInBackground, setJustCompletedInBackground] = useState<boolean>(false);

  // Audio player state
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [currentTitle, setCurrentTitle] = useState<string>('');

  // 2-Line Subtitle state (စာတန်းထိုး မျဉ်း ၂ ကြောင်း)
  const [currentSrt, setCurrentSrt] = useState<string>('');
  const [twoLineCues, setTwoLineCues] = useState<SubtitleTwoLineCue[]>([]);
  const [showSrtDrawer, setShowSrtDrawer] = useState<boolean>(false);
  const [copiedSrt, setCopiedSrt] = useState<boolean>(false);

  // Active subtitle cue during live audio playback (strictly non-overlapping)
  const activeCue = useMemo(() => {
    if (!twoLineCues || twoLineCues.length === 0) return null;
    // 1. Exact match within cue bounds
    const exact = twoLineCues.find((c) => currentTime >= c.startTime && currentTime <= c.endTime);
    if (exact) return exact;
    // 2. Fallback to cue that just ended within 40ms gap (only if next cue hasn't started)
    return (
      twoLineCues.find((c, idx) => {
        const nextCue = twoLineCues[idx + 1];
        if (nextCue && currentTime >= nextCue.startTime) return false;
        return currentTime >= c.startTime && currentTime <= c.endTime + 0.04;
      }) || null
    );
  }, [twoLineCues, currentTime]);

  // Audio history
  const [audioHistory, setAudioHistory] = useState<GeneratedAudioItem[]>(() => {
    try {
      const saved = localStorage.getItem('atm_edge_audio_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // If initialText passed from Subtitle Step 3, populate
  useEffect(() => {
    if (initialText && initialText.trim()) {
      setInputText(initialText);
      if (onClearInitialText) onClearInitialText();
    }
  }, [initialText]);

  // Sync selected voice speed preset when voice changes
  const handleSelectVoice = (voice: VoicePreset) => {
    setSelectedVoiceId(voice.id);
    setSpeedMultiplier(voice.defaultSpeed);
  };

  const selectedVoice = EDGE_VOICE_PRESETS.find((v) => v.id === selectedVoiceId) || EDGE_VOICE_PRESETS[0];

  // Audio player listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => setIsPlaying(false);
    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
    };
  }, [currentAudioUrl]);

  // Preview Sample Audio for Voice
  const handlePlaySample = async (voice: VoicePreset, e: React.MouseEvent) => {
    e.stopPropagation();

    // If currently previewing this one, stop it
    if (previewingVoiceId === voice.id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setPreviewingVoiceId(null);
      return;
    }

    try {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPreviewingVoiceId(voice.id);

      const response = await fetch(`/api/tts/sample/${voice.id}`);
      if (!response.ok) throw new Error('Sample voice preview failed');
      const blob = await response.blob();
      const sampleUrl = URL.createObjectURL(blob);

      const audio = new Audio(sampleUrl);
      previewAudioRef.current = audio;

      audio.onended = () => {
        setPreviewingVoiceId(null);
      };
      audio.onerror = () => {
        setPreviewingVoiceId(null);
      };

      await audio.play().catch((err) => {
        console.warn('[SoundStudio] Sample playback error:', err);
        setPreviewingVoiceId(null);
      });
    } catch (err) {
      console.warn('[SoundStudio] Sample fetch error:', err);
      setPreviewingVoiceId(null);
    }
  };

  // Unified Process Bar state for Voice/Sound generation with percentage
  const [processState, setProcessState] = useState<ProcessBarState>({
    isOpen: false,
    type: 'generate_voice',
    title: '🔊 အသံဖိုင် ထုတ်ယူနေပါသည်',
    stageName: 'စတင်ပြင်ဆင်နေသည်',
    currentStep: 1,
    totalSteps: 3,
    percent: 0,
    detailMessage: '',
    isComplete: false,
    error: null,
  });

  // Generate Audio via Server Edge TTS with synchronized 2-line SRT
  const handleGenerateSound = async () => {
    const cleanText = inputText.trim();
    if (!cleanText) {
      alert('အသံထုတ်ရန် စာသား ထည့်သွင်းပေးပါခင်ဗျာ။');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress('Microsoft Edge Multilingual Neural Cloud နှင့် ချိတ်ဆက်နေပါသည်...');
    setJustCompletedInBackground(false);

    // Request screen wakeLock to prevent device from sleeping in background
    let wakeLock: any = null;
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        wakeLock = await (navigator as any).wakeLock.request('screen');
      } catch (e) {}
    }

    // Open Unified Progress Modal starting strictly at 1%
    setProcessState({
      isOpen: true,
      type: 'generate_voice',
      title: '🔊 Edge TTS အသံဖိုင် ထုတ်ယူနေပါသည်',
      stageName: '၁. စာသားစစ်ဆေးခြင်းနှင့် ကြိုတင်ပြင်ဆင်ခြင်း',
      currentStep: 1,
      totalSteps: 3,
      percent: 1,
      detailMessage: `${selectedVoice.characterName} (${selectedVoice.name}) ဖြင့် အသံဖိုင် စတင်ဖန်တီးနေပါသည်... (၁%)`,
      isComplete: false,
      error: null,
      onClose: () => setProcessState((prev) => ({ ...prev, isOpen: false })),
      onMinimize: () => setProcessState((prev) => ({ ...prev, isOpen: false })),
    });

    onGeneratingChange?.(true, 1, `${selectedVoice.characterName} စာသားစစ်ဆေးနေပါသည်`);

    // Dynamic continuous ticker: ensures the percentage NEVER stands still at 60% or any number!
    let displayPercent = 1;
    let targetPercent = 5;
    let currentStage = '၁. စာသားစစ်ဆေးခြင်းနှင့် ကြိုတင်ပြင်ဆင်ခြင်း';
    let currentDetail = `${selectedVoice.characterName} (${selectedVoice.name}) ဖြင့် အသံဖိုင် စတင်ဖန်တီးနေပါသည်...`;

    const tickerInterval = setInterval(() => {
      if (displayPercent < targetPercent) {
        // Step forward smoothly
        displayPercent += 1;
      } else if (displayPercent < 95 && targetPercent < 100) {
        // While waiting for background chunk synthesis, steadily advance so it never freezes
        displayPercent = Math.min(95, displayPercent + 1);
      }

      const stepNum = displayPercent < 20 ? 1 : displayPercent < 88 ? 2 : 3;
      setProcessState((prev) => ({
        ...prev,
        currentStep: stepNum,
        percent: displayPercent,
        stageName: currentStage,
        detailMessage: `${currentDetail} (${displayPercent}%)`,
      }));
      onGeneratingChange?.(true, displayPercent, currentDetail);
    }, 180);

    try {
      let audioBlob: Blob | null = null;
      let decodedSrt = '';

      // 1. Start background task on server with live progress tracking
      const taskInitRes = await fetch('/api/tts/start-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          voiceId: selectedVoice.id,
          voiceName: selectedVoice.voiceName,
          speed: speedMultiplier,
          pitch: pitchOffset !== 0 ? `${pitchOffset >= 0 ? '+' : ''}${pitchOffset}Hz` : '+0Hz',
        }),
      });

      if (taskInitRes.ok) {
        const { taskId } = await taskInitRes.json();
        let isTaskDone = false;
        const pollStartTime = Date.now();

        while (!isTaskDone) {
          // Timeout safety guard (10 mins for long scripts)
          if (Date.now() - pollStartTime > 600000) {
            throw new Error('အသံဖိုင်ထုတ်လုပ်မှု အချိန်ကြာမြင့်နေသဖြင့် ကျေးဇူးပြု၍ ပြန်လည်ကြိုးစားပေးပါခင်ဗျာ။');
          }

          await new Promise((r) => setTimeout(r, 450));

          const statusRes = await fetch(`/api/tts/task-status/${taskId}`);
          if (!statusRes.ok) continue;

          const taskData = await statusRes.json();
          if (taskData.status === 'completed') {
            isTaskDone = true;
            targetPercent = 100;
            currentStage = '၃. ပြီးစီးပါပြီ';
            currentDetail = `${selectedVoice.characterName} အသံဖိုင် ထုတ်လုပ်ပြီးစီးပါပြီ!`;

            // Retrieve generated audio
            const audioRes = await fetch(`/api/tts/task-audio/${taskId}`);
            if (!audioRes.ok) throw new Error('Failed to retrieve synthesized audio.');
            audioBlob = await audioRes.blob();
            decodedSrt = taskData.srtContent || '';

            if (!decodedSrt && taskData.srtId) {
              const srtFetch = await fetch(`/api/tts/srt/${taskData.srtId}`);
              if (srtFetch.ok) {
                const srtData = await srtFetch.json();
                decodedSrt = srtData.srtContent || '';
              }
            }
          } else if (taskData.status === 'error') {
            throw new Error(taskData.error || 'အသံဖိုင်ထုတ်ယူရာတွင် အမှားဖြစ်ပေါ်ခဲ့ပါသည်။');
          } else {
            // Task is in progress: update target percent & message
            targetPercent = Math.max(targetPercent, taskData.percent || 15);
            if (taskData.stageName) currentStage = taskData.stageName;
            if (taskData.detailMessage) {
              currentDetail = taskData.detailMessage.replace(/\(\d+%\)/, '').trim();
            }
          }
        }
      } else {
        // Fallback: Direct endpoint
        targetPercent = 40;
        currentStage = '၂. Microsoft Edge Neural Cloud အသံလှိုင်း ဖန်တီးခြင်း';
        currentDetail = `အသံထွက် မြန်နှုန်း ${speedMultiplier}x ဖြင့် ဖန်တီးနေပါသည်...`;

        const response = await fetch('/api/tts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanText,
            voiceId: selectedVoice.id,
            voiceName: selectedVoice.voiceName,
            speed: speedMultiplier,
            pitch: pitchOffset !== 0 ? `${pitchOffset >= 0 ? '+' : ''}${pitchOffset}Hz` : '+0Hz',
          }),
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          throw new Error(errJson.error || `Server responded with status ${response.status}`);
        }

        targetPercent = 95;
        const srtHeader = response.headers.get('x-srt-base64');
        const srtIdHeader = response.headers.get('x-srt-id');
        if (srtHeader) {
          try {
            const binaryStr = atob(srtHeader);
            const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
            decodedSrt = new TextDecoder('utf-8').decode(bytes);
          } catch (e) {}
        }
        if (!decodedSrt && srtIdHeader) {
          try {
            const srtResp = await fetch(`/api/tts/srt/${srtIdHeader}`);
            if (srtResp.ok) {
              const srtData = await srtResp.json();
              decodedSrt = srtData.srtContent || '';
            }
          } catch (e) {}
        }

        audioBlob = await response.blob();
      }

      if (!audioBlob) {
        throw new Error('အသံဖိုင် ရယူနိုင်ခြင်း မရှိပါခင်ဗျာ။');
      }

      // Smoothly finish at 100%
      clearInterval(tickerInterval);
      setProcessState((prev) => {
        if (!prev.isOpen) {
          setJustCompletedInBackground(true);
        }
        return {
          ...prev,
          stageName: 'ပြီးစီးပါပြီ',
          currentStep: 3,
          percent: 100,
          detailMessage: `${selectedVoice.characterName} အသံဖိုင်နှင့် မျဉ်း ၂ ကြောင်း စာတန်းထိုး အောင်မြင်စွာ ထုတ်လုပ်ပြီးပါပြီ! (၁၀၀%)`,
          isComplete: true,
          error: null,
        };
      });
      onGeneratingChange?.(false, 100, 'အသံဖိုင် ထုတ်လုပ်ပြီးပါပြီ');

      const url = URL.createObjectURL(audioBlob);

      // Fallback: Only if header and endpoint fail, generate estimated 2-line cues from words
      if (!decodedSrt && cleanText) {
        const estDuration = audioBlob.size / 6000;
        const words = cleanText.split(/\s+/).filter(Boolean);
        const wordDur = estDuration / Math.max(1, words.length);
        const mockWords = words.map((w, idx) => ({
          text: w,
          start: idx * wordDur,
          end: (idx + 1) * wordDur,
        }));
        const built = buildTwoLineSrtFromWords(mockWords);
        decodedSrt = built.srtContent;
      }

      const cues = parseTwoLineCuesFromSrt(decodedSrt);
      setCurrentSrt(decodedSrt);
      setTwoLineCues(cues);

      setCurrentAudioUrl(url);
      setCurrentTitle(`${selectedVoice.characterName} (${selectedVoice.name}) - Speed ${speedMultiplier}x`);
      setIsPlaying(true);

      const sizeMB = (audioBlob.size / (1024 * 1024)).toFixed(2);
      const newHistoryItem: GeneratedAudioItem = {
        id: 'tts_' + Date.now(),
        voiceId: selectedVoice.id,
        characterName: selectedVoice.characterName,
        voiceDisplayName: selectedVoice.name,
        speed: speedMultiplier,
        textSnippet: cleanText.length > 90 ? cleanText.slice(0, 90) + '...' : cleanText,
        audioBlobUrl: url,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fileSizeFormatted: `${sizeMB} MB`,
        srtContent: decodedSrt,
        twoLineCues: cues,
      };

      const updatedHistory = [newHistoryItem, ...audioHistory.slice(0, 19)];
      setAudioHistory(updatedHistory);

      try {
        localStorage.setItem(
          'atm_edge_audio_history',
          JSON.stringify(
            updatedHistory.map((item) => ({
              ...item,
              audioBlobUrl: '',
            }))
          )
        );
      } catch (e) {}

      // Autoplay
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.playbackRate = playbackSpeed;
        audioRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      clearInterval(tickerInterval);
      console.error('Audio generation error:', err);
      setProcessState((prev) => ({
        ...prev,
        error: `အသံထုတ်ယူရာတွင် အမှားဖြစ်ပေါ်ပါသည်: ${err.message}`,
        isComplete: true,
      }));
      onGeneratingChange?.(false, 0, `အမှား: ${err.message}`);
    } finally {
      clearInterval(tickerInterval);
      if (wakeLock) {
        try {
          await wakeLock.release();
        } catch (e) {}
      }
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  // Download 2-Line Formatted SRT File
  const handleDownloadSrt = (srtText: string, voiceName: string) => {
    if (!srtText || !srtText.trim()) {
      alert('ဒေါင်းလုဒ်လုပ်ရန် SRT စာတန်းထိုး မရှိသေးပါခင်ဗျာ။');
      return;
    }
    const filename = `${voiceName.replace(/\s+/g, '_')}_2lines_${Date.now()}.srt`;
    downloadStandardSrt(srtText, filename);
  };

  // Copy 2-Line SRT to Clipboard
  const handleCopySrt = () => {
    if (!currentSrt) return;
    navigator.clipboard.writeText(currentSrt);
    setCopiedSrt(true);
    setTimeout(() => setCopiedSrt(false), 2000);
  };

  // Play/Pause current audio safely
  const togglePlay = async () => {
    if (!audioRef.current || !currentAudioUrl) return;
    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        if (!audioRef.current.src || audioRef.current.src !== currentAudioUrl) {
          audioRef.current.src = currentAudioUrl;
        }
        await audioRef.current.play().catch((err) => {
          console.warn('[SoundStudio] Audio play error handled:', err);
        });
      }
    } catch (err) {
      console.warn('[SoundStudio] Toggle play exception:', err);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handlePlaybackSpeedChange = (rate: number) => {
    setPlaybackSpeed(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleDownloadAudio = (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}_${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  // Import directly from File 3
  const handleImportFromFile3 = () => {
    if (!subtitleFile3Text || !subtitleFile3Text.trim()) {
      alert('SRT File 3 တွင် မြန်မာစာသား မရှိသေးပါ။ ကျေးဇူးပြု၍ Step 3 တွင် စာသားအရင်ထည့်ပေးပါခင်ဗျာ။');
      return;
    }
    setInputText(subtitleFile3Text.trim());
  };

  // Quick Sample Phrases
  const handleUseSamplePhrase = (text: string) => {
    setInputText(text);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-indigo-500/30 p-6 shadow-2xl">
        <div className="absolute -right-8 -top-8 w-44 h-44 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-8 -bottom-8 w-44 h-44 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2.5 mb-1.5">
              <span className="px-3 py-1 text-xs font-extrabold uppercase tracking-wider rounded-full bg-gradient-to-r from-red-600 to-indigo-600 text-white shadow-md flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Microsoft Edge TTS Studio
              </span>
              <span className="text-[11px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-0.5 rounded-full font-semibold">
                Multilingual Neural
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
              <Volume2 className="text-red-500 w-6 h-6 inline-block" />
              <span>Menu Sound & Movie Recap Voice Studio</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              ဇာတ်လမ်းသုံးသပ်ချက်နှင့် ရုပ်ရှင် recap များအတွက် အထူးသင့်လျော်သော Microsoft Edge Multilingual အသံသရုပ်ဆောင် (၄) မျိုးဖြင့် မြန်မာစာသားများကို သွက်လက်ကြည်လင်စွာ အသံသွင်းနိုင်ပါသည်။
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleImportFromFile3}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-lg"
              title="SRT File 3 မှ မြန်မာစာသားကို ရယူမည်"
            >
              <FileText className="w-4 h-4 text-purple-400" />
              <span>SRT File 3 မှ ကူးယူမည်</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Requested Voices Selection Section */}
      <div className="step-card p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-red-500" />
              <span>အသံသရုပ်ဆောင် ရွေးချယ်ပါ (Microsoft Edge Neural Voices)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              အောက်ပါအသံ (၄) မျိုးမှ မိမိကြိုက်နှစ်သက်ရာ အသံနှင့် default speed ဖြင့် စိတ်ကြိုက် ရွေးချယ်နိုင်ပါသည်
            </p>
          </div>
          <span className="text-[11px] text-slate-400 bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">
            ရွေးချယ်ထားသောအသံ: <strong className="text-red-400">{selectedVoice.characterName}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EDGE_VOICE_PRESETS.map((voice) => {
            const isSelected = selectedVoiceId === voice.id;
            const isPreviewing = previewingVoiceId === voice.id;

            return (
              <div
                key={voice.id}
                onClick={() => handleSelectVoice(voice)}
                className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-900 border-red-500 shadow-lg shadow-red-600/10'
                    : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600 hover:bg-slate-900/90'
                }`}
              >
                {/* Active check circle */}
                {isSelected && (
                  <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500"></div>
                )}

                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shadow-md ${
                          isSelected
                            ? 'bg-gradient-to-br from-red-600 to-rose-700 text-white'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {voice.characterName.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-sm">{voice.characterName}</h3>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                            {voice.badge}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-indigo-300">{voice.name}</p>
                      </div>
                    </div>
                  </div>

                  <div className="my-2.5 space-y-1">
                    <div className="flex items-center space-x-2 text-[11px]">
                      <span className="text-slate-400 font-medium">Locale:</span>
                      <span className="font-mono bg-slate-950 px-2 py-0.5 rounded text-amber-300 text-[10px] border border-slate-800">
                        {voice.locale}
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400 font-medium">{voice.category}</span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed font-medium bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      💬 &quot;{voice.description}&quot;
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Voice ID: <code className="text-slate-400 text-[10px]">{voice.voiceName.split('-')[1]}</code>
                  </span>

                  <button
                    onClick={(e) => handlePlaySample(voice, e)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                      isPreviewing
                        ? 'bg-amber-600 text-white animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    {isPreviewing ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>နားထောင်နေသည်...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-emerald-400" />
                        <span>အသံနမူနာ နားထောင်မည်</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Script & Speed Tuning Controls */}
      <div className="step-card p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <AudioLines className="w-5 h-5 text-red-500" />
              <span>မြန်မာစာသား ရိုက်ထည့်ပါ (Input Script)</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              ({inputText.length} လုံး / ခန့်မှန်းကြာချိန် ~{Math.ceil(inputText.length / (14 * speedMultiplier))} စက္ကန့်)
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleUseSamplePhrase(selectedVoice.sampleText)}
              className="text-[11px] bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-slate-700 px-3 py-1 rounded-lg transition"
            >
              နမူနာစာသား စမ်းထည့်မည်
            </button>
            {inputText && (
              <button
                onClick={() => setInputText('')}
                className="text-[11px] text-slate-400 hover:text-red-400 transition flex items-center space-x-1"
                title="Clear Text"
              >
                <Trash2 className="w-3 h-3" />
                <span>ရှင်းမည်</span>
              </button>
            )}
          </div>
        </div>

        <textarea
          rows={7}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="ဒီနေရာတွင် မြန်မာလို စာသားများ ရိုက်ထည့်ပါ (သို့မဟုတ် SRT File 3 မှ စာသားများကို ကူးထည့်ပါ)..."
          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm font-sans text-emerald-300 focus:outline-none focus:border-red-500 resize-y leading-relaxed shadow-inner"
        ></textarea>

        {/* Speed and Pitch Sliders */}
        <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-red-400" />
              <span>အသံအမြန်နှုန်း (Voice Speed Rate):</span>
              <strong className="text-red-400 text-sm">{speedMultiplier.toFixed(2)}x</strong>
            </span>

            {/* Speed shortcut pills */}
            <div className="flex items-center space-x-1.5">
              {[1.0, 1.3, 1.6, 1.8, 2.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setSpeedMultiplier(rate)}
                  className={`text-[11px] px-2.5 py-0.5 rounded-md font-bold transition ${
                    Math.abs(speedMultiplier - rate) < 0.05
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          <input
            type="range"
            min="0.8"
            max="2.2"
            step="0.05"
            value={speedMultiplier}
            onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
            className="w-full accent-red-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
          />

          <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
            <span>0.8x (အေးဆေး)</span>
            <span className="text-indigo-400 font-semibold">1.3x (မောင်ကျော်သူ/မောင်သုတ/မဆုမြတ်)</span>
            <span className="text-rose-400 font-semibold">1.6x (ကိုအောင်ကျော် Hyper)</span>
            <span>2.2x (အလွန်မြန်)</span>
          </div>
        </div>

        {/* Generate Button */}
        <div className="mt-5">
          <button
            onClick={handleGenerateSound}
            disabled={isGenerating || !inputText.trim()}
            className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-indigo-600 hover:from-red-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-xl shadow-xl transition flex items-center justify-center space-x-2 text-sm"
          >
            {isGenerating ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin"></i>
                <span>{generationProgress || 'အသံဖိုင် စတင်ထုတ်လုပ်နေပါသည်...'}</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300" />
                <span>
                  &quot;{selectedVoice.characterName}&quot; အသံဖြင့် အသံဖိုင် စတင်ထုတ်မည် (Speed {speedMultiplier}x)
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main HTML5 Audio Player */}
      {currentAudioUrl && (
        <div className="step-card p-5 shadow-2xl border-2 border-indigo-500/40 bg-slate-900/95">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{currentTitle || 'အသံသွင်းထားသော ဖိုင်'}</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Ready
                  </span>
                </h3>
                <p className="text-xs text-slate-400">Microsoft Edge TTS MP3 Audio (24kHz Mono)</p>
              </div>
            </div>

            <button
              onClick={() => handleDownloadAudio(currentAudioUrl, selectedVoice.characterName)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-lg w-fit"
            >
              <Download className="w-3.5 h-3.5" />
              <span>MP3 အသံဖိုင် ဒေါင်းလုဒ်ဆွဲမည်</span>
            </button>
          </div>

          {/* Hidden HTML audio element */}
          <audio ref={audioRef} src={currentAudioUrl || undefined} preload="auto" />

          {/* Waveform graphic indicator */}
          <div className="h-10 bg-slate-950 rounded-xl flex items-center justify-center space-x-1 px-4 my-3 border border-slate-800 overflow-hidden">
            {[4, 8, 16, 24, 18, 10, 6, 14, 22, 28, 16, 8, 12, 20, 26, 14, 6, 10, 18, 24, 12, 6].map((h, i) => (
              <span
                key={i}
                className={`w-1 rounded-full transition-all duration-300 ${
                  isPlaying ? 'bg-red-500 animate-pulse' : 'bg-slate-700'
                }`}
                style={{
                  height: isPlaying ? `${Math.max(4, (h * Math.sin(i + currentTime * 4) + 20) % 28)}px` : `${h / 2}px`,
                }}
              ></span>
            ))}
          </div>

          {/* Scrubber & Duration */}
          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="w-full accent-red-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 5);
                }}
                className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800 text-xs"
                title="Rewind 5s"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
            </div>

            {/* Playback speed toggle */}
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-slate-400 text-[11px]">Player Rate:</span>
              {[1.0, 1.25, 1.5, 2.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => handlePlaybackSpeedChange(rate)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    playbackSpeed === rate ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* Live Synchronized 2-Line Subtitle Preview Box (စကားပြောအသံထွက်အတိုင်း စာတန်းထိုး မျဉ်း ၂ ကြောင်း) */}
          <div className="mt-4 rounded-xl bg-black/80 border border-red-500/30 p-4 relative overflow-hidden shadow-2xl backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <AudioLines className="w-4 h-4 text-red-400" />
                  စကားပြောအသံထွက်အတိုင်း စာတန်းထိုး (မျဉ်း ၂ ကြောင်း Live Subtitle)
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-mono font-bold border border-slate-700">
                  {twoLineCues.length} Cues
                </span>
                {activeCue && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 font-mono text-[10px] border border-emerald-500/30">
                    {activeCue.startTimeStr} → {activeCue.endTimeStr}
                  </span>
                )}
              </div>
            </div>

            {/* Active 2-line Subtitle Text Display */}
            <div className="min-h-[84px] flex flex-col justify-center items-center text-center px-4 py-3 bg-gradient-to-b from-slate-950/90 to-slate-900/80 rounded-xl border border-slate-800 shadow-inner">
              {activeCue ? (
                <div className="space-y-1.5 transition-all duration-150 py-1">
                  <p className="text-base sm:text-lg font-bold text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] leading-relaxed">
                    {activeCue.line1}
                  </p>
                  {activeCue.line2 && (
                    <p className="text-base sm:text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] leading-relaxed">
                      {activeCue.line2}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic py-1 flex items-center justify-center gap-2">
                  <Info className="w-4 h-4 text-slate-500" />
                  <span>
                    {isPlaying
                      ? 'အသံဖိုင် ဖွင့်နေသည်... စကားပြောစကားလုံးများ အသံထွက်အတိုင်း ဤနေရာတွင် မျဉ်း ၂ ကြောင်း ပေါ်လာပါမည်။'
                      : 'Play ကို နှိပ်ပါက စကားပြောအသံထွက်အတိုင်း မျဉ်း ၂ ကြောင်း စာတန်းထိုး အချိန်ကိုက် တိုက်ရိုက် ပြသပေးပါမည်။'}
                  </span>
                </div>
              )}
            </div>

            {/* Subtitle Action Toolbar */}
            <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Download 2-Line SRT File Button */}
                <button
                  onClick={() => handleDownloadSrt(currentSrt, selectedVoice.characterName)}
                  disabled={!currentSrt}
                  className="px-3.5 py-2 bg-gradient-to-r from-red-600 via-rose-600 to-indigo-600 hover:from-red-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-lg active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-amber-300" />
                  <span>မျဉ်း ၂ ကြောင်း SRT ဖိုင် ဒေါင်းလုဒ် (.SRT)</span>
                </button>

                {/* 2. Copy SRT Button */}
                <button
                  onClick={handleCopySrt}
                  disabled={!currentSrt}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 border border-slate-700 active:scale-95"
                >
                  {copiedSrt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{copiedSrt ? 'ကူးယူပြီးပါပြီ' : 'Copy SRT'}</span>
                </button>

                {/* 3. Toggle Full SRT Viewer & Editor */}
                <button
                  onClick={() => setShowSrtDrawer((prev) => !prev)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 border border-indigo-500/30"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>စာတန်းထိုး အပြည့်အစုံ ကြည့်မည်/ပြင်မည်</span>
                  {showSrtDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Collapsible Full SRT Inspection & Cue List */}
            {showSrtDrawer && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-red-400" />
                    <span>SRT Cues List (မျဉ်း ၂ ကြောင်း စာတန်းထိုးများ)</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    ကလစ်နှိပ်၍ အသံအချိန်ကို တိုက်ရိုက် ရွှေ့နားထောင်နိုင်ပါသည်
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* Interactive Cue List */}
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1 border border-slate-800 rounded-xl p-2 bg-slate-950/80">
                    {twoLineCues.map((cue) => {
                      const isThisCueActive = activeCue?.index === cue.index;
                      return (
                        <div
                          key={cue.index}
                          onClick={() => {
                            if (audioRef.current) {
                              audioRef.current.currentTime = cue.startTime;
                              audioRef.current.play().catch(() => {});
                            }
                          }}
                          className={`p-2.5 rounded-lg cursor-pointer transition text-xs border ${
                            isThisCueActive
                              ? 'bg-red-950/50 border-red-500 text-white shadow-md'
                              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span className="font-bold text-red-400">#{cue.index}</span>
                            <span className="font-mono bg-slate-850 px-1.5 py-0.2 rounded border border-slate-750">
                              {cue.startTimeStr} → {cue.endTimeStr}
                            </span>
                          </div>
                          <div className="font-bold text-amber-300">{cue.line1}</div>
                          {cue.line2 && <div className="font-medium text-slate-100 mt-0.5">{cue.line2}</div>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Raw SRT Textarea with Direct Edit Option */}
                  <div className="flex flex-col h-60">
                    <label className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
                      <span>SRT Raw Text (တည်းဖြတ်နိုင်ပါသည်):</span>
                      <span className="text-[10px] text-emerald-400 font-mono">UTF-8 Format</span>
                    </label>
                    <textarea
                      value={currentSrt}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCurrentSrt(val);
                        setTwoLineCues(parseTwoLineCuesFromSrt(val));
                      }}
                      className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-emerald-400 focus:outline-none focus:border-red-500 resize-none leading-relaxed"
                      placeholder="1&#10;00:00:00,000 --> 00:00:03,500&#10;Line 1&#10;Line 2&#10;"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audio History / Saved Tracks */}
      {audioHistory.length > 0 && (
        <div className="step-card p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-red-400" />
              <span>ထုတ်လုပ်ပြီးသော အသံဖိုင်များနှင့် SRT မှတ်တမ်း (Audio & Subtitle History)</span>
            </h3>
            <button
              onClick={() => {
                if (confirm('အသံမှတ်တမ်းအားလုံးကို ဖျက်မည်မှာ သေချာပါသလား?')) {
                  setAudioHistory([]);
                  localStorage.removeItem('atm_edge_audio_history');
                }
              }}
              className="text-[11px] text-slate-500 hover:text-red-400 transition"
            >
              မှတ်တမ်းရှင်းမည်
            </button>
          </div>

          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {audioHistory.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-white truncate">{item.characterName}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-red-600/20 text-red-300 rounded font-bold">
                      {item.speed}x
                    </span>
                    <span className="text-[10px] text-slate-500">{item.createdAt}</span>
                    {item.srtContent && (
                      <span className="text-[10px] px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30 font-mono">
                        2-Line SRT
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5 font-sans">&quot;{item.textSnippet}&quot;</p>
                </div>

                <div className="flex items-center space-x-2">
                  {item.audioBlobUrl && (
                    <>
                      <button
                        onClick={() => {
                          setCurrentAudioUrl(item.audioBlobUrl);
                          setCurrentTitle(`${item.characterName} - Speed ${item.speed}x`);
                          if (item.srtContent) {
                            setCurrentSrt(item.srtContent);
                            setTwoLineCues(parseTwoLineCuesFromSrt(item.srtContent));
                          }
                          if (audioRef.current) {
                            audioRef.current.src = item.audioBlobUrl;
                            audioRef.current.play().catch(() => {});
                          }
                        }}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs"
                        title="နားထောင်မည်"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDownloadAudio(item.audioBlobUrl, item.characterName)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                        title="Download MP3"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  {/* SRT Download Button from history item */}
                  {item.srtContent && (
                    <button
                      onClick={() => handleDownloadSrt(item.srtContent!, item.characterName)}
                      className="p-2 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 text-xs flex items-center space-x-1"
                      title="မျဉ်း ၂ ကြောင်း SRT ဖိုင် ဒေါင်းလုဒ်"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-300" />
                      <span className="hidden sm:inline text-[10px] font-bold">.SRT</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating Background Audio Generation Indicator (when modal is minimized while generating) */}
      {isGenerating && !processState.isOpen && (
        <div className="fixed bottom-6 right-6 z-40 bg-slate-900/95 border-2 border-emerald-500/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md max-w-sm w-full animate-slideUp">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>Background တွင် အသံထုတ်လုပ်နေပါသည်</span>
              </span>
            </div>
            <span className="font-mono font-bold text-amber-300 text-xs bg-amber-500/20 px-2 py-0.5 rounded">
              {processState.percent}%
            </span>
          </div>

          <p className="text-[11px] text-slate-300 truncate mb-2">
            {processState.detailMessage || 'ကျေးဇူးပြု၍ ခေတ္တစောင့်ဆိုင်းပေးပါ...'}
          </p>

          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mb-2.5">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${processState.percent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">အခြားလုပ်ငန်းများ ဆက်လက်လုပ်ဆောင်နိုင်ပါသည်</span>
            <button
              onClick={() => setProcessState((prev) => ({ ...prev, isOpen: true }))}
              className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 font-bold border border-emerald-500/40 transition"
            >
              အသေးစိတ်ကြည့်ရန် ↗
            </button>
          </div>
        </div>
      )}

      {/* Floating Notification when Background Generation Completes */}
      {justCompletedInBackground && (
        <div className="fixed bottom-6 right-6 z-40 bg-slate-900/95 border-2 border-emerald-500 rounded-2xl p-4 shadow-2xl backdrop-blur-md max-w-sm w-full animate-slideUp">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>အသံဖိုင် ထုတ်လုပ်ပြီးစီးပါပြီ!</span>
              </span>
            </div>
            <button
              onClick={() => setJustCompletedInBackground(false)}
              className="text-slate-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>

          <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
            {selectedVoice.characterName} အသံဖိုင်နှင့် မျဉ်း ၂ ကြောင်း စာတန်းထိုး အောင်မြင်စွာ ဖန်တီးပြီးပါပြီ။
          </p>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (audioRef.current && currentAudioUrl) {
                  audioRef.current.play().catch(() => {});
                  setIsPlaying(true);
                }
                setJustCompletedInBackground(false);
              }}
              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow"
            >
              <Play className="w-3.5 h-3.5" />
              <span>ဖွင့်နားဆင်မည်</span>
            </button>
            <button
              onClick={() => setJustCompletedInBackground(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
            >
              ပိတ်မည်
            </button>
          </div>
        </div>
      )}

      {/* Real-time Percentage Progress Bar Modal */}
      <UnifiedProcessBarModal state={processState} />
    </div>
  );
};
