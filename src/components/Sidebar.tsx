import React from 'react';
import {
  Film,
  X,
  Plus,
  Clock,
  RotateCw,
  Trash2,
  CheckCircle,
  Volume2,
  FileText,
  Zap,
} from 'lucide-react';
import { SubtitleHistoryItem } from '../types';
import { EDGE_VOICE_PRESETS } from '../constants/voices';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'subtitles' | 'sound';
  setActiveTab: (tab: 'subtitles' | 'sound') => void;
  onNewVideo: () => void;
  historyList: SubtitleHistoryItem[];
  currentHistoryId: string | null;
  onSelectHistory: (id: string) => void;
  onDeleteHistory: (id: string, e: React.MouseEvent) => void;
  onSyncHistory: () => void;
  onSelectQuickVoice?: (voiceId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  onNewVideo,
  historyList,
  currentHistoryId,
  onSelectHistory,
  onDeleteHistory,
  onSyncHistory,
  onSelectQuickVoice,
}) => {
  return (
    <>
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 w-72 h-screen bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-red-600 text-white p-2 rounded-xl shadow-lg shadow-red-600/30">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wide text-white">
                ATM <span className="text-red-500">MOVIE</span>
              </h1>
              <p className="text-[10px] text-slate-400">Cloud Background & Edge TTS</p>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PRIMARY MENU NAVIGATION TABS */}
        <div className="p-3 border-b border-slate-800 space-y-1.5">
          <p className="text-[10px] uppercase font-bold text-slate-400 px-1 mb-1 tracking-wider">Menu စာရင်း</p>

          <button
            onClick={() => {
              setActiveTab('subtitles');
              if (window.innerWidth < 768) onClose();
            }}
            className={`w-full text-left font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-between ${
              activeTab === 'subtitles'
                ? 'bg-red-600 text-white shadow-lg'
                : 'bg-slate-800/40 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <FileText className="w-4 h-4" />
              <span>Subtitle & SRT (စာသား)</span>
            </div>
            <span className="text-[10px] text-slate-400">Step 1-3</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('sound');
              if (window.innerWidth < 768) onClose();
            }}
            className={`w-full text-left font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-between ${
              activeTab === 'sound'
                ? 'bg-gradient-to-r from-red-600 to-indigo-600 text-white shadow-lg shadow-red-600/20'
                : 'bg-slate-800/40 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Volume2 className="w-4 h-4 text-amber-300" />
              <span>Edge TTS Sound (အသံသွင်း)</span>
            </div>
            <span className="text-[10px] bg-red-500/30 text-amber-300 px-1.5 py-0.5 rounded font-extrabold">
              ⚡ 4 Voices
            </span>
          </button>

          <button
            onClick={() => {
              onNewVideo();
              setActiveTab('subtitles');
              if (window.innerWidth < 768) onClose();
            }}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2 px-3 rounded-xl text-xs transition flex items-center justify-center space-x-1.5 border border-slate-700/60 mt-1"
          >
            <Plus className="w-3.5 h-3.5 text-red-400" />
            <span>Video အသစ်တင်မည်</span>
          </button>
        </div>

        {/* QUICK SOUND PRESET VOICES IN MENU */}
        <div className="px-3 py-2 border-b border-slate-800 bg-slate-950/40">
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider flex items-center justify-between">
            <span>Microsoft Edge အသံများ</span>
            <span className="text-red-400 text-[10px]">Multilingual</span>
          </p>
          <div className="space-y-1">
            {EDGE_VOICE_PRESETS.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setActiveTab('sound');
                  if (onSelectQuickVoice) onSelectQuickVoice(v.id);
                  if (window.innerWidth < 768) onClose();
                }}
                className="w-full text-left p-1.5 rounded-lg hover:bg-slate-800 transition flex items-center justify-between text-[11px] group"
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-red-500 group-hover:scale-125 transition-transform"></span>
                  <span className="text-slate-200 font-semibold truncate group-hover:text-white">
                    {v.characterName}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-amber-300/80 bg-slate-900 px-1 rounded border border-slate-800">
                  {v.badge}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* History List Header */}
        <div className="px-4 py-2 flex items-center justify-between bg-slate-950/60 border-b border-slate-800/80">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1.5 text-red-400" />
            <span>History မှတ်တမ်း</span>
          </span>
          <button
            onClick={onSyncHistory}
            className="text-[11px] text-emerald-400 hover:underline flex items-center"
            title="Refresh Status"
          >
            <RotateCw className="w-3 h-3 mr-1" />
            <span>Sync</span>
          </button>
        </div>

        {/* History Items Container */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {historyList.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">မှတ်တမ်း မရှိသေးပါ</div>
          ) : (
            historyList.map((item) => {
              const isActive = item.id === currentHistoryId;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectHistory(item.id);
                    if (window.innerWidth < 768) onClose();
                  }}
                  className={`p-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 cursor-pointer transition flex flex-col justify-between ${
                    isActive ? 'history-item-active' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-slate-200 truncate">{item.fileName}</p>
                    <button
                      onClick={(e) => onDeleteHistory(item.id, e)}
                      className="text-slate-500 hover:text-red-400 text-xs p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-slate-400">{item.dateStr}</span>
                    {item.status === 'completed' ? (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>ပြီးဆုံး</span>
                      </span>
                    ) : item.status === 'processing' ? (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                        Background
                      </span>
                    ) : (
                      <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">Error</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer Info */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-[11px] text-slate-400 leading-relaxed">
          <div className="flex items-center text-emerald-400 font-semibold mb-1">
            <Zap className="w-3.5 h-3.5 mr-1" />
            <span>ဖုန်းပိတ်ထားလည်း အလုပ်လုပ်သည်</span>
          </div>
          Upload တင်ပြီးသည်နှင့် စာမျက်နှာမှ ထွက်သွားနိုင်ပါသည်။ ပြန်ဝင်လာချိန် History တွင် အသင့် ရရှိပါမည်။
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 md:hidden transition-opacity"
        ></div>
      )}
    </>
  );
};
