/**
 * Secure logging utility that only logs in development environment
 * Prevents sensitive information from being exposed in production browser DevTools
 */

const isDev = import.meta.env.DEV;

export const logger = {
  /**
   * Log error messages - only visible in development
   */
  error: (message: string, error?: unknown): void => {
    if (isDev) {
      console.error(message, error);
    }
  },

  /**
   * Log warning messages - only visible in development
   */
  warn: (message: string, data?: unknown): void => {
    if (isDev) {
      console.warn(message, data);
    }
  },

  /**
   * Log info messages - only visible in development
   */
  info: (message: string, data?: unknown): void => {
    if (isDev) {
      console.info(message, data);
    }
  },

  /**
   * Log debug messages - only visible in development
   */
  debug: (message: string, data?: unknown): void => {
    if (isDev) {
      console.log(message, data);
    }
  },
};
