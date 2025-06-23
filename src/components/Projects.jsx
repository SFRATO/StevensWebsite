import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageTransition from './PageTransition';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.3,
      staggerChildren: 0.3
    }
  }
};

const itemVariants = {
  hidden: { y: 30, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 12
    }
  }
};

const Projects = () => {
  return (
    <PageTransition>
      <div className="page-container">
        <motion.div 
          className="page-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Link to="/" className="back-button">
            <i className="bi bi-arrow-left"></i> Back to Home
          </Link>
          <h1 className="page-title">Projects</h1>
        </motion.div>

        <motion.div 
          className="projects-container"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div 
            className="project-item"
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -8 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div className="project-image">
              <img src="images/project.png" alt="Healthcare Accessibility Project" />
            </div>
            <div className="project-details">
              <h3>Spatial Analysis of Healthcare Accessibility in New Jersey</h3>
              <p className="project-date">April 2023 - Present</p>
              <p className="project-description">
                Comprehensive spatial analysis project examining healthcare accessibility patterns across New Jersey. 
                This research aims to identify gaps in healthcare coverage and inform policy decisions for improved 
                healthcare distribution.
              </p>
              <motion.a 
                href="https://39n.io/posts/spatial-analysis-nj-healthcare-accessibility/" 
                target="_blank" 
                className="project-link"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                View Project <i className="bi bi-arrow-up-right"></i>
              </motion.a>
            </div>
          </motion.div>

          <motion.div 
            className="project-item"
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -8 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div className="project-image">
              <img src="images/lab.png" alt="Protease Research" />
            </div>
            <div className="project-details">
              <h3>Serine, Metallo, and Aspartyl Protease Extraction from Beef and Plants</h3>
              <p className="project-date">May 2023 - Ongoing</p>
              <p className="project-description">
                Research project focused on determining protein levels in different food sources and using zymography 
                to analyze protease activity. Investigating differences in protease function between carnivorous and 
                herbivorous organisms.
              </p>
              <ul className="project-objectives">
                <li>Determine levels of protein in different food sources</li>
                <li>Use zymography to determine which proteases act on these proteins</li>
                <li>Determine whether proteases in carnivores or herbivores differ in function</li>
              </ul>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default Projects;