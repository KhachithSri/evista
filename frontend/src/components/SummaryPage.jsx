import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SplitText from "./SplitText";

export default function SummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { video, summary, language } = location.state || {};
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

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
    <div className="app" style={{display: 'grid', gridTemplateColumns: '300px 1fr', gap: 0}}>
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

        <div className="mt-4 d-flex gap-2 justify-content-center flex-wrap">
          <button
            className="btn btn-primary"
            onClick={() => navigate("/listen", { state: { video, summary, language } })}
          >
            <i className="fa-solid fa-headphones me-2"></i>
            Listen to Summary
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
