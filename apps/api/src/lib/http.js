import { HTTPException } from 'hono/http-exception';

/**
 * The Express port kept `badRequest()` / `notFound()` as the vocabulary for
 * failing a request, so these wrap Hono's exception in the same shape. The JSON
 * body is defined here rather than in a handler so every error response — thrown
 * from anywhere — looks identical to the client.
 */
function fail(status, message, details) {
  return new HTTPException(status, {
    res: Response.json({ error: message, details }, { status }),
  });
}

export const badRequest = (message, details) => fail(400, message, details);
export const notFound = (message = 'Not found') => fail(404, message);
export const tooLarge = (message) => fail(413, message);
