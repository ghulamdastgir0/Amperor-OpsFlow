"use client";

import { useRef, useState, type FormEvent } from "react";
import { UploadCloud, FileText } from "lucide-react";
import { policiesApi } from "@/lib/api";
import type { PolicyDocument } from "@/lib/types";
import { Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function PolicyUploadForm({ onCreated }: { onCreated: (policy: PolicyDocument) => void }) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [version, setVersion] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleFile(file: File) {
    setSelectedFile(file);
    setContent("");
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
  }

  function clearFile() {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const policy = selectedFile
        ? await policiesApi.uploadPolicyFile({
            file: selectedFile,
            title,
            sourceUrl: sourceUrl || undefined,
            version: version || undefined,
          })
        : await policiesApi.createPolicy({
            title,
            content,
            sourceUrl: sourceUrl || undefined,
            version: version || undefined,
          });
      onCreated(policy);
      toast.success(`"${policy.title}" is now searchable by the Assistant.`);
      setTitle("");
      setContent("");
      setSourceUrl("");
      setVersion("");
      clearFile();
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(message ?? "Could not save this policy. Check the fields and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-slate-50/60 px-6 py-8 text-center hover:border-primary hover:bg-indigo-50/40 dark:bg-white/[0.03] dark:hover:bg-indigo-500/10">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {selectedFile ? (
          <>
            <FileText className="size-6 text-primary" aria-hidden />
            <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
            <p className="text-xs text-muted">Text will be extracted automatically — click to choose a different file</p>
          </>
        ) : (
          <>
            <UploadCloud className="size-6 text-primary" aria-hidden />
            <p className="text-sm font-medium text-foreground">Upload a policy document</p>
            <p className="text-xs text-muted">.pdf, .txt, or .md — or paste the text below</p>
          </>
        )}
      </label>

      {selectedFile && (
        <button
          type="button"
          onClick={clearFile}
          className="-mt-2 w-fit text-xs font-medium text-muted hover:text-foreground hover:underline"
        >
          Remove file and paste text instead
        </button>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Title"
          placeholder="e.g. Travel & Expense Policy"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <Input
          label="Version"
          placeholder="e.g. 2.1"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        />
      </div>

      <Input
        label="Source URL"
        hint="Optional — a link to the source of truth (Notion, Confluence, etc.)"
        placeholder="https://…"
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
      />

      {!selectedFile && (
        <Textarea
          label="Policy text"
          hint="The Assistant cites this content when answering questions or checking requests against policy."
          placeholder="Paste the full policy text here…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          required
        />
      )}

      <Button type="submit" isLoading={isSubmitting} className="w-fit">
        {isSubmitting ? "Saving…" : "Save Policy"}
      </Button>
    </form>
  );
}
