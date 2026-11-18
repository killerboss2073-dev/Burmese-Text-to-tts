import React, { useState, useEffect } from 'react';
import { Menu, Cloud, Volume2, FileText } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { SubtitleStudio } from './components/SubtitleStudio';
import { SoundStudio } from './components/SoundStudio';
import { SubtitleHistoryItem } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'subtitles' | 'sound'>('subtitles');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Subtitle state shared across tools
  const [baseFileName, setBaseFileName] = useState<string>('atm_movie');
  const [originalSrt, setOriginalSrt] = useState<string>('');
  const [file3Text, setFile3Text] = useState<string>('');
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);

  // Sound Studio target text & background generation tracker
  const [soundStudioInitialText, setSoundStudioInitialText] = useState<string>('');
  const [isSoundGenerating, setIsSoundGenerating] = useState<boolean>(false);
  const [soundProgressPercent, setSoundProgressPercent] = useState<number>(0);
  const [soundProgressMessage, setSoundProgressMessage] = useState<string>('');

  // History list
  const [historyList, setHistoryList] = useState<SubtitleHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('atm_subtitle_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const saveHistory = (items: SubtitleHistoryItem[]) => {
    setHistoryList(items);
    localStorage.setItem('atm_subtitle_history', JSON.stringify(items));
  };

  const handleUpdateHistoryItem = (item: Partial<SubtitleHistoryItem> & { id: string }) => {
    setHistoryList((prev) => {
      const idx = prev.findIndex((h) => h.id === item.id);
      let updated: SubtitleHistoryItem[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = { ...updated[idx], ...item };
      } else {
        updated = [item as SubtitleHistoryItem, ...prev];
      }
      localStorage.setItem('atm_subtitle_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSelectHistory = (id: string) => {
    const item = historyList.find((h) => h.id === id);
    if (!item) return;

    setCurrentHistoryId(item.id);
    setBaseFileName(item.fileName.replace(/\.[^/.]+$/, ''));
    setOriginalSrt(item.originalSrt || '');
    setFile3Text(item.file3Text || '');
    setActiveTab('subtitles');
  };

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('ဤမှတ်တမ်းကို ဖျက်မည်မှာ သေချာပါသလား?')) return;
    const filtered = historyList.filter((h) => h.id !== id);
    saveHistory(filtered);
    if (currentHistoryId === id) {
      resetForNewVideo();
    }
  };

  const resetForNewVideo = () => {
    setCurrentHistoryId(null);
    setOriginalSrt('');
    setFile3Text('');
    setBaseFileName('atm_movie');
  };

  const handleSendToSoundStudio = (text: string) => {
    setSoundStudioInitialText(text);
    setActiveTab('sound');
  };

  // Sync pending items on focus or app open
  const syncAllPendingHistory = async () => {
    const key = localStorage.getItem('atm_assembly_key');
    if (!key) return;

    const pending = historyList.filter((h) => h.status === 'processing' && h.transcriptId);
    for (const item of pending) {
      try {
        const checkResp = await fetch(`https://api.assemblyai.com/v2/transcript/${item.transcriptId}`, {
          headers: { Authorization: key },
        });
        const checkData = await checkResp.json();
        if (checkData.status === 'completed') {
          const srtResp = await fetch(`https://api.assemblyai.com/v2/transcript/${item.transcriptId}/srt`, {
            headers: { Authorization: key },
          });
          const original = (await srtResp.text()).trim();
          handleUpdateHistoryItem({
            id: item.id,
            status: 'completed',
            originalSrt: original,
          });
          if (currentHistoryId === item.id) {
            setOriginalSrt(original);
          }
        }
      } catch (e) {}
    }
  };

  useEffect(() => {
    syncAllPendingHistory();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncAllPendingHistory();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#0b1120] text-slate-100">
      {/* MOBILE HEADER */}
      <header className="md:hidden bg-slate-900 border-b border-slate-800 px-3 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-slate-300 hover:text-white p-2 rounded-lg bg-slate-800 transition"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-1.5">
            <span className="font-extrabold text-white text-sm tracking-wide">
              ATM <span className="text-red-500">MOVIE</span>
            </span>
          </div>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('subtitles')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center space-x-1 ${
              activeTab === 'subtitles' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>SRT</span>
          </button>

          <button
            onClick={() => setActiveTab('sound')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center space-x-1 ${
              activeTab === 'sound'
                ? 'bg-gradient-to-r from-red-600 to-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Volume2 className={`w-3 h-3 ${isSoundGenerating ? 'text-amber-300 animate-bounce' : ''}`} />
            <span>Sound</span>
            {isSoundGenerating && (
              <span className="text-[9px] bg-amber-500/30 text-amber-300 border border-amber-500/40 px-1 rounded font-mono font-bold animate-pulse">
                {soundProgressPercent}%
              </span>
            )}
          </button>
        </div>
      </header>

      {/* LEFT SIDEBAR MENU */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewVideo={resetForNewVideo}
        historyList={historyList}
        currentHistoryId={currentHistoryId}
        onSelectHistory={handleSelectHistory}
        onDeleteHistory={handleDeleteHistory}
        onSyncHistory={syncAllPendingHistory}
      />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {/* Desktop Header Nav Switcher */}
        <div className="hidden md:flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setActiveTab('subtitles')}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeTab === 'subtitles'
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>SRT & Video (စာသား)</span>
            </button>

            <button
              onClick={() => setActiveTab('sound')}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeTab === 'sound'
                  ? 'bg-gradient-to-r from-red-600 to-indigo-600 text-white shadow-lg shadow-red-600/20'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              <Volume2 className={`w-4 h-4 ${isSoundGenerating ? 'text-amber-400 animate-bounce' : 'text-amber-300'}`} />
              <span>Edge TTS Sound</span>
              {isSoundGenerating ? (
                <span className="text-[10px] bg-amber-500/30 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono font-bold animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  <span>{soundProgressPercent}%</span>
                </span>
              ) : (
                <span className="text-[10px] bg-black/30 px-1.5 py-0.2 rounded font-mono">4 Voices</span>
              )}
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-emerald-300 font-semibold flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5" />
              <span>Cloud Background & Edge TTS</span>
            </span>
          </div>
        </div>

        {/* ACTIVE TAB CONTENT - Kept alive in DOM so background tasks and audio synthesis are never terminated */}
        <div className={activeTab === 'subtitles' ? 'block' : 'hidden'}>
          <SubtitleStudio
            onSendToSoundStudio={handleSendToSoundStudio}
            historyList={historyList}
            currentHistoryId={currentHistoryId}
            onSelectHistory={handleSelectHistory}
            onUpdateHistoryItem={handleUpdateHistoryItem}
            baseFileName={baseFileName}
            setBaseFileName={setBaseFileName}
            file3Text={file3Text}
            setFile3Text={setFile3Text}
            originalSrt={originalSrt}
            setOriginalSrt={setOriginalSrt}
          />
        </div>

        <div className={activeTab === 'sound' ? 'block' : 'hidden'}>
          <SoundStudio
            initialText={soundStudioInitialText}
            onClearInitialText={() => setSoundStudioInitialText('')}
            subtitleFile3Text={file3Text}
            onGeneratingChange={(generating, pct, msg) => {
              setIsSoundGenerating(generating);
              setSoundProgressPercent(pct);
              setSoundProgressMessage(msg || '');
            }}
          />
        </div>

        {/* Global Floating Pill when Sound is Generating in Background and user is on another tab */}
        {isSoundGenerating && activeTab !== 'sound' && (
          <div
            onClick={() => setActiveTab('sound')}
            className="fixed bottom-6 right-6 z-50 bg-slate-900/95 border-2 border-amber-500/80 rounded-2xl p-3 shadow-2xl backdrop-blur-md cursor-pointer hover:border-amber-400 transition flex items-center space-x-3 group animate-slideUp"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Volume2 className="w-4 h-4 animate-bounce" />
            </div>
            <div className="text-left pr-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white">Sound (Background အသံထုတ်နေသည်)</span>
                <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.2 rounded">
                  {soundProgressPercent}%
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                {soundProgressMessage || 'နှိပ်၍ Sound Studio သို့ သွားမည် ↗'}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
