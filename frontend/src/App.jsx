import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import HomePage from "./components/HomePage";
import TranscriptPage from "./components/TranscriptPage";
import FlashcardPage from "./components/FlashcardPage";
import SummaryPage from "./components/SummaryPage";
import QuizPage from "./components/QuizPage";
import FlashcardSummaryPage from "./components/FlashcardSummaryPage";
import ListenPage from "./components/ListenPage";
import LoginPage from "./components/LoginPage";
import ProfilePage from "./components/ProfilePage";
import ProfilePopup from "./components/shared/ProfilePopup";

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

function AppContent() {
  const location = useLocation();
  const hiddenPaths = ["/quiz", "/profile", "/flashcards", "/flashcards-summary"];
  const hideProfilePopup = hiddenPaths.includes(location.pathname);

  return (
    <>
      {!hideProfilePopup && <ProfilePopup />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/transcript" element={<TranscriptPage />} />
        <Route path="/summary" element={<SummaryPage />} />
        <Route path="/listen" element={<ListenPage />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/flashcards" element={<FlashcardPage />} />
        <Route path="/flashcards-summary" element={<FlashcardSummaryPage />} />
      </Routes>
    </>
  );
}

export default App;
