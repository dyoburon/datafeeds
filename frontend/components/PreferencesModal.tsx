import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Available content types (should match backend CONTENT_TYPES)
const CONTENT_TYPES = [
  {
    id: 'quantitative_analysis',
    name: 'Quantitative Analysis',
    description: 'AI-generated backtested questions and statistical analysis of market conditions.',
    icon: '📊',
  },
  {
    id: 'headlines',
    name: 'Market Headlines',
    description: 'Curated daily news headlines and market-moving events.',
    icon: '📰',
  },
  {
    id: 'market_overview',
    name: 'Market Overview',
    description: 'Daily summary of major indices, sector performance, and key metrics.',
    icon: '📈',
  },
  {
    id: 'watchlist_news',
    name: 'Watchlist Updates',
    description: 'Daily news and performance updates for stocks in your personal watchlist.',
    icon: '👁️',
  },
];

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  isFirstTime?: boolean;
}

export default function PreferencesModal({ isOpen, onClose, isFirstTime = false }: PreferencesModalProps) {
  const { backendUser, updatePreferences, dismissNewUserFlag } = useAuth();
  const [selectedPrefs, setSelectedPrefs] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Initialize with current preferences or all selected for new users
  useEffect(() => {
    if (backendUser?.preferences) {
      setSelectedPrefs(new Set(backendUser.preferences));
    } else {
      // Default: all selected
      setSelectedPrefs(new Set(CONTENT_TYPES.map(ct => ct.id)));
    }
  }, [backendUser]);

  const togglePreference = (id: string) => {
    setSelectedPrefs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePreferences(Array.from(selectedPrefs));
      dismissNewUserFlag();
      onClose();
    } catch (err) {
      console.error('Failed to save preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={isFirstTime ? undefined : onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 overflow-hidden">
        {/* Header gradient */}
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
        
        <div className="p-8">
          {/* Title */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">
              {isFirstTime ? 'Welcome! Set Your Preferences' : 'Email Preferences'}
            </h2>
            <p className="text-gray-400 text-sm">
              {isFirstTime 
                ? 'Choose what content you want in your daily market briefing.'
                : 'Update what content you receive in your daily emails.'
              }
            </p>
          </div>

          {/* Content type checkboxes */}
          <div className="space-y-3 mb-8">
            {CONTENT_TYPES.map((ct) => {
              const isSelected = selectedPrefs.has(ct.id);
              
              return (
                <button
                  key={ct.id}
                  onClick={() => togglePreference(ct.id)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-start gap-4 ${
                    isSelected 
                      ? 'border-teal-500 bg-teal-900/20' 
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  {/* Checkbox */}
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                    isSelected 
                      ? 'bg-teal-500 text-white' 
                      : 'bg-gray-700 border border-gray-600'
                  }`}>
                    {isSelected && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{ct.icon}</span>
                      <span className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                        {ct.name}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {ct.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            {!isFirstTime && (
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-gray-800 text-gray-300 rounded-lg font-semibold hover:bg-gray-700 transition-colors border border-gray-700"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || selectedPrefs.size === 0}
              className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-teal-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-900/30"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </span>
              ) : (
                isFirstTime ? 'Get Started' : 'Save Preferences'
              )}
            </button>
          </div>

          {selectedPrefs.size === 0 && (
            <p className="text-center text-yellow-500 text-sm mt-4">
              Please select at least one content type.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

