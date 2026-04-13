import React from 'react';
import { Link } from 'react-router-dom';
import './Signup.css';

const SignUp = () => {
  return (
    <div className="signup-container">
      
      {/* Back Button */}
      <Link to="/" className="back-button">← Back</Link>

      <div className="signup-card">
        <h2 className="signup-heading">Create Account</h2>
        <p className="signup-subtitle">
          Start tracking shared expenses with your group.
        </p>

        <form className="signup-form">
          <input type="text" placeholder="Full Name" className="signup-input" />
          <input type="email" placeholder="Email" className="signup-input" />
          <input type="password" placeholder="Password" className="signup-input" />
          <input type="password" placeholder="Confirm Password" className="signup-input" />

          <button type="submit" className="signup-button">
            Sign Up
          </button>
        </form>

        <p className="signup-footer">
          Already have an account? <Link to="/signin">Sign In</Link>
        </p>
      </div>
    </div>
  );
};

export default SignUp;