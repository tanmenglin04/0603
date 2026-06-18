import React, { useState } from 'react';
import { Volume2, VolumeX, Music, Megaphone, Settings } from 'lucide-react';
import { useAudioStore } from '../store/useAudioStore';
import { useAudio } from '../audio/AudioContext';
import { cn } from '../lib/utils';

const Slider: React.FC<{
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  accentColor?: string;
}> = ({ label, icon, value, onChange, disabled, accentColor = 'text-game-gold' }) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn(accentColor, disabled && 'opacity-50')}>{icon}</span>
          <span className={cn('text-sm font-medium', disabled && 'opacity-50')}>{label}</span>
        </div>
        <span className="text-xs text-gray-400 tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <div className="relative h-2 bg-gray-700/50 rounded-full overflow-hidden">
        <div
          className={cn(
            'absolute left-0 top-0 h-full rounded-full transition-all duration-150',
            'bg-gradient-to-r from-game-gold/60 to-game-gold',
            disabled && 'opacity-30'
          )}
          style={{ width: `${value * 100}%` }}
        />
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(value * 100)}
          onChange={(e) => onChange(parseInt(e.target.value) / 100)}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
};

export const AudioPanel: React.FC<{ className?: string }> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { settings, setMasterVolume, setMusicVolume, setSfxVolume, setMuted } = useAudioStore();
  const { playUIButton, playUIClick, resumeAudio } = useAudio();

  const handleToggle = async () => {
    await resumeAudio();
    if (!isOpen) {
      playUIButton();
    } else {
      playUIClick();
    }
    setIsOpen(!isOpen);
  };

  const handleMasterChange = (v: number) => {
    playUIClick();
    setMasterVolume(v);
  };

  const handleMusicChange = (v: number) => {
    setMusicVolume(v);
  };

  const handleSfxChange = (v: number) => {
    setSfxVolume(v);
  };

  const handleMuteToggle = () => {
    if (!settings.muted) {
      playUIClick();
    }
    setMuted(!settings.muted);
  };

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={handleToggle}
        className={cn(
          'relative p-2.5 rounded-xl transition-all duration-200',
          'bg-gray-800/60 backdrop-blur-sm border border-gray-700/50',
          'hover:bg-gray-700/60 hover:border-game-gold/40 hover:shadow-lg hover:shadow-game-gold/5',
          'active:scale-95',
          isOpen && 'bg-gray-700/80 border-game-gold/50'
        )}
        title={settings.muted ? '已静音' : '音频设置'}
      >
        {settings.muted ? (
          <VolumeX className="w-5 h-5 text-gray-400" />
        ) : (
          <Volume2 className="w-5 h-5 text-game-gold" />
        )}
        {settings.muted && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-gray-900" />
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              playUIClick();
              setIsOpen(false);
            }}
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-72 p-4 space-y-5 rounded-2xl bg-gray-900/95 backdrop-blur-md border border-gray-700/60 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-700/50">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-game-gold" />
                <h3 className="font-semibold text-white">音频设置</h3>
              </div>
              <button
                onClick={handleMuteToggle}
                className={cn(
                  'p-2 rounded-lg transition-all duration-200',
                  settings.muted
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                )}
                title={settings.muted ? '取消静音' : '静音'}
              >
                {settings.muted ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
            </div>

            <div className="space-y-5">
              <Slider
                label="主音量"
                icon={<Volume2 className="w-4 h-4" />}
                value={settings.muted ? 0 : settings.masterVolume}
                onChange={handleMasterChange}
                disabled={settings.muted}
              />
              <Slider
                label="音乐"
                icon={<Music className="w-4 h-4" />}
                value={settings.muted ? 0 : settings.musicVolume}
                onChange={handleMusicChange}
                disabled={settings.muted}
                accentColor="text-blue-400"
              />
              <Slider
                label="音效"
                icon={<Megaphone className="w-4 h-4" />}
                value={settings.muted ? 0 : settings.sfxVolume}
                onChange={handleSfxChange}
                disabled={settings.muted}
                accentColor="text-green-400"
              />
            </div>

            <div className="pt-2 border-t border-gray-700/50">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="inline-block w-2 h-2 rounded-full bg-game-gold/60" />
                设置自动保存到本地
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AudioPanel;
