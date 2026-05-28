/**
 * Renders HTML stored in Firestore (output from the Quill editor).
 * Uses DOMPurify (loaded via CDN in index.html) to strip any unsafe tags
 * before injecting the HTML into the DOM.
 */
export default function RichText({ html, className = '' }) {
  if (!html) return null;

  const clean = window.DOMPurify
    ? window.DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'strong', 'em', 'a',
                       'ul', 'ol', 'li', 'br', 'hr', 'blockquote', 'pre', 'code'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
      })
    : html;

  return (
    <div
      className={`rich-text ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
