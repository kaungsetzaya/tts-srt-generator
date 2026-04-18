/**
 * Shared error types for LUMIX.
 * Used by backend route handlers and can be imported by frontend error boundaries.
 */
export class HttpError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "HttpError";
    }
}
// Convenience constructors
export const BadRequestError = (msg) => new HttpError(400, msg);
export const UnauthorizedError = (msg) => new HttpError(401, msg);
export const ForbiddenError = (msg) => new HttpError(403, msg);
export const NotFoundError = (msg) => new HttpError(404, msg);
