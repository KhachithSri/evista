import { useState, useRef } from "react";
import { searchVideos } from "../api/videoSearch";
import VideoList from "./VideoList";
import { API_BASE_URL } from "../api/config";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const handleSearch = async (e, overrideQuery) => {
    if (e) e.preventDefault();
    const term = (overrideQuery ?? query).trim();
    if (!term) return;

    setLoading(true);
    setCurrentPage(1);
    setResults([{ id: "loading", title: "Searching...", url: "#", platform: "System" }]);

    const videos = await searchVideos(term);
    setResults(videos);
    setLoading(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", blob, "voice-search.webm");

        try {
          setLoading(true);
          setResults([{ id: "transcribing", title: "Transcribing voice...", url: "#", platform: "System" }]);

          const response = await fetch(`${API_BASE_URL}/voice-search`, {
            method: "POST",
            body: formData,
          });

          const data = await response.json();
          const text = data.text || "";
          if (text.trim()) {
            setQuery(text);
            await handleSearch(null, text);
          } else {
            setResults([]);
            setLoading(false);
          }
        } catch (error) {
          console.error("Voice search error:", error);
          setLoading(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Could not start recording:", error);
    }
  };

  const stopRecording = () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      setIsRecording(false);
    }
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
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          style={{
            padding: "0.75rem 1rem",
            fontSize: "1rem",
            backgroundColor: isRecording ? "#d93025" : "#34a853",
            color: "white",
            border: "none",
            borderRadius: "0",
            cursor: "pointer",
            fontWeight: "500",
            transition: "background-color 0.3s",
          }}
        >
          {isRecording ? "Stop" : "🎤"}
        </button>
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
            transition: "background-color 0.3s",
          }}
          onMouseEnter={(e) => (e.target.style.backgroundColor = "#357ae8")}
          onMouseLeave={(e) => (e.target.style.backgroundColor = "#4285f4")}
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
