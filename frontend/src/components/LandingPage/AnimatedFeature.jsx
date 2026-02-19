import React from 'react';
import { motion } from 'framer-motion';
import './AnimatedFeature.css';

const textVariants = {
  hidden: { opacity: 0, x: -50 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

const imageVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.6, ease: "easeOut", delay: 0.2 }
  }
};

const AnimatedFeature = ({ title, description, image, imageSide = 'right', icon }) => {
  const isImageRight = imageSide === 'right';

  return (
    <motion.div
      className={`animated-feature-section ${isImageRight ? '' : 'image-left'}`}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }} // Animate when 30% of it is in view
      transition={{ staggerChildren: 0.2 }}
    >
      <motion.div className="feature-text-content" variants={textVariants}>
        <div className="feature-title">
          <span className="feature-icon" role="img">{icon}</span>
          <h2>{title}</h2>
        </div>
        <p>{description}</p>
      </motion.div>
      <motion.div className="feature-image-container" variants={imageVariants}>
        <img src={image} alt={title} className="feature-image" />
      </motion.div>
    </motion.div>
  );
};

export default AnimatedFeature;