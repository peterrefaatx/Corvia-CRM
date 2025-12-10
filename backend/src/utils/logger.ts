/**
 * Structured logging utility
 * Provides consistent logging across the application
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, error?: Error | any, context?: LogContext): void {
    const errorContext = {
      ...context,
      ...(error && {
        error: error.message,
        stack: this.isDevelopment ? error.stack : undefined
      })
    };
    console.error(this.formatMessage('error', message, errorContext));
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  // Specific logging methods for common scenarios
  apiRequest(method: string, path: string, userId?: string): void {
    this.info('API Request', { method, path, userId });
  }

  apiResponse(method: string, path: string, statusCode: number, duration: number): void {
    this.info('API Response', { method, path, statusCode, duration });
  }

  dbQuery(query: string, duration: number): void {
    this.debug('Database Query', { query, duration });
  }

  jobStart(jobName: string): void {
    this.info(`Job Started: ${jobName}`);
  }

  jobComplete(jobName: string, duration: number, recordsProcessed?: number): void {
    this.info(`Job Completed: ${jobName}`, { duration, recordsProcessed });
  }

  jobError(jobName: string, error: Error): void {
    this.error(`Job Failed: ${jobName}`, error);
  }

  authAttempt(username: string, success: boolean, reason?: string): void {
    this.info('Authentication Attempt', { username, success, reason });
  }

  securityEvent(event: string, details: LogContext): void {
    this.warn(`Security Event: ${event}`, details);
  }
}

// Export singleton instance
export const logger = new Logger();
