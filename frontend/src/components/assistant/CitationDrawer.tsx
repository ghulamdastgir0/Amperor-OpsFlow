import type { PolicyCitation } from "@/lib/types";

export function CitationDrawer({ citations }: { citations: PolicyCitation[] }) {
  if (citations.length === 0) {
    return <p className="text-sm opacity-60">No policy citations for this request.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {citations.map((citation) => (
        <li key={citation.id} className="border border-black/10 dark:border-white/10 rounded p-3 text-sm">
          <p className="font-medium">{citation.policyDocument.title}</p>
          <p className="opacity-70 mt-1">{citation.clauseSnippet}</p>
        </li>
      ))}
    </ul>
  );
}
