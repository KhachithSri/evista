import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAPI } from "../api/config";

export default function ProfilePage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const data = await fetchAPI("/user/dashboard", {
        headers: { Authorization: `Bearer ${token}` }
      });

      setDashboard(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center">
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '3rem', color: '#667eea', marginBottom: '1rem', display: 'block' }}></i>
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="alert alert-danger" style={{ maxWidth: '500px' }}>
          <i className="fa-solid fa-exclamation-circle me-2"></i>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '20px',
          padding: '2rem',
          color: 'white',
          marginBottom: '2rem',
          boxShadow: '0 10px 40px rgba(102, 126, 234, 0.2)'
        }}>
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <h1 style={{ marginBottom: '0.5rem' }}>
                <i className="fa-solid fa-user-circle me-2"></i>
                {dashboard?.user?.displayName}
              </h1>
              <p style={{ marginBottom: '0.5rem', opacity: 0.9 }}>
                <i className="fa-solid fa-envelope me-2"></i>
                {dashboard?.user?.email}
              </p>
              <p style={{ opacity: 0.8, fontSize: '0.9rem' }}>
                Member since {new Date(dashboard?.user?.createdAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-outline-light"
              style={{ borderRadius: '12px', fontWeight: '600' }}
            >
              <i className="fa-solid fa-sign-out-alt me-2"></i>
              Logout
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="row mb-4 g-3">
          <div className="col-md-3">
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📚</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#667eea' }}>
                {dashboard?.stats?.summariesGenerated || 0}
              </div>
              <p style={{ color: '#666', marginBottom: 0 }}>Summaries</p>
            </div>
          </div>
          <div className="col-md-3">
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>❓</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#667eea' }}>
                {dashboard?.stats?.quizzesCompleted || 0}
              </div>
              <p style={{ color: '#666', marginBottom: 0 }}>Quizzes</p>
            </div>
          </div>
          <div className="col-md-3">
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>💬</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#667eea' }}>
                {dashboard?.stats?.chatQuestionsAsked || 0}
              </div>
              <p style={{ color: '#666', marginBottom: 0 }}>Questions</p>
            </div>
          </div>
          <div className="col-md-3">
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⭐</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#667eea' }}>
                {dashboard?.stats?.xp || 0}
              </div>
              <p style={{ color: '#666', marginBottom: 0 }}>XP</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #e9ecef',
            padding: '1rem'
          }}>
            <div style={{ display: 'flex' }}>
              {["overview", "badges", "history"].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: activeTab === tab ? '#667eea' : 'transparent',
                    color: activeTab === tab ? 'white' : '#666',
                    border: 'none',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginRight: '0.5rem',
                    transition: 'all 0.3s'
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={fetchDashboard}
              style={{
                background: '#f8f9fa',
                color: '#667eea',
                border: '1px solid #e9ecef',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#667eea';
                e.target.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#f8f9fa';
                e.target.style.color = '#667eea';
              }}
            >
              <i className="fa-solid fa-refresh"></i>
              Refresh
            </button>
          </div>

          <div style={{ padding: '2rem' }}>
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div>
                <h5 className="mb-3">
                  <i className="fa-solid fa-chart-line me-2" style={{ color: '#667eea' }}></i>
                  Your Stats
                </h5>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <p><strong>Best Quiz Score:</strong> {dashboard?.stats?.bestQuizScore || 0}%</p>
                  </div>
                  <div className="col-md-6 mb-3">
                    <p><strong>Average Quiz Score:</strong> {dashboard?.stats?.avgQuizScore || 0}%</p>
                  </div>
                  <div className="col-md-6 mb-3">
                    <p><strong>Learning Streak:</strong> {dashboard?.stats?.streakDays || 0} days 🔥</p>
                  </div>
                  <div className="col-md-6 mb-3">
                    <p><strong>Total XP:</strong> {dashboard?.stats?.xp || 0}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Badges Tab */}
            {activeTab === "badges" && (
              <div>
                <h5 className="mb-3">
                  <i className="fa-solid fa-trophy me-2" style={{ color: '#ffc107' }}></i>
                  Your Badges ({dashboard?.badges?.length || 0})
                </h5>
                {dashboard?.badges && dashboard.badges.length > 0 ? (
                  <div className="row g-3">
                    {dashboard.badges.map(badge => (
                      <div key={badge.id} className="col-md-6 col-lg-4">
                        <div style={{
                          background: '#f8f9fa',
                          borderRadius: '12px',
                          padding: '1.5rem',
                          textAlign: 'center',
                          border: `2px solid ${badge.rarity === 'legendary' ? '#ffd700' : badge.rarity === 'epic' ? '#9c27b0' : badge.rarity === 'rare' ? '#2196f3' : '#4caf50'}`
                        }}>
                          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{badge.icon}</div>
                          <h6 style={{ marginBottom: '0.25rem' }}>{badge.name}</h6>
                          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
                            {badge.description}
                          </p>
                          <span className="badge" style={{
                            background: badge.rarity === 'legendary' ? '#ffd700' : badge.rarity === 'epic' ? '#9c27b0' : badge.rarity === 'rare' ? '#2196f3' : '#4caf50',
                            color: 'white'
                          }}>
                            {badge.rarity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#999', textAlign: 'center', padding: '2rem' }}>
                    No badges earned yet. Start learning to earn badges! 🚀
                  </p>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === "history" && (
              <div>
                <h5 className="mb-3">
                  <i className="fa-solid fa-history me-2" style={{ color: '#667eea' }}></i>
                  Recent Activity
                </h5>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <h6>Recent Summaries</h6>
                    {dashboard?.recentSummaries && dashboard.recentSummaries.length > 0 ? (
                      <ul style={{ listStyle: 'none', padding: 0 }}>
                        {dashboard.recentSummaries.map(s => (
                          <li key={s._id} style={{ padding: '0.75rem 0', borderBottom: '1px solid #eee' }}>
                            <small>
                              <strong>{s.video?.title}</strong>
                              <br />
                              <span style={{ color: '#999' }}>
                                {new Date(s.createdAt).toLocaleDateString()}
                              </span>
                            </small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ color: '#999' }}>No summaries yet</p>
                    )}
                  </div>
                  <div className="col-md-6 mb-3">
                    <h6>Recent Quizzes</h6>
                    {dashboard?.recentQuizzes && dashboard.recentQuizzes.length > 0 ? (
                      <ul style={{ listStyle: 'none', padding: 0 }}>
                        {dashboard.recentQuizzes.map(q => (
                          <li key={q._id} style={{ padding: '0.75rem 0', borderBottom: '1px solid #eee' }}>
                            <small>
                              <strong>Score: {q.percentage}%</strong>
                              <br />
                              <span style={{ color: '#999' }}>
                                {new Date(q.createdAt).toLocaleDateString()}
                              </span>
                            </small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ color: '#999' }}>No quizzes yet</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back Button */}
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button
            onClick={() => navigate("/")}
            className="btn btn-outline-primary"
            style={{ borderRadius: '12px', fontWeight: '600' }}
          >
            <i className="fa-solid fa-arrow-left me-2"></i>
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
