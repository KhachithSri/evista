import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL, fetchAPI } from "../api/config";

export default function TranscriptPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { video } = location.state || {};
  
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ message: "", percent: 0 });
  const [selectedLanguage, setSelectedLanguage] = useState("english");
  
  // AI Chatbot states
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  
  // Quiz loading state
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  useEffect(() => {
    if (!video) {
      navigate("/");
      return;
    }
  }, [video, navigate]);

  const handleGenerateSummary = () => {
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

    fetchAPI("/transcript", {
      method: "POST",
      body: JSON.stringify({ videoUrl: video.url, sessionId, language: selectedLanguage })
    })
      .then((data) => {
        setSummary(data.error ? "" : data.summary);
        setError(data.error ? (data.details || data.error) : null);
        setLoading(false);
        eventSource.close();
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

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || !summary) return;

    const userMessage = chatInput.trim();
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
        {summary && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5><i className="fa-solid fa-file-text me-2"></i>Summary</h5>
              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={downloadSummary}>
                  <i className="fa-solid fa-download me-1"></i>Download
                </button>
                <button className="btn btn-sm btn-outline-secondary" onClick={copySummary}>
                  <i className="fa-solid fa-copy me-1"></i>Copy
                </button>
              </div>
            </div>
            <div
              style={{
                background: '#f8f9fa',
                padding: '1.5rem',
                borderRadius: '12px',
                lineHeight: '1.8',
                whiteSpace: 'pre-wrap',
                maxHeight: '600px',
                overflowY: 'auto'
              }}
            >
              {summary}
            </div>
          </div>
        )}

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
              className="btn btn-primary"
              onClick={handleChatSubmit}
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
