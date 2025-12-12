import { useState } from "react";
import { useNavigate } from "react-router-dom";

const ITEMS_PER_PAGE = 10;

function VideoCard({ video, index, globalIndex }) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const getEmbedUrl = (url, platform) => {
    if (platform === "YouTube") {
      const videoId = url.split("v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    } else if (platform === "Vimeo") {
      const videoId = url.split("/").pop();
      return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
    }
    return url;
  };

  const platformColor = video.platform === "YouTube" ? "#FF0000" : "#1AB7EA";

  return (
    <div
      style={{
        display: "flex",
        gap: "1rem",
        padding: "1rem",
        border: "1px solid #ddd",
        borderRadius: "8px",
        backgroundColor: "#fff",
        transition: "all 0.3s ease",
        transform: isHovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: isHovered ? "0 6px 16px rgba(0,0,0,0.15)" : "0 2px 4px rgba(0,0,0,0.08)",
        cursor: "pointer",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPlaying(false);
      }}
    >
      <div
        style={{
          position: "relative",
          width: "280px",
          minWidth: "280px",
          height: "157px",
          borderRadius: "6px",
          overflow: "hidden",
          backgroundColor: "#000",
        }}
      >
        {isPlaying ? (
          <iframe
            src={getEmbedUrl(video.url, video.platform)}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
            }}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        ) : (
          <>
            <img
              src={video.thumbnail || "https://via.placeholder.com/280x157?text=No+Thumbnail"}
              alt={video.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            {video.timestamp && (
              <div
                style={{
                  position: "absolute",
                  right: "8px",
                  bottom: "8px",
                  padding: "2px 6px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#fff",
                  backgroundColor: "rgba(0,0,0,0.7)",
                  borderRadius: "4px",
                }}
              >
                {video.timestamp}
              </div>
            )}
            {isHovered && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPlaying(true);
                }}
              >
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: "20px solid #000",
                    borderTop: "12px solid transparent",
                    borderBottom: "12px solid transparent",
                    marginLeft: "5px",
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "0.85rem", color: "#666", fontWeight: "500" }}>
            #{globalIndex + 1}
          </span>
          <span
            style={{
              fontSize: "0.75rem",
              color: platformColor,
              fontWeight: "600",
              padding: "2px 8px",
              borderRadius: "4px",
              backgroundColor: `${platformColor}15`,
            }}
          >
            {video.platform}
          </span>
        </div>
        <a
          href={video.url}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: "1.1rem",
            color: "#1a0dab",
            textDecoration: "none",
            fontWeight: "600",
            display: "block",
            marginBottom: "0.5rem",
            lineHeight: "1.4",
          }}
          onMouseEnter={(e) => (e.target.style.textDecoration = "underline")}
          onMouseLeave={(e) => (e.target.style.textDecoration = "none")}
        >
          {video.title}
        </a>
        <p
          style={{
            fontSize: "0.9rem",
            color: "#545454",
            lineHeight: "1.5",
            margin: "0 0 1rem 0",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {video.description || "No description available"}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate("/transcript", { state: { video } });
          }}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.85rem",
            backgroundColor: "#4285f4",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "500",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = "#357ae8"}
          onMouseLeave={(e) => e.target.style.backgroundColor = "#4285f4"}
        >
          View Transcript
        </button>
      </div>
    </div>
  );
}

export default function VideoList({ results, loading, currentPage, setCurrentPage }) {
  if (loading) return <p style={{ fontSize: "1.1rem", color: "#555" }}>Loading results...</p>;
  if (!results.length) return <p style={{ fontSize: "1.1rem", color: "#888" }}>No results found. Try a different search term.</p>;

  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentResults = results.slice(startIndex, endIndex);

  const youtubeCount = results.filter(v => v.platform === "YouTube").length;
  const vimeoCount = results.filter(v => v.platform === "Vimeo").length;

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      <div style={{ 
        marginBottom: "1.5rem", 
        padding: "1rem",
        backgroundColor: "#f8f9fa",
        borderRadius: "8px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "0.5rem"
      }}>
        <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#333" }}>
          Found {results.length} total results
          <span style={{ fontSize: "0.9rem", fontWeight: "normal", color: "#666", marginLeft: "0.5rem" }}>
            ({youtubeCount} YouTube, {vimeoCount} Vimeo)
          </span>
        </div>
        <div style={{ fontSize: "0.9rem", color: "#666" }}>
          Page {currentPage} of {totalPages}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
        {currentResults.map((video, index) => (
          <VideoCard 
            key={video.id} 
            video={video} 
            index={index}
            globalIndex={startIndex + index}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "0.5rem",
          marginTop: "2rem",
          flexWrap: "wrap"
        }}>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.9rem",
              backgroundColor: currentPage === 1 ? "#e0e0e0" : "#4285f4",
              color: currentPage === 1 ? "#999" : "white",
              border: "none",
              borderRadius: "4px",
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
              fontWeight: "500",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              if (currentPage !== 1) e.target.style.backgroundColor = "#357ae8";
            }}
            onMouseLeave={(e) => {
              if (currentPage !== 1) e.target.style.backgroundColor = "#4285f4";
            }}
          >
            ← Previous
          </button>

          <div style={{ display: "flex", gap: "0.25rem" }}>
            {[...Array(totalPages)].map((_, i) => {
              const pageNum = i + 1;
              const isCurrentPage = pageNum === currentPage;
              const showPage = 
                pageNum === 1 || 
                pageNum === totalPages || 
                (pageNum >= currentPage - 1 && pageNum <= currentPage + 1);

              if (!showPage) {
                if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                  return <span key={i} style={{ padding: "0.5rem", color: "#999" }}>...</span>;
                }
                return null;
              }

              return (
                <button
                  key={i}
                  onClick={() => handlePageChange(pageNum)}
                  style={{
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.9rem",
                    backgroundColor: isCurrentPage ? "#4285f4" : "#fff",
                    color: isCurrentPage ? "white" : "#333",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: isCurrentPage ? "600" : "400",
                    minWidth: "40px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrentPage) {
                      e.target.style.backgroundColor = "#f0f0f0";
                      e.target.style.borderColor = "#4285f4";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrentPage) {
                      e.target.style.backgroundColor = "#fff";
                      e.target.style.borderColor = "#ddd";
                    }
                  }}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.9rem",
              backgroundColor: currentPage === totalPages ? "#e0e0e0" : "#4285f4",
              color: currentPage === totalPages ? "#999" : "white",
              border: "none",
              borderRadius: "4px",
              cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              fontWeight: "500",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              if (currentPage !== totalPages) e.target.style.backgroundColor = "#357ae8";
            }}
            onMouseLeave={(e) => {
              if (currentPage !== totalPages) e.target.style.backgroundColor = "#4285f4";
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
