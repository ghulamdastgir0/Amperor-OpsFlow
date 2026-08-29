"use client";

import Link from "next/link";
import {
  Sparkles,
  MessageSquare,
  Workflow,
  ShieldCheck,
  Wallet,
  ArrowRight,
  ScrollText,
  GitBranch,
  CheckCircle2,
} from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";

const EASE = [0.16, 1, 0.3, 1] as const;

const FEATURES = [
  {
    icon: MessageSquare,
    title: "One conversation, not five forms",
    description:
      "Employees ask for what they need in plain language — expenses, purchases, time off — and the Assistant drafts the request, no forms to hunt down.",
  },
  {
    icon: ScrollText,
    title: "Grounded in your actual policy",
    description:
      "Every request is checked against your uploaded policy documents, with the exact clause cited — not a generic compliance guess.",
  },
  {
    icon: GitBranch,
    title: "Routes itself, correctly",
    description:
      "Manager, Finance, or the right specialist team — OpsFlow figures out who needs to act based on amount, department, and live availability.",
  },
  {
    icon: Wallet,
    title: "Budgets that stay honest",
    description:
      "Every dollar is reserved or spent, never both, never neither — so your department budgets reflect reality down to the cent.",
  },
  {
    icon: ShieldCheck,
    title: "Built for real organizations",
    description:
      "Role-based access, per-manager spend delegation, and a full audit trail on every decision — not a toy workflow demo.",
  },
  {
    icon: Workflow,
    title: "Lives where work already happens",
    description:
      "Slack-native from the ground up — file, approve, and get notified without ever opening another tab.",
  },
];

const STEPS = [
  {
    title: "Ask",
    description: "“Please reimburse this $85 client dinner” — typed in Slack or the web assistant.",
  },
  {
    title: "Route",
    description: "OpsFlow checks policy, checks budget, and finds the right approver automatically.",
  },
  {
    title: "Resolve",
    description: "Approved, paid, and logged — with a full citation trail, no spreadsheet required.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

// The public marketing page shown at "/" to signed-out visitors — see
// src/app/page.tsx, which decides whether to render this or the
// authenticated dashboard based on auth state.
export function LandingContent() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" aria-hidden />
            </div>
            <span className="font-heading text-base font-semibold text-foreground">OpsFlow</span>
          </div>
          <Link href="/login">
            <Button size="sm">
              Sign in
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -top-32 right-[-10%] size-[32rem] rounded-full bg-primary/20 blur-3xl"
          animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.7, 0.5] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 left-[-10%] size-[28rem] rounded-full bg-secondary/20 blur-3xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />

        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 pb-24 pt-20 text-center sm:pt-28">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted shadow-[var(--shadow-sm)]"
          >
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            AI-assisted corporate operations
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05, ease: EASE }}
            className="font-heading text-4xl font-semibold leading-tight text-foreground sm:text-5xl"
          >
            Let AI handle the busywork of{" "}
            <span className="bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
              corporate operations
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease: EASE }}
            className="max-w-xl text-base text-muted sm:text-lg"
          >
            Draft, route, and approve expenses, purchases, and leave requests in one conversational
            command canvas — checked against your policy, routed to the right person, and fully
            audited, from Slack or the web.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18, ease: EASE }}
            className="mt-2 flex flex-col items-center gap-3 sm:flex-row"
          >
            <Link href="/login">
              <Button size="md" className="px-6">
                Sign in to your workspace
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </Link>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              See how it works
            </a>
          </motion.div>

          {/* Mock chat preview */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.28, ease: EASE }}
            className="mt-10 w-full max-w-lg rounded-2xl border border-border bg-surface p-4 text-left shadow-[var(--shadow-lg)]"
          >
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <span className="size-2.5 rounded-full bg-danger/60" />
              <span className="size-2.5 rounded-full bg-warning/60" />
              <span className="size-2.5 rounded-full bg-success/60" />
              <span className="ml-2 text-xs font-medium text-muted">Assistant</span>
            </div>
            <div className="flex flex-col gap-3 pt-3">
              <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
                Please reimburse this $85 client dinner receipt.
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.3 }}
                className="max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-foreground"
              >
                Filed and routed to Finance for approval — no policy issues found. I&apos;ll let you
                know as soon as it&apos;s decided.
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          transition={{ duration: 0.4, ease: EASE }}
          className="mx-auto mb-14 max-w-2xl text-center"
        >
          <h2 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
            Everything an ops team actually needs
          </h2>
          <p className="mt-3 text-sm text-muted sm:text-base">
            Not another approval-chain builder — a system that understands the request, the policy,
            and who&apos;s available to act on it.
          </p>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={fadeUp}
                transition={{ duration: 0.4, delay: (index % 3) * 0.08, ease: EASE }}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary-tint text-primary">
                  <Icon className="size-5" aria-hidden />
                </div>
                <h3 className="font-heading text-sm font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-border bg-surface-2/60 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            transition={{ duration: 0.4, ease: EASE }}
            className="mb-14 text-center"
          >
            <h2 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
              From ask to resolved, in three steps
            </h2>
          </motion.div>

          <div className="relative grid gap-10 sm:grid-cols-3">
            <div className="absolute left-0 right-0 top-6 hidden h-px bg-border sm:block" aria-hidden />
            {STEPS.map((step, index) => (
              <motion.div
                key={step.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={fadeUp}
                transition={{ duration: 0.4, delay: index * 0.12, ease: EASE }}
                className="relative flex flex-col items-center gap-3 text-center sm:items-start sm:text-left"
              >
                <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full border-4 border-background bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="font-heading text-base font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm text-muted">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 via-indigo-600 to-teal-600" aria-hidden />
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          transition={{ duration: 0.5, ease: EASE }}
          className="relative mx-auto flex max-w-2xl flex-col items-center gap-5 px-6 py-20 text-center text-white"
        >
          <CheckCircle2 className="size-8" aria-hidden />
          <h2 className="font-heading text-2xl font-semibold sm:text-3xl">
            Ready to let OpsFlow run the busywork?
          </h2>
          <p className="max-w-md text-sm text-indigo-100">
            Sign in with your workspace to start filing, routing, and approving — right from
            Slack or the web.
          </p>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-6 text-sm font-medium text-indigo-700 transition-opacity hover:opacity-90"
          >
            Sign in to your workspace
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </motion.div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-8 text-center text-xs text-muted">
        © {new Date().getFullYear()} OpsFlow. All rights reserved.
      </footer>
    </div>
  );
}
