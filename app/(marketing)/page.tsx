"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Shield, Clock, Bell, Code, CheckCircle, Zap, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";

function ApprovalFlowDemo() {
  const [step, setStep] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => (s + 1) % 5);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative mx-auto mt-16 w-full max-w-4xl">
      <div className="grid gap-4 md:grid-cols-4">
        {/* Step 1: Agent proposes action */}
        <div
          className={`rounded-xl border bg-card p-5 transition-all duration-500 ${
            step >= 0 ? "border-border opacity-100 translate-y-0" : "border-transparent opacity-0 translate-y-4"
          } ${step === 0 ? "ring-2 ring-primary/50" : ""}`}
        >
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <Code className="size-4 text-foreground" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Agent</span>
          </div>
          <p className="mb-3 text-sm font-medium text-foreground">Proposes action</p>
          <div className="rounded-md bg-muted/50 p-2 font-mono text-xs text-muted-foreground">
            <span className="text-chart-3">delete_user</span>
            <br />
            <span className="text-muted-foreground">id: usr_847</span>
          </div>
        </div>

        {/* Step 2: Action appears in inbox */}
        <div
          className={`rounded-xl border bg-card p-5 transition-all duration-500 ${
            step >= 1 ? "border-border opacity-100 translate-y-0" : "border-transparent opacity-0 translate-y-4"
          } ${step === 1 ? "ring-2 ring-primary/50" : ""}`}
        >
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="size-4 text-primary" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">AgentSeam</span>
          </div>
          <p className="mb-3 text-sm font-medium text-foreground">Queued for review</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-chart-5" />
            Pending approval
          </div>
        </div>

        {/* Step 3: Human approves */}
        <div
          className={`rounded-xl border bg-card p-5 transition-all duration-500 ${
            step >= 2 ? "border-border opacity-100 translate-y-0" : "border-transparent opacity-0 translate-y-4"
          } ${step === 2 ? "ring-2 ring-primary/50" : ""}`}
        >
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <Bell className="size-4 text-foreground" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">You</span>
          </div>
          <p className="mb-3 text-sm font-medium text-foreground">Review & approve</p>
          <div className="flex gap-2">
            <button
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                step >= 3 ? "bg-chart-3/20 text-chart-3" : "bg-muted text-muted-foreground"
              }`}
            >
              <Check className="size-3" /> Approve
            </button>
            <button className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              <X className="size-3" /> Reject
            </button>
          </div>
        </div>

        {/* Step 4: Action executes */}
        <div
          className={`rounded-xl border bg-card p-5 transition-all duration-500 ${
            step >= 3 ? "border-border opacity-100 translate-y-0" : "border-transparent opacity-0 translate-y-4"
          } ${step === 3 || step === 4 ? "ring-2 ring-chart-3/50" : ""}`}
        >
          <div className="mb-3 flex items-center gap-2">
            <div className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
              step >= 4 ? "bg-chart-3/20" : "bg-muted"
            }`}>
              <CheckCircle className={`size-4 transition-colors ${step >= 4 ? "text-chart-3" : "text-foreground"}`} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Result</span>
          </div>
          <p className="mb-3 text-sm font-medium text-foreground">Action executed</p>
          <div className={`text-xs transition-colors ${step >= 4 ? "text-chart-3" : "text-muted-foreground"}`}>
            {step >= 4 ? "Successfully completed" : "Waiting..."}
          </div>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="mt-6 flex justify-center gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 w-8 rounded-full transition-colors duration-300 ${
              step >= i ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Shield;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-border hover:bg-card">
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
        <Icon className="size-5" />
      </div>
      <h3 className="mb-2 font-semibold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

// Simulated action data for the live feed
const DEMO_ACTIONS = [
  { action: "delete_user", params: "usr_847", risk: "high", icon: "🗑️" },
  { action: "send_email", params: "bulk_campaign", risk: "medium", icon: "📧" },
  { action: "transfer_funds", params: "$2,400", risk: "high", icon: "💸" },
  { action: "modify_permissions", params: "admin_role", risk: "high", icon: "🔐" },
  { action: "publish_content", params: "blog_post", risk: "low", icon: "📝" },
  { action: "delete_database", params: "prod_db", risk: "critical", icon: "💀" },
];

