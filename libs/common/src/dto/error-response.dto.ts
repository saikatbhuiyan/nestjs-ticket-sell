export interface ErrorResponse {
  errorCode: string; // unique business error code
  message: string; // human readable
  details?: any; // debugging info (stack, validation, etc.)
  correlationId: string; // for distributed tracing
  timestamp: string; // ISO timestamp
}
