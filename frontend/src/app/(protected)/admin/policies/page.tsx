"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { policiesApi } from "@/lib/api";
import type { PolicyDocument } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { PolicyUploadForm } from "@/components/admin/PolicyUploadForm";
import { PolicyList } from "@/components/admin/PolicyList";

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<PolicyDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    policiesApi
      .listPolicies()
      .then(setPolicies)
      .catch(() => setError("Could not load company policies. Is the backend running?"));
  }, []);

  return (
    <div>
      <PageHeader
        title="Company Policies"
        description="Upload your organization's policy documents so the Assistant can cite them when drafting and reviewing requests."
      />

      <div className="flex flex-col gap-8">
        <Card>
          <h2 className="font-heading mb-4 text-sm font-semibold text-foreground">Upload a policy</h2>
          <PolicyUploadForm onCreated={(policy) => setPolicies((prev) => [policy, ...(prev ?? [])])} />
        </Card>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <div>
          <h2 className="font-heading mb-3 text-sm font-semibold text-foreground">Uploaded policies</h2>
          <PolicyList policies={policies} />
        </div>
      </div>
    </div>
  );
}
