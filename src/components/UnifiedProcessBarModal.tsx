import React from 'react';
import {
  Sparkles,
  Zap,
  Film,
  CheckCircle,
  AlertCircle,
  FileText,
  Volume2,
  X,
  Minimize2,
} from 'lucide-react';

export type ProcessType = 'extract_text' | 'generate_voice' | 'render_video';

export interface ProcessBarState {
  isOpen: boolean;
  type: ProcessType;
  title: string;
  stageName: string;
  currentStep: number;
  totalSteps: number;
  percent: number; // 0 to 100
  detailMessage: string;
  isComplete: boolean;
  error?: string | null;
  onCancel?: () => void;
  onClose?: () => void;
  onMinimize?: () => void;
}

interface UnifiedProcessBarModalProps {
  state: ProcessBarState;
}

export const UnifiedProcessBarModal: React.FC<UnifiedProcessBarModalProps> = ({ state }) => {
  if (!state.isOpen) return null;

  const getIcon = () => {
    switch (state.type) {
      case 'extract_text':
        return <FileText className="w-5 h-5 text-indigo-400" />;
      case 'generate_voice':
        return <Volume2 className="w-5 h-5 text-emerald-400" />;
      case 'render_video':
        return <Film className="w-5 h-5 text-rose-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-blue-400" />;
    }
  };

  const getGradient = () => {
    switch (state.type) {
      case 'extract_text':
        return 'from-indigo-600 via-purple-600 to-pink-600';
      case 'generate_voice':
        return 'from-emerald-500 via-teal-500 to-cyan-600';
      case 'render_video':
        return 'from-rose-600 via-red-600 to-amber-600';
      default:
        return 'from-blue-600 to-indigo-600';
    }
  };

  const safePercent = Math.min(100, Math.max(0, Math.round(state.percent)));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-slate-700/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden space-y-5">
        {/* Glow ambient background */}
        <div
          className={`absolute -top-24 -right-24 w-60 h-60 rounded-full blur-3xl opacity-20 pointer-events-none bg-gradient-to-br ${getGradient()}`}
        />

        {/* Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-lg">
              {getIcon()}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">{state.title}</h3>
              <p className="text-xs text-slate-400">{state.stageName}</p>
            </div>
          </div>

          {/* Close or Minimize Actions */}
          <div className="flex items-center space-x-1.5">
            {!state.isComplete && state.onMinimize && (
              <button
                onClick={state.onMinimize}
                className="px-2.5 py-1 text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold flex items-center space-x-1 transition"
                title="Background တွင် ဆက်လက်လုပ်ဆောင်မည် (Minimize)"
              >
                <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Background သို့</span>
              </button>
            )}
            {state.isComplete && state.onClose && (
              <button
                onClick={state.onClose}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Large Percentage Metric */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-center space-y-1 relative z-10">
          <div className="flex items-baseline justify-center space-x-1">
            <span className="text-4xl md:text-5xl font-black font-mono tracking-tight text-white drop-shadow-md">
              {safePercent}
            </span>
            <span className="text-xl md:text-2xl font-black text-amber-400">%</span>
          </div>

          <div className="flex items-center justify-center space-x-2 text-xs text-slate-400">
            {state.totalSteps > 0 && (
              <span className="bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded-full font-mono font-bold text-slate-300">
                အဆင့် {state.currentStep} / {state.totalSteps}
              </span>
            )}
            <span className="text-slate-500">•</span>
            {state.error ? (
              <span className="text-rose-400 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>အမှားဖြစ်ပေါ်ခဲ့သည်</span>
              </span>
            ) : (
              <span className={state.isComplete ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                {state.isComplete ? '၁၀၀% ပြီးစီးပါပြီ' : 'လုပ်ဆောင်နေဆဲ'}
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar (High Visibility) */}
        <div className="space-y-1.5 relative z-10">
          <div className="w-full bg-slate-950 border border-slate-800 h-4 rounded-full p-0.5 overflow-hidden shadow-inner">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${getGradient()} transition-all duration-300 relative shadow-lg`}
              style={{ width: `${safePercent}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
            </div>
          </div>

          <div className="flex justify-between items-center text-[11px] text-slate-400 px-1 font-mono">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Current Detailed Message */}
        <div className="bg-black/50 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 font-medium flex items-center space-x-2 relative z-10">
          {!state.isComplete && !state.error && (
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
          )}
          {state.isComplete && !state.error && (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          {state.error && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          <span className="leading-relaxed">
            {state.error ? state.error : state.detailMessage || 'ကျေးဇူးပြု၍ ခေတ္တစောင့်ဆိုင်းပေးပါခင်ဗျာ...'}
          </span>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between space-x-2 pt-2 relative z-10">
          {!state.isComplete && state.onMinimize ? (
            <button
              onClick={state.onMinimize}
              className="px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center space-x-1.5 shadow"
            >
              <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Background တွင် ဆက်လက်လုပ်မည်</span>
            </button>
          ) : (
            <div />
          )}

          {state.isComplete ? (
            <button
              onClick={state.onClose}
              className={`py-2.5 px-6 rounded-xl text-xs font-bold transition shadow-lg flex items-center justify-center space-x-2 ${
                state.error
                  ? 'bg-rose-700 hover:bg-rose-600 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {state.error ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              <span>{state.error ? 'ပိတ်မည် (ပြန်လည်ကြိုးစားရန်)' : 'ကောင်းပြီ (ပြီးစီးပါပြီ)'}</span>
            </button>
          ) : (
            state.onCancel && (
              <button
                onClick={state.onCancel}
                className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                ရပ်တန့်မည်
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
