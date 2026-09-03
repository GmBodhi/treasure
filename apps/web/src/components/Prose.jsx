/**
 * Authored clue copy, rendered as HTML.
 *
 * Briefs and reveals carry real markup — `<code>` for ciphertext and log
 * extracts, `<br>` for the line structure a puzzle depends on, `<em>` for quoted
 * documents. Rendering those as text would print the tags on screen, and a
 * ciphertext whose line breaks collapsed would be unsolvable.
 *
 * `dangerouslySetInnerHTML` is safe here in the way it is never safe for user
 * input: this content is source code in `lib/hunt.js`, authored in the repo and
 * shipped in the bundle. It carries exactly the trust of the JSX around it. If
 * clue copy ever starts arriving from outside the build, this needs sanitising.
 *
 * The child styling lives here rather than on each caller so a `<code>` block
 * reads the same in the level list, on the camera screen and in the reveal.
 */
const CHILDREN =
  '[&_code]:font-mono [&_code]:text-[0.9em] [&_code]:leading-[1.7] ' +
  '[&_code]:break-words [&_code]:text-paper ' +
  '[&_em]:not-italic [&_em]:text-paper/90 ' +
  '[&_strong]:font-semibold [&_strong]:text-accent';

export default function Prose({ html, className = '' }) {
  if (!html) return null;
  return (
    <div
      className={`${CHILDREN} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
