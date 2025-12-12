import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SplitText from "./SplitText";
import { fetchAPI } from "../api/config";

export default function HomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("english");
  const [darkMode, setDarkMode] = useState(false);
  const [inputMode, setInputMode] = useState("search");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const data = await fetchAPI("/search", {
        method: "POST",
        body: JSON.stringify({ query: searchQuery })
      });
      setVideos(data.videos || []);
    } catch (error) {
      console.error("Search error:", error);
      alert("Failed to search videos");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeUrl = () => {
    if (!youtubeUrl.trim()) {
      alert("Please enter a YouTube URL");
      return;
    }
    
    navigate("/transcript", {
      state: {
        video: {
          title: "YouTube Video",
          url: youtubeUrl,
          thumbnail: "https://img.youtube.com/vi/default/hqdefault.jpg",
        },
      },
    });
  };

  const handleVideoSelect = (video) => {
    navigate("/transcript", { state: { video } });
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.body.classList.toggle("dark-mode");
  };

  return (
    <div style={{minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'}}>
      <div style={{maxWidth: '900px', width: '100%'}}>
        {/* User Menu */}
        <div style={{ position: 'absolute', top: '2rem', right: '2rem' }}>
          {user ? (
            <div className="d-flex gap-2 align-items-center">
              <button
                onClick={() => navigate("/profile")}
                className="btn btn-light"
                style={{ borderRadius: '12px', fontWeight: '600' }}
              >
                <i className="fa-solid fa-user-circle me-2"></i>
                {user.displayName}
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="btn btn-light"
              style={{ borderRadius: '12px', fontWeight: '600' }}
            >
              <i className="fa-solid fa-sign-in-alt me-2"></i>
              Login
            </button>
          )}
        </div>

        {/* Header */}
        <div className="text-center mb-5">
          <div style={{display: 'inline-flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem'}}>
            <div style={{
              width: '70px',
              height: '70px',
              background: 'white',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}>
              <i className="fa-solid fa-graduation-cap" style={{fontSize: '2.5rem', color: '#667eea'}}></i>
            </div>
            <div style={{textAlign: 'left'}}>
              <SplitText
                text="EVISTA"
                tag="h1"
                className=""
                delay={50}
                duration={0.8}
                ease="power3.out"
                splitType="chars"
                from={{ opacity: 0, y: 50, rotationX: -90 }}
                to={{ opacity: 1, y: 0, rotationX: 0 }}
                threshold={0.8}
                rootMargin="0px"
                textAlign="left"
                style={{color: 'white', fontWeight: '800', fontSize: '3rem', margin: 0, letterSpacing: '-1px'}}
              />
              <SplitText
                text="Educational Video Insight Search, Translation and Abstraction"
                tag="p"
                className=""
                delay={30}
                duration={0.6}
                ease="power2.out"
                splitType="words"
                from={{ opacity: 0, y: 20 }}
                to={{ opacity: 1, y: 0 }}
                threshold={0.8}
                rootMargin="0px"
                textAlign="left"
                style={{color: 'rgba(255,255,255,0.9)', margin: 0, fontSize: '0.95rem', fontWeight: '500'}}
              />
            </div>
          </div>
        </div>

        {/* Main Search Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '24px',
          padding: '3rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          marginBottom: '2rem'
        }}>
          {/* Toggle Buttons */}
          <div className="d-flex gap-3 mb-4 justify-content-center">
            <button
              className={`btn btn-lg ${inputMode === "search" ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setInputMode("search")}
              style={{
                minWidth: '180px',
                borderRadius: '12px',
                fontWeight: '600',
                padding: '0.75rem 2rem'
              }}
            >
              <i className="fa-solid fa-search me-2"></i>
              Search Videos
            </button>
            <button
              className={`btn btn-lg ${inputMode === "url" ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setInputMode("url")}
              style={{
                minWidth: '180px',
                borderRadius: '12px',
                fontWeight: '600',
                padding: '0.75rem 2rem'
              }}
            >
              <i className="fa-solid fa-link me-2"></i>
              Paste URL
            </button>
          </div>

          {/* Input Area */}
          {inputMode === "search" ? (
            <div>
              <div className="input-group input-group-lg mb-3">
                <span className="input-group-text" style={{background: '#f8f9fa', border: '2px solid #e9ecef', borderRadius: '12px 0 0 12px'}}>
                  <i className="fa-solid fa-search" style={{color: '#667eea'}}></i>
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search for educational videos... (e.g., Machine Learning, Physics, History)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  style={{
                    border: '2px solid #e9ecef',
                    borderLeft: 'none',
                    borderRadius: '0 12px 12px 0',
                    fontSize: '1.1rem',
                    padding: '0.75rem 1.5rem'
                  }}
                />
              </div>
              <button
                className="btn btn-primary btn-lg w-100"
                onClick={handleSearch}
                disabled={loading}
                style={{
                  borderRadius: '12px',
                  fontWeight: '600',
                  padding: '0.875rem',
                  fontSize: '1.1rem'
                }}
              >
                <i className="fa-solid fa-search me-2"></i>
                {loading ? "Searching..." : "Search Educational Videos"}
              </button>
            </div>
          ) : (
            <div>
              <div className="input-group input-group-lg mb-3">
                <span className="input-group-text" style={{background: '#f8f9fa', border: '2px solid #e9ecef', borderRadius: '12px 0 0 12px'}}>
                  <i className="fa-solid fa-link" style={{color: '#667eea'}}></i>
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Paste YouTube URL here... (e.g., https://youtube.com/watch?v=...)"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAnalyzeUrl()}
                  style={{
                    border: '2px solid #e9ecef',
                    borderLeft: 'none',
                    borderRadius: '0 12px 12px 0',
                    fontSize: '1.1rem',
                    padding: '0.75rem 1.5rem'
                  }}
                />
              </div>
              <button
                className="btn btn-success btn-lg w-100"
                onClick={handleAnalyzeUrl}
                style={{
                  borderRadius: '12px',
                  fontWeight: '600',
                  padding: '0.875rem',
                  fontSize: '1.1rem'
                }}
              >
                <i className="fa-solid fa-play me-2"></i>
                Analyze Video
              </button>
            </div>
          )}

        </div>

        {/* Quick Action - Flashcards */}
        <div className="text-center mb-4">
          <button
            className="btn btn-lg"
            onClick={() => navigate("/flashcards")}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              borderRadius: '16px',
              fontWeight: '600',
              padding: '0.875rem 2.5rem',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
            }}
          >
            <i className="fa-solid fa-layer-group me-2"></i>
            Create Flashcards
          </button>
        </div>

        {/* Video Results */}
        {videos.length > 0 && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '24px',
            padding: '2rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h5 className="mb-4" style={{fontWeight: '700', color: 'white'}}>
              <i className="fa-solid fa-video me-2" style={{color: 'white'}}></i>
              Search Results ({videos.length} videos)
            </h5>
            <div className="row g-4">
              {videos.map((video, index) => (
                <div key={index} className="col-md-6 col-lg-4">
                  <div
                    className="card h-100"
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      border: 'none',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                    onClick={() => handleVideoSelect(video)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-8px)';
                      e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                    }}
                  >
                    <img
                      src={video.thumbnail}
                      className="card-img-top"
                      alt={video.title}
                      style={{height: '200px', objectFit: 'cover'}}
                    />
                    <div className="card-body">
                      <h6 className="card-title" style={{
                        fontSize: '1rem',
                        fontWeight: '600',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        marginBottom: '0.75rem'
                      }}>
                        {video.title}
                      </h6>
                      <p className="card-text small text-muted mb-2">
                        <i className="fa-solid fa-user me-1"></i>
                        {video.channelTitle || 'Unknown Channel'}
                      </p>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="badge" style={{background: '#667eea', padding: '0.5rem 1rem'}}>
                          <i className="fa-solid fa-play me-1"></i>
                          Analyze
                        </span>
                        <small className="text-muted">
                          <i className="fa-solid fa-clock me-1"></i>
                          {video.duration || 'N/A'}
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
