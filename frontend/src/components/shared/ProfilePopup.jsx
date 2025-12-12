import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAPI } from "../../api/config";

export default function ProfilePopup() {
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse user:", e);
      }
    }
  }, []);

  const handleProfileClick = async () => {
    // Always fetch fresh stats when opening the popup
    if (!showPopup) {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (token) {
          const data = await fetchAPI("/user/dashboard", {
            headers: { Authorization: `Bearer ${token}` }
          });
          setStats(data?.stats);
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoading(false);
      }
    }
    setShowPopup(!showPopup);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setShowPopup(false);
    navigate("/login");
  };

  const handleViewProfile = () => {
    setShowPopup(false);
    navigate("/profile");
  };

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Profile Button */}
      <button
        onClick={handleProfileClick}
        className="btn btn-circle"
        style={{
          position: "fixed",
          bottom: "2rem",
          right: "2rem",
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          border: "none",
          color: "white",
          fontSize: "1.5rem",
          cursor: "pointer",
          boxShadow: "0 4px 20px rgba(102, 126, 234, 0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 999,
          transition: "all 0.3s ease",
          hover: {
            transform: "scale(1.1)",
            boxShadow: "0 6px 30px rgba(102, 126, 234, 0.6)"
          }
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = "scale(1.1)";
          e.target.style.boxShadow = "0 6px 30px rgba(102, 126, 234, 0.6)";
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = "scale(1)";
          e.target.style.boxShadow = "0 4px 20px rgba(102, 126, 234, 0.4)";
        }}
      >
        <i className="fa-solid fa-user"></i>
      </button>

      {/* Popup Modal */}
      {showPopup && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowPopup(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.5)",
              zIndex: 1000,
              animation: "fadeIn 0.3s ease"
            }}
          />

          {/* Popup Content */}
          <div
            style={{
              position: "fixed",
              bottom: "6rem",
              right: "2rem",
              background: "white",
              borderRadius: "16px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
              zIndex: 1001,
              width: "320px",
              maxHeight: "500px",
              overflow: "hidden",
              animation: "slideUp 0.3s ease",
              display: "flex",
              flexDirection: "column"
            }}
          >
            {/* Header */}
            <div
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                padding: "1.5rem",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                <div
                  style={{
                    width: "50px",
                    height: "50px",
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.5rem"
                  }}
                >
                  <i className="fa-solid fa-user-circle"></i>
                </div>
                <div>
                  <h6 style={{ margin: 0, fontWeight: "600" }}>{user?.displayName || "User"}</h6>
                  <small style={{ opacity: 0.9 }}>{user?.email}</small>
                </div>
              </div>
            </div>

            {/* Stats */}
            {loading ? (
              <div style={{ padding: "1.5rem", textAlign: "center" }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ color: "#667eea", marginRight: "0.5rem" }}></i>
                <small>Loading...</small>
              </div>
            ) : stats ? (
              <div style={{ padding: "1.5rem", borderBottom: "1px solid #e9ecef" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#667eea" }}>
                      {stats.summariesGenerated || 0}
                    </div>
                    <small style={{ color: "#666" }}>Summaries</small>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#667eea" }}>
                      {stats.quizzesCompleted || 0}
                    </div>
                    <small style={{ color: "#666" }}>Quizzes</small>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#667eea" }}>
                      {stats.xp || 0}
                    </div>
                    <small style={{ color: "#666" }}>XP</small>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#667eea" }}>
                      {stats.streakDays || 0}
                    </div>
                    <small style={{ color: "#666" }}>Streak</small>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Actions */}
            <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button
                onClick={handleViewProfile}
                style={{
                  background: "#667eea",
                  color: "white",
                  border: "none",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "#5568d3";
                  e.target.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "#667eea";
                  e.target.style.transform = "translateY(0)";
                }}
              >
                <i className="fa-solid fa-user-circle me-2"></i>
                View Profile
              </button>
              <button
                onClick={handleLogout}
                style={{
                  background: "#f8f9fa",
                  color: "#dc3545",
                  border: "1px solid #e9ecef",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "#dc3545";
                  e.target.style.color = "white";
                  e.target.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "#f8f9fa";
                  e.target.style.color = "#dc3545";
                  e.target.style.transform = "translateY(0)";
                }}
              >
                <i className="fa-solid fa-sign-out-alt me-2"></i>
                Logout
              </button>
            </div>
          </div>

          {/* Animations */}
          <style>{`
            @keyframes fadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </>
      )}
    </>
  );
}
