/** An error that is safe to show to the client. */
export class HttpError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} code short machine-readable code, e.g. NOT_FOUND
   * @param {string} [message] human readable text
   * @param {Array<{path: string, message: string}>} [issues] field-level problems
   */
  constructor(status, code, message, issues) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

export const notFound = (what = 'Not found') => new HttpError(404, 'NOT_FOUND', what);
export const forbidden = (msg = 'You do not have permission to do this') => new HttpError(403, 'FORBIDDEN', msg);
export const unauthorized = (msg = 'Please sign in') => new HttpError(401, 'UNAUTHORIZED', msg);
export const badRequest = (msg, issues) => new HttpError(400, 'BAD_REQUEST', msg, issues);
export const validation = (issues) => new HttpError(400, 'VALIDATION', 'Please fix the highlighted fields', issues);
