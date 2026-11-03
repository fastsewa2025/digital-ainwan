/**
 * Long text written in the admin's plain text box. Blank lines start a new paragraph and a single
 * line break stays a line break. It is rendered as text (never as HTML), so nothing typed there can run as code.
 */
export function Prose({ text }) {
  if (!text) return null;
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="prose">
      {blocks.map((b, i) => (
        <p key={i} className="prose__p">
          {b.split('\n').flatMap((line, j) => (j === 0 ? [line] : [<br key={`br${j}`} />, line]))}
        </p>
      ))}
    </div>
  );
}
