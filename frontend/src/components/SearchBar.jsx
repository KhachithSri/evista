import { useState } from "react";
import { searchVideos } from "../api/videoSearch";
import VideoList from "./VideoList";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setCurrentPage(1);
    setResults([{ id: "loading", title: "Searching...", url: "#", platform: "System" }]);

    const videos = await searchVideos(query);
    setResults(videos);
    setLoading(false);
  };

  return (
    <div>
      <form onSubmit={handleSearch} style={{ marginBottom: "2rem" }}>
        <input
          type="text"
          placeholder="Search educational videos..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ 
            padding: "0.75rem 1rem", 
            width: "70%",
            fontSize: "1rem",
            border: "2px solid #ddd",
            borderRadius: "4px 0 0 4px",
            outline: "none",
            transition: "border-color 0.3s"
          }}
          onFocus={(e) => e.target.style.borderColor = "#4285f4"}
          onBlur={(e) => e.target.style.borderColor = "#ddd"}
        />
        <button 
          type="submit" 
          style={{ 
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            backgroundColor: "#4285f4",
            color: "white",
            border: "none",
            borderRadius: "0 4px 4px 0",
            cursor: "pointer",
            fontWeight: "500",
            transition: "background-color 0.3s"
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = "#357ae8"}
          onMouseLeave={(e) => e.target.style.backgroundColor = "#4285f4"}
        >
          Search
        </button>
      </form>

      <VideoList 
        results={results} 
        loading={loading} 
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      />
    </div>
  );
}
