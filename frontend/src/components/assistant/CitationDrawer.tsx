import { BookOpen, ScrollText } from "lucide-react";
import type { PolicyCitation } from "@/lib/types";
import { EmptyState } from "@/components/ui/EmptyState";

export function CitationDrawer({ citations }: { citations: PolicyCitation[] }) {
  if (citations.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title="No policy citations"
        description="This request wasn't matched against any policy documents."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {citations.map((citation) => (
        <li key={citation.id} className="rounded-lg border border-border bg-surface-2 p-3.5 text-sm">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <BookOpen className="size-3.5 shrink-0 text-primary" aria-hidden />
            {citation.policyDocument.title}
          </div>
          <p className="mt-1.5 border-l-2 border-primary/30 pl-3 text-muted">{citation.clauseSnippet}</p>
          {citation.policyDocument.sourceUrl && (
            <a
              href={citation.policyDocument.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
            >
              View source
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
