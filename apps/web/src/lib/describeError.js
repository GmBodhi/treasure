/** Map a raw getUserMedia / MindAR failure onto copy a user can act on. */
export function describeError(err) {
  const name = err?.name ?? '';
  const message = err?.message ?? String(err);

  if (!window.isSecureContext) {
    return {
      title: 'HTTPS required',
      body: 'Browsers only expose the camera on secure origins. Open this page over HTTPS or via localhost.',
    };
  }
  if (name === 'NotAllowedError' || /permission/i.test(message)) {
    return {
      title: 'Camera blocked',
      body: 'Camera access was denied. Allow it in your browser site settings, then try again.',
    };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return { title: 'No camera found', body: 'This device has no camera the browser can use.' };
  }
  if (name === 'NotReadableError') {
    return { title: 'Camera busy', body: 'Another app is using the camera. Close it and try again.' };
  }
  if (/target/i.test(message) && /not/i.test(message)) {
    return { title: 'Missing target file', body: message };
  }
  return { title: 'Could not start AR', body: message };
}
