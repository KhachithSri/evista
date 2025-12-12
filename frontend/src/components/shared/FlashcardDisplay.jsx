/**
 * Shared Flashcard Display Component
 * Used by FlashcardPage, FlashcardSummaryPage, and TranscriptPage
 */
export default function FlashcardDisplay({ 
  flashcards, 
  currentCard, 
  isFlipped, 
  onFlip, 
  onNext, 
  onPrevious,
  showProgress = true,
  size = 'large' // 'large' or 'medium'
}) {
  if (!flashcards || flashcards.length === 0) return null;

  const card = flashcards[currentCard];
  const minHeight = size === 'large' ? '400px' : '300px';
  const fontSize = size === 'large' ? { emoji: '5rem', question: '2rem', answer: '1.75rem' } 
                                    : { emoji: '3.5rem', question: '1.5rem', answer: '1.3rem' };
  const padding = size === 'large' ? '3rem' : '2rem';

  return (
    <div>
      <div className="flashcard-container" style={{perspective: '1000px', minHeight}}>
        <div
          className={`flashcard ${isFlipped ? 'flipped' : ''}`}
          onClick={onFlip}
          style={{
            position: 'relative',
            width: '100%',
            minHeight,
            cursor: 'pointer',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.6s',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
          }}
        >
          {/* Front */}
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            background: card.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding,
            borderRadius: size === 'large' ? '20px' : '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4)'
          }}>
            {card.emoji && <div style={{fontSize: fontSize.emoji, marginBottom: '2rem'}}>{card.emoji}</div>}
            <div style={{fontSize: '1rem', opacity: 0.9, marginBottom: '2rem', textTransform: 'uppercase', letterSpacing: '1px'}}>
              <i className="fa-solid fa-question-circle me-2"></i>Question
            </div>
            <h2 style={{fontSize: fontSize.question, fontWeight: '600', lineHeight: '1.6', marginBottom: '2rem'}}>
              {card.front}
            </h2>
            <div style={{marginTop: 'auto', fontSize: '1rem', opacity: 0.8}}>
              <i className="fa-solid fa-hand-pointer me-2"></i>Click to reveal answer
            </div>
          </div>

          {/* Back */}
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white',
            padding,
            borderRadius: size === 'large' ? '20px' : '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            transform: 'rotateY(180deg)',
            boxShadow: '0 10px 40px rgba(245, 87, 108, 0.4)'
          }}>
            {card.emoji && <div style={{fontSize: fontSize.emoji === '5rem' ? '4rem' : '3rem', marginBottom: '2rem', opacity: 0.9}}>{card.emoji}</div>}
            <div style={{fontSize: '1rem', opacity: 0.9, marginBottom: '2rem', textTransform: 'uppercase', letterSpacing: '1px'}}>
              <i className="fa-solid fa-lightbulb me-2"></i>Answer
            </div>
            <h3 style={{fontSize: fontSize.answer, fontWeight: '500', lineHeight: '1.7'}}>
              {card.back}
            </h3>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className={`d-flex justify-content-between align-items-center mt-${size === 'large' ? '5' : '4'}`}>
        <button
          className={`btn btn-outline-secondary btn-${size === 'large' ? 'lg' : ''}`}
          onClick={onPrevious}
          disabled={currentCard === 0}
        >
          <i className="fa-solid fa-arrow-left me-2"></i>Previous
        </button>
        
        {showProgress && (
          <div className="text-center">
            <div className="progress" style={{width: size === 'large' ? '250px' : '200px', height: size === 'large' ? '10px' : '8px'}}>
              <div
                className="progress-bar bg-info"
                style={{width: `${((currentCard + 1) / flashcards.length) * 100}%`}}
              ></div>
            </div>
            <small className="text-muted mt-2 d-block">
              {currentCard + 1} / {flashcards.length} cards
            </small>
          </div>
        )}

        <button
          className={`btn btn-primary btn-${size === 'large' ? 'lg' : ''}`}
          onClick={onNext}
          disabled={currentCard === flashcards.length - 1}
        >
          Next<i className="fa-solid fa-arrow-right ms-2"></i>
        </button>
      </div>
    </div>
  );
}
