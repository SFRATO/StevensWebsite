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

const Experience = () => {
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
          <h1 className="page-title" style={{ textAlign: 'center', width: '100%', margin: '0 auto' }}>Experience</h1>
        </motion.div>

        <motion.div 
          className="content-section"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="experience-container" variants={itemVariants}>
            <motion.div 
              className="experience-item"
              whileHover={{ scale: 1.02, y: -5 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div className="company-logo">
                <img src="images/njdep.png" alt="NJ Department of Environmental Protection" />
              </div>
              <div className="experience-details">
                <h3>Environmental Services Trainee</h3>
                <h4>NJ Department of Environmental Protection</h4>
                <p className="date-range">Jul 2024 - Present</p>
                <ul className="bullet-list">
                  <li>Conduct inspections of facilities with radiation-producing equipment, including dental practices, urgent care centers, hospitals, veterinary clinics, pain management centers, and chiropractic offices.</li>
                  <li>Enforce New Jersey's Radiation Protection Program in accordance with N.J.A.C. Title 7, Chapter 28, ensuring compliance with state regulations.</li>
                  <li>Document inspection findings in state databases, issue violation notices, and provide facilities with available corrective action options based on regulatory requirements.</li>
                  <li>Investigate overdue payments, suspected non-compliance and enforce administrative orders, including notices of prosecution.</li>
                </ul>
              </div>
            </motion.div>

            <motion.div 
              className="experience-item"
              whileHover={{ scale: 1.02, y: -5 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div className="company-logo">
                <img src="images/39n.png" alt="39 North Labs" />
              </div>
              <div className="experience-details">
                <h3>Data Analysis Intern</h3>
                <h4>39 North Labs</h4>
                <p className="date-range">April 2023 - Present</p>
                <ul className="bullet-list">
                  <li>Spearhead innovative approaches in spatial health analytics</li>
                  <li>Contribute to healthcare accessibility research and analysis</li>
                  <li>Work on revolutionizing the evaluation and improvement of healthcare accessibility</li>
                </ul>
              </div>
            </motion.div>
          </motion.div>

          <motion.h2 
            variants={itemVariants} 
            className="page-title" 
            style={{ 
              textAlign: 'center', 
              width: '100%', 
              margin: '2rem auto 1rem',
              fontSize: '3rem',
              fontWeight: '700',
              color: 'var(--primary-purple)'
            }}
          >
            Education
          </motion.h2>
          
          <motion.div className="education-container" variants={itemVariants}>
            <motion.div 
              className="education-item"
              whileHover={{ scale: 1.02, y: -5 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div className="school-logo">
                <img src="images/stockton.png" alt="Stockton University" />
              </div>
              <div className="education-details">
                <h3>Bachelor of Science in Biochemistry and Molecular Biology</h3>
                <h4>Stockton University</h4>
                <p className="date-range">2020 - 2024</p>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default Experience;