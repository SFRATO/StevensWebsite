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
      staggerChildren: 0.2
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

const interestVariants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 15
    }
  }
};

const Media = () => {
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
          <h1 className="page-title">Media & Personal Interests</h1>
        </motion.div>

        <motion.div 
          className="media-container"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="media-section" variants={itemVariants}>
            <h2>Photography & Outdoor Adventures</h2>
            <div className="media-grid">
              <motion.div 
                className="media-item"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <img src="images/Wide hiking photo.png" alt="Hiking Adventure" />
              </motion.div>
            </div>
          </motion.div>

          <motion.div className="media-section" variants={itemVariants}>
            <h2>Music & Performance</h2>
            <div className="music-content">
              <p>
                Passionate drummer since age 13. Music provides a creative outlet that complements my analytical work in data science and research.
              </p>
            </div>
          </motion.div>

          <motion.div className="media-section" variants={itemVariants}>
            <h2>Interests</h2>
            <motion.div 
              className="interests-grid"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {[
                { icon: "bi-water", text: "Swimming" },
                { icon: "bi-person", text: "Martial Arts" },
                { icon: "bi-music-note", text: "Drumming" },
                { icon: "bi-controller", text: "Gaming" }
              
              ].map((interest, index) => (
                <motion.div 
                  key={index}
                  className="interest-item"
                  variants={interestVariants}
                  whileHover={{ scale: 1.1, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <i className={`bi ${interest.icon}`}></i>
                  <span>{interest.text}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default Media;