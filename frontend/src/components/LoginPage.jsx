import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAPI } from "../api/config";

export default function LoginPage() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      const body = isLogin
        ? { email, password }
        : { email, password, displayName };

      const data = await fetchAPI(endpoint, {
        method: "POST",
        body: JSON.stringify(body)
      });

      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        navigate("/");
      } else {
        setError(data.error || "Authentication failed");
      }
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '450px',
        width: '100%',
        background: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '24px',
        padding: '3rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '70px',
            height: '70px',
            background: 'white',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <i className="fa-solid fa-graduation-cap" style={{fontSize: '2.5rem', color: '#667eea'}}></i>
          </div>
          <h2 style={{ color: 'white', marginBottom: '0.5rem' }}>EVISTA</h2>
          <p style={{ color: 'rgba(255,255,255,0.9)', margin: 0 }}>
            {isLogin ? "Welcome Back" : "Join Our Community"}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="mb-3">
              <label style={{ color: 'white', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                Display Name
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                style={{
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  padding: '0.75rem 1rem'
                }}
              />
            </div>
          )}

          <div className="mb-3">
            <label style={{ color: 'white', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
              Email
            </label>
            <input
              type="email"
              className="form-control"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                color: 'white',
                padding: '0.75rem 1rem'
              }}
            />
          </div>

          <div className="mb-3">
            <label style={{ color: 'white', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
              Password
            </label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                color: 'white',
                padding: '0.75rem 1rem'
              }}
            />
          </div>

          {error && (
            <div className="alert alert-danger" role="alert" style={{ borderRadius: '12px' }}>
              <i className="fa-solid fa-exclamation-circle me-2"></i>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={loading}
            style={{
              borderRadius: '12px',
              fontWeight: '600',
              padding: '0.875rem',
              fontSize: '1rem',
              marginBottom: '1rem'
            }}
          >
            {loading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin me-2"></i>
                {isLogin ? "Logging in..." : "Creating account..."}
              </>
            ) : (
              <>
                <i className={`fa-solid ${isLogin ? "fa-sign-in-alt" : "fa-user-plus"} me-2`}></i>
                {isLogin ? "Login" : "Create Account"}
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '1rem' }}>
            {isLogin ? "Don't have an account?" : "Already have an account?"}
          </p>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            className="btn btn-outline-light w-100"
            style={{
              borderRadius: '12px',
              fontWeight: '600',
              padding: '0.75rem'
            }}
          >
            {isLogin ? "Sign Up" : "Login"}
          </button>
        </div>

        <button
          onClick={() => navigate("/")}
          className="btn btn-link w-100 mt-3"
          style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}
        >
          <i className="fa-solid fa-arrow-left me-2"></i>
          Back to Home
        </button>
      </div>
    </div>
  );
}
