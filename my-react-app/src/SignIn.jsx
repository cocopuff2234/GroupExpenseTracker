import React from 'react';
import { Link } from 'react-router-dom';
import './Signin.css';

const SignIn = () => {
  return (
    <div className="signin-container">
      
      {/* Back Button */}
      <Link to="/" className="back-button">← Back</Link>

      <div className="signin-card">
        <h2 className="signin-heading">Welcome Back</h2>
        <p className="signin-subtitle">
          Sign in to manage your groups and expenses.
        </p>

        <form className="signin-form">
          <input type="email" placeholder="Email" className="signin-input" />
          <input type="password" placeholder="Password" className="signin-input" />

          <button type="submit" className="signin-button">
            Sign In
          </button>
        </form>

        <p className="signin-footer">
          Don&apos;t have an account? <Link to="/signup">Sign Up</Link>
        </p>
      </div>
    </div>
  );
};

export default SignIn;