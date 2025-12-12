import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SplitText from "./SplitText";
import { fetchAPI } from "../api/config";

export default function FlashcardPage() {
  const navigate = useNavigate();
  
  const [topicInput, setTopicInput] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("english");
  const [flashcards, setFlashcards] = useState(null);
  const [loadingFlashcards, setLoadingFlashcards] = useState(false);
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerateFlashcards = async () => {
    if (!topicInput.trim()) {
      alert("Please enter a topic!");
      return;
    }

    setLoadingFlashcards(true);
    setError(null);

    try {
      const data = await fetchAPI("/flashcard", {
        method: "POST",
        body: JSON.stringify({ 
          content: topicInput.trim(),
          language: selectedLanguage,
          numCards: 10,
          type: 'topic'
        })
      });

      if (data.flashcards?.length) {
        setFlashcards(data.flashcards);
        setCurrentCard(0);
        setIsFlipped(false);
      } else {
        throw new Error('No flashcards generated');
      }
    } catch (err) {
      setError(err.message);
      alert(`Flashcard Error: ${err.message}`);
    } finally {
      setLoadingFlashcards(false);
    }
  };

  const handleFlipCard = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNextCard = () => {
    if (currentCard < flashcards.length - 1) {
      setCurrentCard(currentCard + 1);
      setIsFlipped(false);
    }
  };

  const handlePreviousCard = () => {
    if (currentCard > 0) {
      setCurrentCard(currentCard - 1);
      setIsFlipped(false);
    }
  };

  const handleNewTopic = () => {
    setFlashcards(null);
    setCurrentCard(0);
    setIsFlipped(false);
    setTopicInput("");
  };

  return (
    <div className="app">
      {/* Left Sidebar */}
      <aside className="card-panel">
        <button
          className="btn btn-outline-secondary btn-sm mb-3 w-100"
          onClick={() => navigate("/")}
        >
          <i className="fa-solid fa-arrow-left me-2"></i>
          Back to Home
        </button>

        <div className="brand mb-4">
          <div className="logo">
            <i className="fa-solid fa-layer-group"></i>
          </div>
          <div>
            <strong>Flashcard Generator</strong><br />
            <span className="text-muted">Learn Any Topic</span>
          </div>
        </div>

        <div className="panel-section">
          <h6><i className="fa-solid fa-language me-2"></i>Language</h6>
          <select
            className="form-select form-select-sm"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            disabled={loadingFlashcards}
          >
            <option value="english">English</option>
            <option value="hindi">Hindi</option>
            <option value="tamil">Tamil</option>
            <option value="telugu">Telugu</option>
            <option value="kannada">Kannada</option>
          </select>
        </div>

        <div className="panel-section">
          <h6><i className="fa-solid fa-lightbulb me-2"></i>Enter Topic</h6>
          <input
            type="text"
            className="form-control mb-3"
            placeholder="e.g., Machine Learning, Python, History..."
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleGenerateFlashcards()}
            disabled={loadingFlashcards}
          />
          <button
            className="btn btn-primary w-100"
            onClick={handleGenerateFlashcards}
            disabled={loadingFlashcards || !topicInput.trim()}
          >
            <i className="fa-solid fa-magic me-2"></i>
            {loadingFlashcards ? "Generating..." : "Generate Flashcards"}
          </button>
        </div>

        {flashcards && (
          <div className="panel-section">
            <button
              className="btn btn-success w-100"
              onClick={handleNewTopic}
            >
              <i className="fa-solid fa-plus me-2"></i>
              New Topic
            </button>
          </div>
        )}

        <div className="panel-section">
          <h6><i className="fa-solid fa-info-circle me-2"></i>How It Works</h6>
          <ol className="small mb-0 ps-3">
            <li className="mb-2">Enter any topic you want to learn</li>
            <li className="mb-2">Select your preferred language</li>
            <li className="mb-2">Click "Generate Flashcards"</li>
            <li className="mb-0">Click cards to flip and study!</li>
          </ol>
        </div>
      </aside>

      {/* Main Content */}
      <main className="card-panel">
        <div className="mb-3">
          <SplitText
            text="Create Flashcards"
            tag="h4"
            delay={40}
            duration={0.6}
            ease="power3.out"
            splitType="chars"
            from={{ opacity: 0, scale: 0.5, rotationZ: -15 }}
            to={{ opacity: 1, scale: 1, rotationZ: 0 }}
            threshold={0.9}
            rootMargin="0px"
            textAlign="left"
          />
        </div>

        {/* Loading */}
        {loadingFlashcards && (
          <div className="text-center py-5">
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p className="mt-3 text-muted">Generating flashcards for "{topicInput}"...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="alert alert-danger" role="alert">
            <i className="fa-solid fa-exclamation-triangle me-2"></i>
            {error}
          </div>
        )}

        {/* No Flashcards Yet */}
        {!flashcards && !loadingFlashcards && (
          <div className="text-center py-5">
            <i className="fa-solid fa-layer-group" style={{fontSize: '5rem', color: '#e9ecef'}}></i>
            <h5 className="mt-4 text-muted">Ready to Learn?</h5>
            <p className="text-muted">Enter a topic and generate flashcards to start studying!</p>
            <div className="mt-4">
              <h6 className="text-muted mb-3">Popular Topics:</h6>
              <div className="d-flex flex-wrap gap-2 justify-content-center">
                {["Machine Learning", "Python Programming", "Data Science", "Web Development", "Mathematics", "Physics"].map((topic) => (
                  <button
                    key={topic}
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => {
                      setTopicInput(topic);
                    }}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Flashcard Display */}
        {flashcards && !loadingFlashcards && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5>
                <i className="fa-solid fa-layer-group me-2"></i>
                Card {currentCard + 1} of {flashcards.length}
              </h5>
              <span className="badge badge-primary" style={{fontSize: '0.9rem', padding: '0.5rem 1rem'}}>
                {flashcards[currentCard].category || 'Study Card'}
              </span>
            </div>

            <div className="flashcard-container" style={{perspective: '1000px', minHeight: '350px'}}>
              <div
                className={`flashcard ${isFlipped ? 'flipped' : ''}`}
                onClick={handleFlipCard}
                style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: '350px',
                  cursor: 'pointer',
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.6s',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                }}
              >
                {/* Front of card */}
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    background: flashcards[currentCard].color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: '2.5rem',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4)'
                  }}
                >
                  {flashcards[currentCard].emoji && (
                    <div style={{fontSize: '4rem', marginBottom: '1.5rem'}}>
                      {flashcards[currentCard].emoji}
                    </div>
                  )}
                  <div style={{fontSize: '1rem', opacity: 0.9, marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '1px'}}>
                    <i className="fa-solid fa-question-circle me-2"></i>
                    Question
                  </div>
                  <h3 style={{fontSize: '1.8rem', fontWeight: '600', lineHeight: '1.6', marginBottom: '2rem'}}>
                    {flashcards[currentCard].front}
                  </h3>
                  <div style={{marginTop: 'auto', fontSize: '0.9rem', opacity: 0.8}}>
                    <i className="fa-solid fa-hand-pointer me-2"></i>
                    Click to reveal answer
                  </div>
                </div>

                {/* Back of card */}
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    color: 'white',
                    padding: '2.5rem',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    transform: 'rotateY(180deg)',
                    boxShadow: '0 10px 40px rgba(245, 87, 108, 0.4)'
                  }}
                >
                  {flashcards[currentCard].emoji && (
                    <div style={{fontSize: '3rem', marginBottom: '1.5rem', opacity: 0.9}}>
                      {flashcards[currentCard].emoji}
                    </div>
                  )}
                  <div style={{fontSize: '1rem', opacity: 0.9, marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '1px'}}>
                    <i className="fa-solid fa-lightbulb me-2"></i>
                    Answer
                  </div>
                  <h4 style={{fontSize: '1.5rem', fontWeight: '500', lineHeight: '1.7'}}>
                    {flashcards[currentCard].back}
                  </h4>
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center mt-4">
              <button
                className="btn btn-outline-secondary btn-lg"
                onClick={handlePreviousCard}
                disabled={currentCard === 0}
              >
                <i className="fa-solid fa-arrow-left me-2"></i>Previous
              </button>
              
              <div className="text-center">
                <div className="progress" style={{width: '200px', height: '8px'}}>
                  <div
                    className="progress-bar bg-info"
                    style={{width: `${((currentCard + 1) / flashcards.length) * 100}%`}}
                  ></div>
                </div>
                <small className="text-muted mt-2 d-block">
                  {currentCard + 1} / {flashcards.length} cards
                </small>
              </div>

              <button
                className="btn btn-primary btn-lg"
                onClick={handleNextCard}
                disabled={currentCard === flashcards.length - 1}
              >
                Next<i className="fa-solid fa-arrow-right ms-2"></i>
              </button>
            </div>
          </div>
        )}
      </main>

    </div>
  );
}