function LiveActionFeed() {
  const [actions, setActions] = useState<Array<{
    id: number;
    action: string;
    params: string;
    status: "pending" | "approved" | "rejected";
    icon: string;
  }>>([]);
  const [nextId, setNextId] = useState(0);

  useEffect(() => {
    // Add a new action every 2 seconds
    const addInterval = setInterval(() => {
      const template = DEMO_ACTIONS[Math.floor(Math.random() * DEMO_ACTIONS.length)];
      setActions((prev) => {
        const newActions = [
          { id: nextId, ...template, status: "pending" as const },
          ...prev.slice(0, 4),
        ];
        return newActions;
      });
      setNextId((n) => n + 1);
    }, 2000);

    // Resolve pending actions after a delay
    const resolveInterval = setInterval(() => {
      setActions((prev) =>
        prev.map((a) =>
          a.status === "pending" && Math.random() > 0.3
            ? { ...a, status: Math.random() > 0.2 ? "approved" : "rejected" }
            : a
        )
      );
    }, 1500);

    return () => {
      clearInterval(addInterval);
      clearInterval(resolveInterval);
    };
  }, [nextId]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="size-2 animate-pulse rounded-full bg-chart-3" />
          <span className="text-sm font-medium text-foreground">Live Action Feed</span>
        </div>
        <span className="text-xs text-muted-foreground">Real-time simulation</span>
      </div>
      
      {/* Actions list */}
      <div className="divide-y divide-border">
        {actions.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Waiting for agent actions...
          </div>
        ) : (
          actions.map((action) => (
            <div
              key={action.id}
              className="flex items-center justify-between px-4 py-3 transition-all duration-500 animate-in slide-in-from-top-2"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{action.icon}</span>
                <div>
                  <p className="font-mono text-sm text-foreground">{action.action}</p>
                  <p className="text-xs text-muted-foreground">{action.params}</p>
                </div>
              </div>
              <div
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all duration-300 ${
                  action.status === "pending"
                    ? "bg-chart-5/20 text-chart-5 animate-pulse"
                    : action.status === "approved"
                    ? "bg-chart-3/20 text-chart-3"
                    : "bg-destructive/20 text-destructive"
                }`}
              >
                {action.status === "pending" ? "Pending" : action.status === "approved" ? "Approved" : "Rejected"}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TypewriterCode() {
  const [displayedLines, setDisplayedLines] = useState(0);
  const codeLines = [
    { text: "import", highlight: "keyword" },
    { text: " { AgentSeam } ", highlight: "normal" },
    { text: "from", highlight: "keyword" },
    { text: " 'agentseam'", highlight: "string" },
  ];
  
  const fullCode = `import { AgentSeam } from 'agentseam'

const seam = new AgentSeam({
  apiKey: process.env.AGENTSEAM_KEY,
  slack: { channel: '#approvals' }
})

// Wrap risky actions
const result = await seam.guard({
  action: 'delete_user',
  payload: { userId },
  reason: 'User requested deletion'
})

if (result.approved) {
  await deleteUser(userId)
}`;

  const lines = fullCode.split('\n');

  useEffect(() => {
    if (displayedLines < lines.length) {
      const timer = setTimeout(() => {
        setDisplayedLines((d) => d + 1);
      }, 150);
      return () => clearTimeout(timer);
    } else {
      // Reset after a pause
      const timer = setTimeout(() => {
        setDisplayedLines(0);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [displayedLines, lines.length]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="size-3 rounded-full bg-destructive/60" />
        <div className="size-3 rounded-full bg-chart-5/60" />
        <div className="size-3 rounded-full bg-chart-3/60" />
        <span className="ml-2 font-mono text-xs text-muted-foreground">agent.ts</span>
      </div>
      
      {/* Code content */}
      <div className="p-4 font-mono text-sm">
        <pre className="overflow-x-auto">
          {lines.slice(0, displayedLines).map((line, i) => (
            <div key={i} className="min-h-[1.5rem]">
              <span className="mr-4 inline-block w-4 text-right text-muted-foreground/50">{i + 1}</span>
              <span className="text-muted-foreground">
                {line
                  .replace(/(import|from|const|await|if)/g, '<kw>$1</kw>')
                  .replace(/'[^']*'/g, '<str>$&</str>')
                  .split(/(<kw>.*?<\/kw>|<str>.*?<\/str>)/)
                  .map((part, j) => {
                    if (part.startsWith('<kw>')) {
                      return <span key={j} className="text-chart-3">{part.replace(/<\/?kw>/g, '')}</span>;
                    }
                    if (part.startsWith('<str>')) {
                      return <span key={j} className="text-chart-5">{part.replace(/<\/?str>/g, '')}</span>;
                    }
                    return <span key={j}>{part}</span>;
                  })}
              </span>
            </div>
          ))}
          {displayedLines < lines.length && (
            <div className="min-h-[1.5rem]">
              <span className="mr-4 inline-block w-4 text-right text-muted-foreground/50">{displayedLines + 1}</span>
              <span className="animate-pulse text-primary">▌</span>
            </div>
          )}
        </pre>
      </div>
    </div>
  );
}

export default function MarketingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 pb-24 pt-20 md:pt-32">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Your agents are powerful.
            <br />
            <span className="text-primary">Make sure they{"'"}re safe.</span>
          </h1>
          
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            A lightweight approval layer for risky AI agent actions. Review dangerous
            operations before they execute.
          </p>
          
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="h-12 px-6" asChild>
              <Link href="/signup">
                Get started
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="h-12 px-6" asChild>
              <Link href="https://github.com/cjones6489/AgentSeam" target="_blank" rel="noopener noreferrer">
                View on GitHub
              </Link>
            </Button>
          </div>
        </div>
        
        <ApprovalFlowDemo />
        
        {/* Background gradient */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
      </section>

      {/* Interactive Demo Section */}
      <section id="features" className="border-t border-border/40 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              See it in action
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              A few lines of code. Full visibility into every risky action.
            </p>
          </div>
          
          {/* Two-column demo: Code + Live Feed */}
          <div className="grid gap-6 lg:grid-cols-2">
            <TypewriterCode />
            <LiveActionFeed />
          </div>
          
          {/* Feature highlights below */}
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
                <Shield className="size-5 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold text-foreground">Policy-based</h3>
              <p className="text-sm text-muted-foreground">Define rules for which actions need human review</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
                <Bell className="size-5 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold text-foreground">Slack-native</h3>
              <p className="text-sm text-muted-foreground">Approve or reject directly from Slack</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
                <Zap className="size-5 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold text-foreground">MCP compatible</h3>
              <p className="text-sm text-muted-foreground">Works with any MCP server out of the box</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-border/40 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              How it works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Three simple steps to add human oversight to your AI agents.
            </p>
          </div>
          
          <div className="space-y-8">
            {[
              {
                step: "1",
                title: "Submit risky actions",
                description: "Your agent calls the AgentSeam API when it wants to perform a risky action. The action is queued for approval.",
                code: `await agentseam.submit({
  action: "delete_user",
  payload: { userId: "usr_123" }
});`,
              },
              {
                step: "2",
                title: "Notify your team",
                description: "AgentSeam sends a notification to your configured Slack channel with action details and approve/reject buttons.",
                code: null,
              },
              {
                step: "3",
                title: "Continue or abort",
                description: "Once approved, your agent receives the green light and executes the action. Rejections are handled gracefully.",
                code: `const result = await agentseam.wait(actionId);
if (result.status === "approved") {
  // Execute the action
}`,
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-6">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-bold text-primary">
                  {item.step}
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 font-semibold text-foreground">{item.title}</h3>
                  <p className="mb-4 text-muted-foreground">{item.description}</p>
                  {item.code && (
                    <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-sm text-muted-foreground">
                      <code>{item.code}</code>
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border/40 px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Start building
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Free to get started. No credit card required.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="h-12 px-6" asChild>
              <Link href="/signup">
                Get started
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="h-12 px-6" asChild>
              <Link href="https://github.com/cjones6489/AgentSeam" target="_blank" rel="noopener noreferrer">
                Documentation
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
