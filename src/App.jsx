import React from 'react'
import './App.css'

function App() {
  return (
    <div className="App">
      <div className="hero-section">
        <div className="profile-container">
          <div className="profile-image">
            <img src="https://via.placeholder.com/200x200/6f42c1/ffffff?text=SF" alt="Steven Frato" />
          </div>
          <div className="profile-content">
            <h1 className="name-title">Steven Frato</h1>
            <p className="professional-summary">
              Biochemistry student with a passion for data analysis and healthcare accessibility research. 
              Currently contributing to innovative spatial health analytics at 39 North Labs, combining 
              scientific expertise with data-driven insights to improve healthcare outcomes.
            </p>
          </div>
        </div>
      </div>

      <div className="navigation-section">
        <div className="nav-buttons">
          <a href="#experience" className="nav-button">
            <div className="button-content">
              <i className="bi bi-briefcase"></i>
              <span>Experience</span>
            </div>
          </a>
          
          <a href="#projects" className="nav-button">
            <div className="button-content">
              <i className="bi bi-code-square"></i>
              <span>Projects</span>
            </div>
          </a>
          
          <a href="#media" className="nav-button">
            <div className="button-content">
              <i className="bi bi-camera"></i>
              <span>Media</span>
            </div>
          </a>
        </div>
      </div>

      <div className="social-links">
        <a href="https://www.linkedin.com/in/steven-frato-a21371135/" target="_blank" rel="noopener noreferrer" className="social-link">
          <i className="bi bi-linkedin"></i>
        </a>
        <a href="https://github.com/SFRATO" target="_blank" rel="noopener noreferrer" className="social-link">
          <i className="bi bi-github"></i>
        </a>
      </div>
    </div>
  )
}

export default App