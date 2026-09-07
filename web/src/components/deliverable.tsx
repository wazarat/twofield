// Renders the niche pack Markdown with a tiny renderer, headings, bullets, bold and paragraphs.
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-medium text-ink">{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
  );
}

export function Deliverable({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`list-${blocks.length}`} className="my-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-muted">
          {list.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^#{1,3}\s/.test(line)) {
      flush();
      const level = line.match(/^#+/)![0].length;
      const label = line.replace(/^#+\s*/, "");
      blocks.push(
        level <= 2 ? (
          <h3 key={blocks.length} className="mt-8 font-display text-xl font-medium tracking-[-0.02em] first:mt-0">{label}</h3>
        ) : (
          <h4 key={blocks.length} className="mt-5 font-display text-base font-medium tracking-[-0.01em]">{label}</h4>
        ),
      );
      continue;
    }
    if (/^[-*]\s|^\d+\.\s/.test(line)) {
      list.push(line.replace(/^[-*]\s|^\d+\.\s/, ""));
      continue;
    }
    flush();
    blocks.push(
      <p key={blocks.length} className="my-3 text-sm leading-relaxed text-ink-muted">
        {inline(line)}
      </p>,
    );
  }
  flush();
  return <div>{blocks}</div>;
}
