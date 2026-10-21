/**
 * Renders CMS body text: paragraphs separated by blank lines; lines starting with "## " become subheadings.
 * <RichText body={page.body} headingLevel={2} />
 */
export function parseBody(body) {
  if (!body) return [];
  const out = [];
  String(body)
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .forEach((block) => {
      let para = [];
      const flush = () => {
        if (para.length) out.push({ type: 'p', text: para.join(' ') });
        para = [];
      };
      block.split('\n').forEach((raw) => {
        const line = raw.trim();
        if (!line) return;
        if (line.startsWith('## ')) {
          flush();
          out.push({ type: 'h', text: line.slice(3).trim() });
        } else para.push(line);
      });
      flush();
    });
  return out;
}

export default function RichText({ body, headingLevel = 2, className = '' }) {
  const H = `h${Math.min(6, Math.max(2, headingLevel))}`;
  const blocks = parseBody(body);
  if (!blocks.length) return null;
  return (
    <div className={`prose pub-rich ${className}`}>
      {blocks.map((b, i) => (b.type === 'h' ? <H key={i}>{b.text}</H> : <p key={i}>{b.text}</p>))}
    </div>
  );
}
