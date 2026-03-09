import Link from "next/link";
import { ArrowRight, Shield, Clock, Bell, Code, CheckCircle, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";

function ProductDiagram() {
  return (
    <div className="relative mx-auto mt-16 w-full max-w-3xl">
      <div className="rounded-xl border border-border bg-card p-6 shadow-2xl shadow-primary/5">
        {/* Terminal header */}
        <div className="mb-4 flex items-center gap-2">
          <div className="size-3 rounded-full bg-destructive/60" />
          <div className="size-3 rounded-full bg-chart-5/60" />
          <div className="size-3 rounded-full bg-chart-3/60" />
          <span className="ml-3 font-mono text-xs text-muted-foreground">agent-workflow.ts</span>
        </div>
        
        {/* Code flow visualization */}
        <div className="space-y-4 font-mono text-sm">
          {/* Agent action */}
          <div className="flex items-start gap-3">
            <div className="flex size-6 shrink-0 items-center justify-center rounded bg-chart-1/20 text-chart-1">
              <Code className="size-3.5" />
            </div>
            <div>
              <p className="text-muted-foreground">
                <span className="text-chart-3">agent</span>.<span className="text-foreground">execute</span>(
                <span className="text-chart-5">{'"delete_user"'}</span>, {"{"} <span className="text-chart-1">userId</span>: <span className="text-chart-5">{'"usr_123"'}</span> {"}"})
              </p>
            </div>
          </div>
          
          {/* Arrow */}
          <div className="flex items-center gap-3 pl-9">
            <div className="h-8 w-px bg-border" />
          </div>
          
          {/* AgentSeam intercept */}
          <div className="flex items-start gap-3">
            <div className="flex size-6 shrink-0 items-center justify-center rounded bg-primary/20 text-primary">
              <Shield className="size-3.5" />
            </div>
            <div className="flex-1 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="mb-2 text-xs font-medium text-primary">AgentSeam Approval Required</p>
              <p className="text-muted-foreground">
                Action <span className="text-foreground">delete_user</span> needs approval
              </p>
              <div className="mt-3 flex gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-chart-3/20 px-2 py-0.5 text-xs text-chart-3">
                  <CheckCircle className="size-3" /> Approve
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/20 px-2 py-0.5 text-xs text-destructive">
                  Reject
                </span>
              </div>
            </div>
          </div>
          
          {/* Arrow */}
          <div className="flex items-center gap-3 pl-9">
            <div className="h-8 w-px bg-border" />
          </div>
          
          {/* Notification */}
          <div className="flex items-start gap-3">
            <div className="flex size-6 shrink-0 items-center justify-center rounded bg-chart-5/20 text-chart-5">
              <Bell className="size-3.5" />
            </div>
            <div>
              <p className="text-muted-foreground">
                Notified via <span className="text-foreground">Slack</span> • Waiting for response...
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -inset-4 -z-10 rounded-2xl bg-gradient-to-b from-primary/10 via-transparent to-transparent opacity-50 blur-2xl" />
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

export default function MarketingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 pb-24 pt-20 md:pt-32">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground">
            <span className="size-1.5 rounded-full bg-chart-3" />
            Now available for MCP servers
          </div>
          
          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Human-in-the-loop for
            <br />
            <span className="text-primary">risky AI actions</span>
          </h1>
          
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            AgentSeam is a lightweight approval layer that intercepts risky agent actions,
            notifies your team via Slack, and waits for human approval before proceeding.
          </p>
          
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="h-11 px-6" asChild>
              <Link href="/signup">
                Start building
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="h-11 px-6" asChild>
              <Link href="https://github.com/cjones6489/AgentSeam">
                View on GitHub
              </Link>
            </Button>
          </div>
        </div>
        
        <ProductDiagram />
        
        {/* Background gradient */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
      </section>

      {/* Features Section */}
      <section id="features" className="border-t border-border/40 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Everything you need for safe agent operations
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Built for developers who need to ship AI agents without compromising on safety.
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={Shield}
              title="Policy-based interception"
              description="Define which actions require approval based on action type, parameters, or custom logic. Let safe actions pass through automatically."
            />
            <FeatureCard
              icon={Bell}
              title="Slack notifications"
              description="Get instant notifications in your Slack workspace when an action needs approval. Approve or reject directly from Slack."
            />
            <FeatureCard
              icon={Clock}
              title="Configurable timeouts"
              description="Set expiration times for pending approvals. Actions automatically expire if not reviewed within your specified window."
            />
            <FeatureCard
              icon={Code}
              title="Simple SDK"
              description="Wrap your agent actions with a single function call. The SDK handles submission, polling, and result retrieval."
            />
            <FeatureCard
              icon={Zap}
              title="MCP proxy support"
              description="Use our MCP proxy to add approval workflows to any MCP server without modifying the underlying tools."
            />
            <FeatureCard
              icon={CheckCircle}
              title="Full audit trail"
              description="Every action, approval, and rejection is logged with timestamps and user attribution for compliance and debugging."
            />
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
            Ready to ship safer agents?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Get started in minutes. Free for development, predictable pricing for production.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="h-11 px-6" asChild>
              <Link href="/signup">
                Get started for free
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="h-11 px-6" asChild>
              <Link href="https://github.com/cjones6489/AgentSeam">
                Read the docs
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
