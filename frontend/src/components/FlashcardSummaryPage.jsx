import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SplitText from "./SplitText";
import { fetchAPI } from "../api/config";

export default function FlashcardSummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { video, summary, language } = location.state || {};
  
  const [flashcards, setFlashcards] = useState(null);
  const [loadingFlashcards, setLoadingFlashcards] = useState(false);
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!video || !summary) {
      navigate("/");
      return;
    }
    // Auto-generate flashcards on page load
    handleGenerateFlashcards();
  }, []);

  const handleGenerateFlashcards = async () => {
    setLoadingFlashcards(true);
    setError(null);

    try {
      const data = await fetchAPI("/flashcard", {
        method: "POST",
        body: JSON.stringify({ 
          content: summary,
          language: language || 'english',
          numCards: 10,
          type: 'summary'
        })
      });

      if (data.flashcards?.length) {
        setFlashcards(data.flashcards);
        setCurrentCard(0);
        setIsFlipped(false);
      } else {
        setError('No flashcards were generated');
      }
    } catch (err) {
      setError(err.message);
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

  if (!video || !summary) {
    return null;
  }

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
        </div>

        {flashcards && (
          <div className="panel-section">
            <h6><i className="fa-solid fa-layer-group me-2"></i>Progress</h6>
            <div className="progress mb-2" style={{height: '12px'}}>
              <div
                className="progress-bar bg-info"
                style={{width: `${((currentCard + 1) / flashcards.length) * 100}%`}}
              ></div>
            </div>
            <div className="d-flex justify-content-between small">
              <span className="text-muted">Card {currentCard + 1}</span>
              <strong>{Math.round(((currentCard + 1) / flashcards.length) * 100)}%</strong>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="card-panel">
        <div className="mb-4">
          <SplitText
            text="Flashcards"
            tag="h4"
            delay={40}
            duration={0.6}
            ease="power3.out"
            splitType="chars"
            from={{ opacity: 0, rotationY: 90 }}
            to={{ opacity: 1, rotationY: 0 }}
            threshold={0.9}
            rootMargin="0px"
            textAlign="left"
          />
        </div>

        {loadingFlashcards && (
          <div className="text-center py-5">
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p className="mt-3 text-muted">Generating flashcards...</p>
          </div>
        )}

        {error && (
          <div className="alert alert-danger" role="alert">
            <i className="fa-solid fa-exclamation-triangle me-2"></i>
            {error}
          </div>
        )}

        {flashcards && !loadingFlashcards && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5>
                Card {currentCard + 1} of {flashcards.length}
              </h5>
              <span className="badge badge-primary" style={{fontSize: '0.9rem', padding: '0.5rem 1rem'}}>
                {flashcards[currentCard].category || 'Study Card'}
              </span>
            </div>

            <div className="flashcard-container" style={{perspective: '1000px', minHeight: '400px'}}>
              <div
                className={`flashcard ${isFlipped ? 'flipped' : ''}`}
                onClick={handleFlipCard}
                style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: '400px',
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
                    padding: '3rem',
                    borderRadius: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4)'
                  }}
                >
                  {flashcards[currentCard].emoji && (
                    <div style={{fontSize: '5rem', marginBottom: '2rem'}}>
                      {flashcards[currentCard].emoji}
                    </div>
                  )}
                  <div style={{fontSize: '1rem', opacity: 0.9, marginBottom: '2rem', textTransform: 'uppercase', letterSpacing: '1px'}}>
                    <i className="fa-solid fa-question-circle me-2"></i>
                    Question
                  </div>
                  <h2 style={{fontSize: '2rem', fontWeight: '600', lineHeight: '1.6', marginBottom: '2rem'}}>
                    {flashcards[currentCard].front}
                  </h2>
                  <div style={{marginTop: 'auto', fontSize: '1rem', opacity: 0.8}}>
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
                    padding: '3rem',
                    borderRadius: '20px',
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
                    <div style={{fontSize: '4rem', marginBottom: '2rem', opacity: 0.9}}>
                      {flashcards[currentCard].emoji}
                    </div>
                  )}
                  <div style={{fontSize: '1rem', opacity: 0.9, marginBottom: '2rem', textTransform: 'uppercase', letterSpacing: '1px'}}>
                    <i className="fa-solid fa-lightbulb me-2"></i>
                    Answer
                  </div>
                  <h3 style={{fontSize: '1.75rem', fontWeight: '500', lineHeight: '1.7'}}>
                    {flashcards[currentCard].back}
                  </h3>
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center mt-5">
              <button
                className="btn btn-outline-secondary btn-lg"
                onClick={handlePreviousCard}
                disabled={currentCard === 0}
              >
                <i className="fa-solid fa-arrow-left me-2"></i>Previous
              </button>
              
              <div className="text-center">
                <div className="progress" style={{width: '250px', height: '10px'}}>
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
