import { LANGUAGE_MAP } from './constants.js';

/**
 * Parse ISO 8601 duration to readable format
 * Used by search, youtube, and vimeo routes
 */
export function parseDuration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return 'N/A';

  const hours = (match[1] || '').replace('H', '');
  const minutes = (match[2] || '').replace('M', '');
  const seconds = (match[3] || '').replace('S', '');

  if (hours) {
    return `${hours}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
  }
  return `${minutes || '0'}:${seconds.padStart(2, '0')}`;
}

/**
 * Format seconds to readable duration
 * Used by vimeo route
 */
export function formatDuration(seconds) {
  if (!seconds) return '';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get target language from language code
 */
export function getTargetLanguage(language) {
  return LANGUAGE_MAP[language?.toLowerCase()] || 'English';
}

/**
 * Validate content length
 */
export function validateContent(content, minLength, fieldName) {
  if (!content) {
    return { valid: false, error: `${fieldName} is required` };
  }
  if (content.length < minLength) {
    return { 
      valid: false, 
      error: `${fieldName} is too short`,
      details: `${fieldName} must be at least ${minLength} characters long`
    };
  }
  return { valid: true };
}

/**
 * Standard error response handler
 */
export function handleError(res, error, message, statusCode = 500) {
  console.error(`❌ ${message}:`, error);
  console.error("Error stack:", error.stack);
  res.status(statusCode).json({ 
    error: message, 
    details: error.message 
  });
}
