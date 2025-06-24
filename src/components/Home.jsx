import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageTransition from './PageTransition';

const buttonVariants = {
  hover: {
    scale: 1.05,
    y: -8,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 10
    }
  },
  tap: {
    scale: 0.95
  }
};

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
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1
  }
};

const Home = () => {
  return (
    <PageTransition className="App">
      <div className="hero-section">
        <motion.div 
          className="profile-container"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="profile-image" variants={itemVariants}>
            <motion.img 
              src="images/headshot.jpg" 
              alt="Steven Frato"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            />
          </motion.div>
          <motion.div className="profile-content" variants={itemVariants}>
            <motion.h1 
              className="name-title"
              variants={itemVariants}
            >
              Steven Frato
            </motion.h1>
            <motion.p 
              className="professional-summary"
              variants={itemVariants}
            >
              Government professional with a passion for data analysis to influence policy change in the state of New Jersey. 
              Currently contributing to spatial health and accessibility analytics at 39 North Labs as well as the New Jersey Department of Environmental Protection's Bureau of X-Ray Compliance.
            </motion.p>
          </motion.div>
        </motion.div>
      </div>

      <div className="navigation-section">
        <motion.div 
          className="nav-buttons"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants}>
            <Link to="/experience" className="nav-button-link">
              <motion.div 
                className="nav-button"
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
              >
                <div className="button-content">
                  <i className="bi bi-briefcase"></i>
                  <span>Experience</span>
                </div>
              </motion.div>
            </Link>
          </motion.div>
          
          <motion.div variants={itemVariants}>
            <Link to="/projects" className="nav-button-link">
              <motion.div 
                className="nav-button"
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
              >
                <div className="button-content">
                  <i className="bi bi-code-square"></i>
                  <span>Projects</span>
                </div>
              </motion.div>
            </Link>
          </motion.div>
          
          <motion.div variants={itemVariants}>
            <Link to="/media" className="nav-button-link">
              <motion.div 
                className="nav-button"
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
              >
                <div className="button-content">
                  <i className="bi bi-camera"></i>
                  <span>Media</span>
                </div>
              </motion.div>
            </Link>
          </motion.div>
        </motion.div>
      </div>

      <motion.div 
        className="social-links"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.a 
          href="https://www.linkedin.com/in/steven-frato-a21371135/" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="social-link"
          variants={itemVariants}
          whileHover={{ scale: 1.1, y: -4 }}
          whileTap={{ scale: 0.95 }}
        >
          <i className="bi bi-linkedin"></i>
        </motion.a>
        <motion.a 
          href="https://github.com/SFRATO" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="social-link"
          variants={itemVariants}
          whileHover={{ scale: 1.1, y: -4 }}
          whileTap={{ scale: 0.95 }}
        >
          <i className="bi bi-github"></i>
        </motion.a>
      </motion.div>
    </PageTransition>
  );
};

export default Home;