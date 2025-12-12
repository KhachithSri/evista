import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SplitText from "./SplitText";
import { fetchAPI } from "../api/config";

export default function QuizPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { video, summary, language } = location.state || {};
  
  const [quiz, setQuiz] = useState(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!video || !summary) {
      navigate("/");
      return;
    }
    handleGenerateQuiz();
  }, []);

  const handleGenerateQuiz = async () => {
    setLoadingQuiz(true);
    setError(null);

    try {
      const data = await fetchAPI("/quiz", {
        method: "POST",
        body: JSON.stringify({ summary, language: language || 'english', numQuestions: 12 })
      });

      if (data.questions?.length) {
        setQuiz(data.questions);
        setCurrentQuestion(0);
        setUserAnswers(new Array(data.questions.length).fill(null));
        setShowResults(false);
      } else {
        setError('No questions were generated');
      }
    } catch (err) {
      setError(`Quiz generation failed: ${err.message}`);
    } finally {
      setLoadingQuiz(false);
    }
  };

  const handleAnswerSelect = (answerIndex) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestion] = answerIndex;
    setUserAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < quiz.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = async () => {
    const unanswered = userAnswers.filter(a => a === null).length;
    if (unanswered > 0) {
      if (!window.confirm(`You have ${unanswered} unanswered questions. Submit anyway?`)) {
        return;
      }
    }

    let correctCount = 0;
    quiz.forEach((question, index) => {
      if (userAnswers[index] === question.correctAnswer) {
        correctCount++;
      }
    });

    setScore(correctCount);
    setShowResults(true);
    setCurrentQuestion(0);

    // Submit quiz results to backend
    try {
      const token = localStorage.getItem("token");
      if (token) {
        await fetchAPI("/quiz/submit", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            score: correctCount,
            totalQuestions: quiz.length,
            answers: userAnswers
          })
        });
        console.log("✅ Quiz submitted and stats updated");
      }
    } catch (err) {
      console.error("Failed to submit quiz results:", err);
      // Don't fail the UI if submission fails
    }
  };

  const handleRetakeQuiz = () => {
    setUserAnswers(new Array(quiz.length).fill(null));
    setShowResults(false);
    setCurrentQuestion(0);
    setScore(0);
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

        {quiz && !showResults && (
          <div className="panel-section">
            <h6><i className="fa-solid fa-tasks me-2"></i>Progress</h6>
            <div className="progress mb-2">
              <div
                className="progress-bar"
                style={{width: `${(userAnswers.filter(a => a !== null).length / quiz.length) * 100}%`}}
              ></div>
            </div>
            <small className="text-muted">
              {userAnswers.filter(a => a !== null).length} of {quiz.length} answered
            </small>
          </div>
        )}

        {showResults && (
          <div className="panel-section">
            <h6><i className="fa-solid fa-trophy me-2"></i>Results</h6>
            <div className="d-flex justify-content-between mb-2">
              <span>Correct:</span>
              <strong className="text-success">{score}</strong>
            </div>
            <div className="d-flex justify-content-between mb-2">
              <span>Incorrect:</span>
              <strong className="text-danger">{quiz.length - score}</strong>
            </div>
            <div className="d-flex justify-content-between">
              <span>Score:</span>
              <strong>{Math.round((score / quiz.length) * 100)}%</strong>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="card-panel">
        <div className="mb-4">
          <SplitText
            text="Quiz Challenge"
            tag="h4"
            delay={40}
            duration={0.6}
            ease="power3.out"
            splitType="chars"
            from={{ opacity: 0, scale: 0.8, y: 20 }}
            to={{ opacity: 1, scale: 1, y: 0 }}
            threshold={0.9}
            rootMargin="0px"
            textAlign="left"
          />
        </div>

        {loadingQuiz && (
          <div className="text-center py-5">
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p className="mt-3 text-muted">Generating quiz questions...</p>
          </div>
        )}

        {error && (
          <div className="alert alert-danger" role="alert">
            <i className="fa-solid fa-exclamation-triangle me-2"></i>
            {error}
          </div>
        )}

        {quiz && !showResults && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5>
                Question {currentQuestion + 1} of {quiz.length}
              </h5>
              <span className="badge badge-primary" style={{fontSize: '1rem', padding: '0.5rem 1rem'}}>
                {userAnswers.filter(a => a !== null).length} / {quiz.length} answered
              </span>
            </div>

            <div className="quiz-question" style={{background: '#f8f9fa', padding: '2rem', borderRadius: '16px'}}>
              <h5 className="mb-4">{quiz[currentQuestion].question}</h5>
              
              <div className="d-flex flex-column gap-3">
                {quiz[currentQuestion].options.map((option, index) => (
                  <div
                    key={index}
                    className={`quiz-option ${userAnswers[currentQuestion] === index ? 'selected' : ''}`}
                    onClick={() => handleAnswerSelect(index)}
                    style={{
                      padding: '1.25rem',
                      border: userAnswers[currentQuestion] === index ? '3px solid #667eea' : '2px solid #e9ecef',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: userAnswers[currentQuestion] === index ? '#f0f3ff' : 'white'
                    }}
                  >
                    <strong style={{fontSize: '1.1rem'}}>{String.fromCharCode(65 + index)}.</strong> {option}
                  </div>
                ))}
              </div>
            </div>

            <div className="d-flex justify-content-between mt-4">
              <button
                className="btn btn-outline-secondary btn-lg"
                onClick={handlePrevious}
                disabled={currentQuestion === 0}
              >
                <i className="fa-solid fa-arrow-left me-2"></i>Previous
              </button>

              {currentQuestion < quiz.length - 1 ? (
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleNext}
                >
                  Next<i className="fa-solid fa-arrow-right ms-2"></i>
                </button>
              ) : (
                <button
                  className="btn btn-success btn-lg"
                  onClick={handleSubmit}
                >
                  <i className="fa-solid fa-check me-2"></i>Submit Quiz
                </button>
              )}
            </div>
          </div>
        )}

        {showResults && (
          <div>
            <div className="text-center mb-5" style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '3rem',
              borderRadius: '20px'
            }}>
              <i className="fa-solid fa-trophy" style={{fontSize: '4rem', marginBottom: '1rem'}}></i>
              <h2 style={{fontSize: '3rem', fontWeight: '800', margin: '1rem 0'}}>
                {score} / {quiz.length}
              </h2>
              <p style={{fontSize: '1.5rem', margin: 0}}>Score: {Math.round((score / quiz.length) * 100)}%</p>
            </div>

            <h5 className="mb-4">Review Your Answers</h5>

            {quiz.map((question, index) => {
              const isCorrect = userAnswers[index] === question.correctAnswer;
              return (
                <div
                  key={index}
                  className="mb-4"
                  style={{
                    background: '#f8f9fa',
                    padding: '1.5rem',
                    borderRadius: '16px',
                    borderLeft: `6px solid ${isCorrect ? '#28a745' : '#dc3545'}`
                  }}
                >
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <span style={{fontSize: '2rem'}}>{isCorrect ? '✅' : '❌'}</span>
                    <strong style={{fontSize: '1.1rem'}}>Question {index + 1}</strong>
                  </div>

                  <h6 className="mb-3">{question.question}</h6>

                  <div className="d-flex flex-column gap-2">
                    {question.options.map((option, optIndex) => {
                      const isUserAnswer = userAnswers[index] === optIndex;
                      const isCorrectAnswer = question.correctAnswer === optIndex;
                      
                      let style = {
                        padding: '1rem',
                        borderRadius: '8px',
                        border: '2px solid #e9ecef'
                      };

                      if (isCorrectAnswer) {
                        style.background = '#d4edda';
                        style.border = '2px solid #28a745';
                      } else if (isUserAnswer) {
                        style.background = '#f8d7da';
                        style.border = '2px solid #dc3545';
                      }

                      return (
                        <div key={optIndex} style={style}>
                          <strong>{String.fromCharCode(65 + optIndex)}.</strong> {option}
                          {isCorrectAnswer && ' ✓'}
                          {isUserAnswer && !isCorrect && ' (Your answer)'}
                        </div>
                      );
                    })}
                  </div>

                  {question.explanation && (
                    <div className="mt-3 p-3 bg-white rounded">
                      <strong><i className="fa-solid fa-lightbulb me-2"></i>Explanation:</strong>
                      <p className="mb-0 mt-2">{question.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="d-flex gap-3 justify-content-center mt-5">
              <button
                className="btn btn-primary btn-lg"
                onClick={handleRetakeQuiz}
              >
                <i className="fa-solid fa-redo me-2"></i>Retake Quiz
              </button>
              <button
                className="btn btn-outline-secondary btn-lg"
                onClick={() => navigate("/summary", { state: { video, summary, language } })}
              >
                <i className="fa-solid fa-arrow-left me-2"></i>Back to Summary
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
