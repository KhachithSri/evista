import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SplitText from "./SplitText";

const SUPPORTED_LANGUAGES = {
  en: { label: 'English', script: null },
  hi: { label: 'Hindi', script: /[\u0900-\u097F]/ },
  ta: { label: 'Tamil', script: /[\u0B80-\u0BFF]/ },
  te: { label: 'Telugu', script: /[\u0C00-\u0C7F]/ },
  kn: { label: 'Kannada', script: /[\u0C80-\u0CFF]/ }
};

const LANGUAGE_PARAM_MAP = {
  english: 'en',
  hindi: 'hi',
  tamil: 'ta',
  telugu: 'te',
  kannada: 'kn'
};

const SUPPORTED_CODES = Object.keys(SUPPORTED_LANGUAGES);

const normalizeLanguageCode = (lang) => {
  if (!lang) return null;
  const lower = lang.toLowerCase();
  if (SUPPORTED_LANGUAGES[lower]) return lower;
  if (LANGUAGE_PARAM_MAP[lower]) return LANGUAGE_PARAM_MAP[lower];
  return null;
};

export default function ListenPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { video, summary, language } = location.state || {};
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentWord, setCurrentWord] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [detectedLanguage, setDetectedLanguage] = useState('en');
  const [settingsChanged, setSettingsChanged] = useState(false);
  
  const utteranceRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  // Function to detect language from text
  const detectLanguage = (text) => {
    const sample = text.substring(0, 500).toLowerCase();

    for (const [code, { script }] of Object.entries(SUPPORTED_LANGUAGES)) {
      if (script && script.test(sample)) {
        return code;
      }
    }

    return normalizeLanguageCode(language) || 'en';
  };

  // Function to map language codes to voice language codes
  const getVoiceLangCode = (langCode) => {
    return SUPPORTED_CODES.includes(langCode) ? langCode : 'en';
  };

  // Function to get friendly language name
  const getLanguageName = (langCode) => {
    return SUPPORTED_LANGUAGES[langCode]?.label || langCode.toUpperCase();
  };

  useEffect(() => {
    // Load available voices
    const loadVoices = () => {
      const availableVoices = synthRef.current.getVoices();
      const supportedVoices = availableVoices.filter((voice) => 
        SUPPORTED_CODES.some((code) => voice.lang?.toLowerCase().startsWith(code))
      );
      const voicePool = supportedVoices.length ? supportedVoices : availableVoices;
      setVoices(voicePool);
      
      // Detect language from summary text
      const detectedLang = detectLanguage(summary);
      setDetectedLanguage(detectedLang);
      const voiceLang = getVoiceLangCode(detectedLang);
      
      // Try to find the best matching voice for the detected language
      let preferredVoice = null;
      
      // First priority: Google voices for the detected language
      preferredVoice = voicePool.find(
        voice => voice.lang.startsWith(voiceLang) && voice.name.includes('Google')
      );
      
      // Second priority: Any voice for the detected language
      if (!preferredVoice) {
        preferredVoice = voicePool.find(
          voice => voice.lang.startsWith(voiceLang)
        );
      }
      
      // Third priority: English Google voice
      if (!preferredVoice) {
        preferredVoice = voicePool.find(
          voice => voice.lang.startsWith('en') && voice.name.includes('Google')
        );
      }
      
      // Fourth priority: Any English voice
      if (!preferredVoice) {
        preferredVoice = voicePool.find(
          voice => voice.lang.startsWith('en')
        );
      }
      
      // Fallback: First available voice
      if (!preferredVoice) {
        preferredVoice = voicePool[0];
      }
      
      setSelectedVoice(preferredVoice);
      
      // Log detected language for debugging
      console.log('Detected language:', detectedLang);
      console.log('Selected voice:', preferredVoice?.name, preferredVoice?.lang);
    };

    loadVoices();
    synthRef.current.addEventListener('voiceschanged', loadVoices);

    return () => {
      synthRef.current.removeEventListener('voiceschanged', loadVoices);
      if (synthRef.current.speaking) {
        synthRef.current.cancel();
      }
    };
  }, [summary, language]);

  if (!video || !summary) {
    navigate("/");
    return null;
  }

  const handlePlay = () => {
    if (isPaused) {
      synthRef.current.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    // Cancel any ongoing speech
    synthRef.current.cancel();
    setSettingsChanged(false);

    // Create new utterance
    const utterance = new SpeechSynthesisUtterance(summary);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = volume;
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentWord(0);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        setCurrentWord(event.charIndex);
      }
    };

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  const handlePause = () => {
    synthRef.current.pause();
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    synthRef.current.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentWord(0);
    setSettingsChanged(false);
  };

  const downloadAudio = () => {
    alert("Note: Browser text-to-speech doesn't support direct audio download. Consider using a browser extension or recording software to capture the audio.");
  };

  const highlightedText = () => {
    if (currentWord === 0) return summary;
    
    const before = summary.substring(0, currentWord);
    const current = summary.substring(currentWord, currentWord + 50);
    const after = summary.substring(currentWord + 50);
    
    return (
      <>
        {before}
        <span style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '2px 4px',
          borderRadius: '4px'
        }}>
          {current}
        </span>
        {after}
      </>
    );
  };

  return (
    <div className="app" style={{display: 'grid', gridTemplateColumns: '300px 1fr', gap: 0}}>
      {/* Left Sidebar */}
      <aside className="card-panel">
        <button
          className="btn btn-outline-secondary btn-sm mb-3 w-100"
          onClick={() => navigate("/summary", { state: { video, summary, language } })}
        >
          <i className="fa-solid fa-arrow-left me-2"></i>
          Back to Summary
        </button>

        <div className="mb-3">
          <img
            src={video.thumbnail}
            alt={video.title}
            style={{
              width: '100%',
              borderRadius: '12px',
              marginBottom: '1rem'
            }}
          />
          <h6 style={{fontSize: '0.95rem', fontWeight: '600', lineHeight: '1.4'}}>
            {video.title}
          </h6>
          {video.channelTitle && (
            <p className="small text-muted mb-0">
              <i className="fa-solid fa-user me-1"></i>
              {video.channelTitle}
            </p>
          )}
        </div>

        {/* Voice Controls */}
        <div className="panel-section">
          <h6 style={{fontSize: '0.9rem', marginBottom: '1rem'}}>
            <i className="fa-solid fa-sliders me-2"></i>
            Voice Settings
          </h6>
          
          {/* Detected Language Indicator */}
          {selectedVoice && (
            <div className="mb-3 p-2" style={{
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
              borderRadius: '8px',
              border: '1px solid rgba(102, 126, 234, 0.3)'
            }}>
              <div className="small" style={{fontWeight: '600', marginBottom: '4px', color: '#667eea'}}>
                <i className="fa-solid fa-language me-1"></i>
                Auto-Detected: {getLanguageName(detectedLanguage)}
              </div>
              <div className="small text-muted">
                <i className="fa-solid fa-microphone me-1"></i>
                {selectedVoice.name}
              </div>
            </div>
          )}
          
          {/* Voice Selection */}
          <div className="mb-3">
            <label className="form-label small">Voice (Manual Override)</label>
            <select 
              className="form-select form-select-sm"
              value={selectedVoice?.name || ''}
              onChange={(e) => {
                const voice = voices.find(v => v.name === e.target.value);
                setSelectedVoice(voice);
                if (isPlaying || isPaused) {
                  setSettingsChanged(true);
                }
              }}
            >
              {voices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>

          {/* Volume Control */}
          <div className="mb-3">
            <label className="form-label small">
              Volume: {Math.round(volume * 100)}%
            </label>
            <input
              type="range"
              className="form-range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => {
                const newVolume = parseFloat(e.target.value);
                setVolume(newVolume);
                // Volume can be changed in real-time without restart
                if (utteranceRef.current) {
                  utteranceRef.current.volume = newVolume;
                }
              }}
            />
          </div>

        </div>

        {/* Quick Actions */}
        <div className="d-grid gap-2">
          <button
            className="btn btn-success btn-sm"
            onClick={() => navigate("/quiz", { state: { video, summary, language } })}
          >
            <i className="fa-solid fa-question-circle me-2"></i>
            Take Quiz
          </button>
          
          <button
            className="btn btn-info btn-sm"
            onClick={() => navigate("/flashcards-summary", { state: { video, summary, language } })}
          >
            <i className="fa-solid fa-layer-group me-2"></i>
            View Flashcards
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="card-panel">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <SplitText
            text="Listen to Summary"
            tag="h4"
            delay={40}
            duration={0.6}
            ease="power3.out"
            splitType="chars"
            from={{ opacity: 0, y: 30 }}
            to={{ opacity: 1, y: 0 }}
            threshold={0.9}
            rootMargin="0px"
            textAlign="left"
          />
        </div>

        {/* Audio Player Controls */}
        <div 
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '2rem',
            borderRadius: '16px',
            marginBottom: '2rem',
            color: 'white',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
            {isPlaying ? '🎵' : isPaused ? '⏸️' : '🎧'}
          </div>
          
          <div className="d-flex justify-content-center gap-3 mb-3">
            {!isPlaying && !isPaused && (
              <button 
                className="btn btn-light btn-lg"
                onClick={handlePlay}
              >
                <i className="fa-solid fa-play me-2"></i>
                Play
              </button>
            )}
            
            {isPlaying && (
              <button 
                className="btn btn-light btn-lg"
                onClick={handlePause}
              >
                <i className="fa-solid fa-pause me-2"></i>
                Pause
              </button>
            )}
            
            {isPaused && (
              <button 
                className="btn btn-light btn-lg"
                onClick={handlePlay}
              >
                <i className="fa-solid fa-play me-2"></i>
                Resume
              </button>
            )}
            
            {(isPlaying || isPaused) && (
              <button 
                className="btn btn-outline-light btn-lg"
                onClick={handleStop}
              >
                <i className="fa-solid fa-stop me-2"></i>
                Stop
              </button>
            )}
          </div>

          <div className="small" style={{ opacity: 0.9 }}>
            {isPlaying && "Now playing..."}
            {isPaused && "Paused"}
            {!isPlaying && !isPaused && "Ready to play"}
          </div>
        </div>

        {/* Summary Text with Highlighting */}
        <div
          style={{
            background: '#f8f9fa',
            padding: '2rem',
            borderRadius: '16px',
            lineHeight: '1.8',
            whiteSpace: 'pre-wrap',
            fontSize: '1.05rem',
            maxHeight: 'calc(100vh - 450px)',
            overflowY: 'auto'
          }}
        >
          {isPlaying || isPaused ? highlightedText() : summary}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 d-flex gap-2 justify-content-center flex-wrap">
          <button
            className="btn btn-outline-secondary"
            onClick={downloadAudio}
          >
            <i className="fa-solid fa-download me-2"></i>
            Download Info
          </button>
          
          <button
            className="btn btn-success"
            onClick={() => navigate("/quiz", { state: { video, summary, language } })}
          >
            <i className="fa-solid fa-question-circle me-2"></i>
            Take Quiz
          </button>
          
          <button
            className="btn btn-info"
            onClick={() => navigate("/flashcards-summary", { state: { video, summary, language } })}
          >
            <i className="fa-solid fa-layer-group me-2"></i>
            Generate Flashcards
          </button>
        </div>
      </main>
    </div>
  );
}
