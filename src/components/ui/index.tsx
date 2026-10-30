import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// shadcn/ui-style primitives (copied-in, themed with PHYSICAL BGC tokens).

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 min-h-11 px-4 text-sm",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white hover:bg-brand-strong",
        secondary: "bg-surface-2 text-fg border border-line hover:bg-line",
        ghost: "text-fg hover:bg-surface-2",
        danger: "bg-bad/15 text-bad border border-bad/40 hover:bg-bad/25",
        accent: "bg-accent text-black hover:brightness-110",
      },
      size: { default: "", lg: "min-h-14 px-6 text-base", sm: "min-h-9 px-3 text-xs" },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = "Button";
export { buttonVariants };

const field =
  "w-full rounded-md border border-line bg-surface-2 px-3 min-h-11 text-base text-fg placeholder:text-muted/70 focus:border-accent disabled:opacity-60";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(field, className)} {...p} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => <textarea ref={ref} className={cn(field, "min-h-24 py-2", className)} {...p} />,
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cn(field, className)} {...p} />
));
Select.displayName = "Select";

export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-fg mb-1.5 block text-sm font-medium", className)} {...p} />;
}

export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-muted mt-1 text-xs">{hint}</p>}
      {error && (
        <p role="alert" className="text-bad mt-1 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-line bg-surface rounded-md border", className)} {...p} />;
}
export function CardHeader({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-line flex items-center justify-between gap-3 border-b px-4 py-3", className)} {...p} />;
}
export function CardTitle({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("font-display text-lg font-semibold", className)} {...p} />;
}
export function CardBody({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...p} />;
}

const badgeVariants = cva("inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold", {
  variants: {
    tone: {
      neutral: "bg-surface-2 text-muted border border-line",
      ok: "bg-ok/15 text-ok",
      warn: "bg-warn/15 text-warn",
      bad: "bg-bad/15 text-bad",
      brand: "bg-brand/20 text-brand",
      accent: "bg-accent/15 text-accent",
    },
  },
  defaultVariants: { tone: "neutral" },
});
export function Badge({ className, tone, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...p} />;
}

export function PageTitle({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl leading-none font-bold sm:text-4xl">{title}</h1>
        {sub && <p className="text-muted mt-2 text-sm">{sub}</p>}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border-line rounded-md border border-dashed p-8 text-center">
      <p className="font-display text-lg">{title}</p>
      {hint && <p className="text-muted mt-1 text-sm">{hint}</p>}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "brand" | "accent" | "ok" | "warn" }) {
  const color =
    tone === "brand"
      ? "text-brand"
      : tone === "accent"
        ? "text-accent"
        : tone === "ok"
          ? "text-ok"
          : tone === "warn"
            ? "text-warn"
            : "text-fg";
  return (
    <Card className="p-4">
      <p className="text-muted text-xs tracking-wider uppercase">{label}</p>
      <p className={cn("tabular font-display mt-1 text-4xl font-bold", color)}>{value}</p>
    </Card>
  );
}
