import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Home from './components/Home';
import Experience from './components/Experience';
import Projects from './components/Projects';
import Media from './components/Media';
import './App.css';

function App() {
  return (
    <Router>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/experience" element={<Experience />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/media" element={<Media />} />
        </Routes>
      </AnimatePresence>
    </Router>
  );
}

export default App;