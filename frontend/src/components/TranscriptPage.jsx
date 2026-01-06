import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL, fetchAPI } from "../api/config";

const VOICE_LANGUAGE_CODES = {
  english: "en-IN",
  hindi: "hi-IN",
  tamil: "ta-IN",
  telugu: "te-IN",
  kannada: "kn-IN",
};

function formatSecondsToHms(seconds) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) return "";

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");

  return `${hh}:${mm}:${ss}`;
}

export default function TranscriptPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { video, summary: initialSummary, language: initialLanguage } = location.state || {};
  
  const [summary, setSummary] = useState(initialSummary || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ message: "", percent: 0 });
  const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage || "english");
  const [summaryMode, setSummaryMode] = useState("full"); // 'full' or 'segment'
  const [segmentStartTime, setSegmentStartTime] = useState("");
  const [segmentEndTime, setSegmentEndTime] = useState("");
  const [videoDurationSeconds, setVideoDurationSeconds] = useState(null);
  const [segmentDefaultsApplied, setSegmentDefaultsApplied] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  
  // AI Chatbot states
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const voiceRecognitionRef = useRef(null);
  
  // Quiz loading state
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  useEffect(() => {
    if (!video) {
      navigate("/");
      return;
    }

    // Fetch video duration once so we can show it as default range end
    const fetchDuration = async () => {
      try {
        const data = await fetchAPI("/transcript/duration", {
          method: "POST",
          body: JSON.stringify({ videoUrl: video.url })
        });

        if (typeof data.durationSeconds === "number" && !Number.isNaN(data.durationSeconds)) {
          setVideoDurationSeconds(data.durationSeconds);
        }
      } catch (err) {
        console.error("Failed to fetch video duration:", err);
      }
    };

    fetchDuration();
  }, [video, navigate]);

  useEffect(() => {
    if (
      summaryMode === "segment" &&
      videoDurationSeconds != null &&
      !segmentDefaultsApplied &&
      !segmentStartTime.trim() &&
      !segmentEndTime.trim()
    ) {
      setSegmentStartTime("00:00:00");
      setSegmentEndTime(formatSecondsToHms(Math.round(videoDurationSeconds)));
      setSegmentDefaultsApplied(true);
    }
  }, [summaryMode, videoDurationSeconds, segmentDefaultsApplied, segmentStartTime, segmentEndTime]);

  const handleGenerateSummary = () => {
    if (summaryMode === "segment") {
      if (!segmentStartTime.trim() || !segmentEndTime.trim()) {
        alert("Please enter both start and end times for the summary range.");
        return;
      }
    }

    setLoading(true);
    setError(null);
    setSummary("");
    setProgress({ message: "", percent: 0 });

    const sessionId = Date.now().toString();
    
    const eventSource = new EventSource(`${API_BASE_URL}/transcript/progress/${sessionId}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setProgress(data);
      } catch (e) {
        console.error("Failed to parse progress:", e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    const payload = {
      videoUrl: video.url,
      sessionId,
      language: selectedLanguage
    };

    if (summaryMode === "segment") {
      payload.startTime = segmentStartTime;
      payload.endTime = segmentEndTime;
    }

    fetchAPI("/transcript", {
      method: "POST",
      body: JSON.stringify(payload)
    })
      .then((data) => {
        const hasError = !!data.error;
        const summaryText = hasError ? "" : data.summary;
        setSummary(summaryText);
        setError(hasError ? (data.details || data.error) : null);
        setLoading(false);
        eventSource.close();

        if (!hasError && summaryText) {
          navigate("/summary", { state: { video, summary: summaryText, language: selectedLanguage } });
        }
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
        eventSource.close();
      });
  };

  const handleGenerateQuiz = () => {
    if (!summary) {
      alert("Please generate a summary first!");
      return;
    }

    navigate("/quiz", { state: { video, summary, language: selectedLanguage } });
  };

  const handleChatSubmit = async (overrideMessage) => {
    const raw = overrideMessage ?? chatInput;
    if (!raw.trim() || !summary) return;

    const userMessage = raw.trim();
    setChatInput("");
    
    // Add user message to chat
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const data = await fetchAPI('/chat', {
        method: 'POST',
        body: JSON.stringify({ message: userMessage, context: summary, language: selectedLanguage })
      });
      
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response || 'Sorry, I encountered an error. Please try again.' 
      }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I am currently offline. Please check your connection.' 
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const startVoiceChat = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    const langCode = VOICE_LANGUAGE_CODES[selectedLanguage] || "en-IN";

    const recognition = new SpeechRecognition();
    recognition.lang = langCode;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = async (event) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      const text = transcript.trim();
      setIsVoiceRecording(false);
      if (text) {
        await handleChatSubmit(text);
      }
    };

    recognition.onerror = (event) => {
      console.error("Voice chat error:", event.error);
      setIsVoiceRecording(false);
    };

    recognition.onend = () => {
      setIsVoiceRecording(false);
    };

    voiceRecognitionRef.current = recognition;
    setIsVoiceRecording(true);
    recognition.start();
  };

  const stopVoiceChat = () => {
    const recognition = voiceRecognitionRef.current;
    if (recognition) {
      recognition.stop();
    }
  };


  const downloadSummary = () => {
    const element = document.createElement("a");
    const file = new Blob([summary], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${video.title}-summary.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const copySummary = () => {
    navigator.clipboard.writeText(summary);
    alert("Summary copied to clipboard!");
  };

  const getVideoEmbedUrl = () => {
    if (!video?.url) return null;

    if (video.url.includes('youtube.com') || video.url.includes('youtu.be')) {
      const videoId = video.url.includes('youtu.be')
        ? video.url.split('youtu.be/')[1]?.split('?')[0]
        : new URLSearchParams(new URL(video.url).search).get('v');
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (video.url.includes('vimeo.com')) {
      const videoId = video.url.split('vimeo.com/')[1]?.split('?')[0];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
    }

    return null;
  };

  const handleThumbnailClick = (e) => {
    e.preventDefault();
    setIsVideoPlaying(true);
  };

  if (!video) {
    return null;
  }

  return (
    <div className="app">
      {/* Left Sidebar */}
      <aside className="card-panel">
        <button
          className="btn btn-outline-secondary btn-sm mb-3 w-100"
          onClick={() => navigate("/")}
        >
          <i className="fa-solid fa-arrow-left me-2"></i>
          Back to Search
        </button>

        <div className="mb-3">
          {!isVideoPlaying ? (
            <div
              style={{
                position: 'relative',
                cursor: 'pointer',
                marginBottom: '1rem'
              }}
              onClick={handleThumbnailClick}
            >
              <img
                src={video.thumbnail}
                alt={video.title}
                style={{
                  width: '100%',
                  borderRadius: '12px',
                  display: 'block'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '60px',
                  height: '60px',
                  background: 'rgba(0, 0, 0, 0.7)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  pointerEvents: 'none'
                }}
              >
                <i className="fa-solid fa-play" style={{ color: 'white', fontSize: '24px', marginLeft: '4px' }}></i>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: '1rem' }}>
              <iframe
                src={getVideoEmbedUrl()}
                style={{
                  width: '100%',
                  height: '168px',
                  borderRadius: '12px',
                  border: 'none'
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
              <button
                className="btn btn-sm btn-outline-secondary mt-2 w-100"
                onClick={() => setIsVideoPlaying(false)}
              >
                <i className="fa-solid fa-image me-2"></i>
                Show Thumbnail
              </button>
            </div>
          )}
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

        <div className="panel-section">
          <h6><i className="fa-solid fa-language me-2"></i>Language</h6>
          <select
            className="form-select form-select-sm"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            disabled={loading}
          >
            <option value="english">English</option>
            <option value="hindi">Hindi</option>
            <option value="tamil">Tamil</option>
            <option value="telugu">Telugu</option>
            <option value="kannada">Kannada</option>
          </select>
        </div>

        <div className="panel-section">
          <h6><i className="fa-solid fa-clock me-2"></i>Summary Range</h6>
          <div className="form-check">
            <input
              className="form-check-input"
              type="radio"
              id="summary-range-full"
              value="full"
              checked={summaryMode === "full"}
              onChange={() => setSummaryMode("full")}
              disabled={loading}
            />
            <label className="form-check-label" htmlFor="summary-range-full" style={{ fontSize: '0.85rem' }}>
              Entire video
            </label>
          </div>
          <div className="form-check mt-1">
            <input
              className="form-check-input"
              type="radio"
              id="summary-range-segment"
              value="segment"
              checked={summaryMode === "segment"}
              onChange={() => setSummaryMode("segment")}
              disabled={loading}
            />
            <label className="form-check-label" htmlFor="summary-range-segment" style={{ fontSize: '0.85rem' }}>
              Specific time range
            </label>
          </div>

          {summaryMode === "segment" && (
            <div className="mt-2">
              <div className="mb-2">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>
                  Start time (e.g., 1:30 or 90)
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={segmentStartTime}
                  onChange={(e) => setSegmentStartTime(e.target.value)}
                  placeholder="Start time"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>
                  End time (e.g., 3:00 or 180)
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={segmentEndTime}
                  onChange={(e) => setSegmentEndTime(e.target.value)}
                  placeholder="End time"
                  disabled={loading}
                />
              </div>
            </div>
          )}
        </div>

        <div className="d-grid gap-2">
          <button
            className="btn btn-primary"
            onClick={handleGenerateSummary}
            disabled={loading}
          >
            <i className="fa-solid fa-play me-2"></i>
            {loading ? "Processing..." : "Generate Summary"}
          </button>
          
          {summary && (
            <>
              <button
                className="btn btn-success"
                onClick={() => navigate("/listen", { state: { video, summary, language: selectedLanguage } })}
              >
                <i className="fa-solid fa-headphones me-2"></i>
                Listen to Summary
              </button>
              
              <button
                className="btn btn-warning"
                onClick={handleGenerateQuiz}
                disabled={loadingQuiz}
              >
                <i className="fa-solid fa-question-circle me-2"></i>
                {loadingQuiz ? "Generating..." : "Generate Quiz"}
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="card-panel">
        <h4 className="mb-3">
          <i className="fa-solid fa-file-alt me-2" style={{color: '#667eea'}}></i>
          Transcript & Analysis
        </h4>

        {/* Progress */}
        {loading && (
          <div className="mb-4">
            <div className="d-flex align-items-center gap-2 mb-2">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className="text-muted">{progress.message || "Generating summary..."}</span>
            </div>
            <div className="progress">
              <div
                className="progress-bar"
                style={{width: `${progress.percent || 0}%`}}
              ></div>
            </div>
            <small className="text-muted">{progress.percent || 0}% complete</small>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="alert alert-danger" role="alert">
            <i className="fa-solid fa-exclamation-triangle me-2"></i>
            {error}
          </div>
        )}

        {/* Summary Display */}

      </main>

      {/* Right Panel - AI Chatbot */}
      <aside className="card-panel" style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
        <div className="panel-section" style={{borderBottom: '2px solid #e9ecef', paddingBottom: '1rem', marginBottom: '1rem'}}>
          <h6 style={{marginBottom: '0.5rem'}}>
            <i className="fa-solid fa-robot me-2" style={{color: '#667eea'}}></i>
            Edu Bot
          </h6>
          <small className="text-muted" style={{fontSize: '0.75rem'}}>
            <i className="fa-solid fa-circle text-success me-1" style={{fontSize: '0.5rem'}}></i>
            Your AI Learning Assistant
          </small>
        </div>

        {/* Chat Messages */}
        <div 
          className="panel-section" 
          style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 350px)',
            marginBottom: '1rem',
            paddingRight: '0.5rem'
          }}
        >
          {chatMessages.length === 0 ? (
            <div className="text-center text-muted py-4">
              <i className="fa-solid fa-comments" style={{fontSize: '2rem', opacity: 0.3, marginBottom: '1rem', display: 'block'}}></i>
              <small>Ask me anything about the video content!</small>
            </div>
          ) : (
            chatMessages.map((msg, idx) => (
              <div 
                key={idx} 
                className="mb-3"
                style={{
                  textAlign: msg.role === 'user' ? 'right' : 'left'
                }}
              >
                <div
                  style={{
                    display: 'inline-block',
                    maxWidth: '85%',
                    padding: '0.75rem',
                    borderRadius: '12px',
                    backgroundColor: msg.role === 'user' ? '#667eea' : '#f8f9fa',
                    color: msg.role === 'user' ? 'white' : '#333',
                    fontSize: '0.85rem',
                    lineHeight: '1.5',
                    wordWrap: 'break-word'
                  }}
                >
                  {msg.role === 'assistant' && (
                    <div style={{marginBottom: '0.25rem', opacity: 0.7, fontSize: '0.75rem'}}>
                      <i className="fa-solid fa-robot me-1"></i>Edu Bot
                    </div>
                  )}
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {chatLoading && (
            <div className="text-muted" style={{fontSize: '0.85rem'}}>
              <i className="fa-solid fa-circle-notch fa-spin me-2"></i>
              Edu Bot is thinking...
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="panel-section" style={{marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #e9ecef'}}>
          <div className="input-group input-group-sm">
            <input
              type="text"
              className="form-control"
              placeholder="Ask about the video..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !chatLoading && chatInput.trim()) {
                  handleChatSubmit();
                }
              }}
              disabled={chatLoading || !summary}
              style={{fontSize: '0.85rem'}}
            />
            <button
              className="btn btn-secondary"
              type="button"
              onClick={isVoiceRecording ? stopVoiceChat : startVoiceChat}
              disabled={chatLoading || !summary}
              style={{fontSize: '0.85rem'}}
              title="Speak your question"
            >
              <i className={`fa-solid ${isVoiceRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleChatSubmit()}
              disabled={chatLoading || !chatInput.trim() || !summary}
              style={{fontSize: '0.85rem'}}
            >
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
          {!summary && (
            <small className="text-muted d-block mt-2" style={{fontSize: '0.7rem'}}>
              Generate a summary first to enable chat
            </small>
          )}
        </div>

      </aside>
    </div>
  );
}
