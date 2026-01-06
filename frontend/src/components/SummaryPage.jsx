import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SplitText from "./SplitText";
import { fetchAPI } from "../api/config";

export default function SummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { video, summary, language } = location.state || {};
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Edu Bot chat state (same behavior as TranscriptPage)
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  if (!video || !summary) {
    navigate("/");
    return null;
  }

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

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || !summary) return;

    const userMessage = chatInput.trim();
    setChatInput("");

    // Add user message to chat
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setChatLoading(true);

    try {
      const data = await fetchAPI("/chat", {
        method: "POST",
        body: JSON.stringify({
          message: userMessage,
          context: summary,
          language: language || "english"
        })
      });

      setChatMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: data.response || "Sorry, I encountered an error. Please try again."
        }
      ]);
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I am currently offline. Please check your connection."
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Extract video ID from URL for embedding
  const getVideoEmbedUrl = () => {
    if (!video.url) return null;
    
    // YouTube
    if (video.url.includes('youtube.com') || video.url.includes('youtu.be')) {
      const videoId = video.url.includes('youtu.be') 
        ? video.url.split('youtu.be/')[1]?.split('?')[0]
        : new URLSearchParams(new URL(video.url).search).get('v');
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }
    
    // Vimeo
    if (video.url.includes('vimeo.com')) {
      const videoId = video.url.split('vimeo.com/')[1]?.split('?')[0];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
    }
    
    return null;
  };

  const handleThumbnailClick = (e) => {
    e.preventDefault();
    console.log('Thumbnail clicked, video URL:', video.url);
    console.log('Embed URL:', getVideoEmbedUrl());
    setIsVideoPlaying(true);
  };

  return (
    <div className="app">
      {/* Left Sidebar */}
      <aside className="card-panel">
        <button
          className="btn btn-outline-secondary btn-sm mb-3 w-100"
          onClick={() => navigate("/transcript", { state: { video, summary, language } })}
        >
          <i className="fa-solid fa-arrow-left me-2"></i>
          Back to Video
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

        <div className="d-grid gap-2">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate("/listen", { state: { video, summary, language } })}
          >
            <i className="fa-solid fa-headphones me-2"></i>
            Listen to Summary
          </button>
          
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
            text="Summary"
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
            padding: '2rem',
            borderRadius: '16px',
            lineHeight: '1.8',
            whiteSpace: 'pre-wrap',
            fontSize: '1.05rem',
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto'
          }}
        >
          {summary}
        </div>
      </main>

      {/* Right Panel - Edu Bot */}
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
              <small>Ask me anything about the summary or video content!</small>
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
              placeholder="Ask about the summary..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !chatLoading && chatInput.trim()) {
                  handleChatSubmit();
                }
              }}
              disabled={chatLoading}
              style={{fontSize: '0.85rem'}}
            />
            <button
              className="btn btn-primary"
              onClick={handleChatSubmit}
              disabled={chatLoading || !chatInput.trim()}
              style={{fontSize: '0.85rem'}}
            >
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>

      </aside>
    </div>
  );
}
