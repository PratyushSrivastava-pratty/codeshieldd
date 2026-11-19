import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:brightness-110 hover:-translate-y-0.5",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-110",
        outline: "border border-input bg-surface/60 text-foreground hover:bg-surface-2 hover:border-gold/50",
        secondary: "bg-surface-2 text-foreground hover:bg-muted",
        ghost: "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
        link: "text-gold underline-offset-4 hover:underline",
        neon: "bg-gradient-gold text-primary-foreground glow-gold hover:-translate-y-1 hover:scale-[1.03] hover:brightness-110",
        cyber: "border border-electric/50 bg-electric/10 text-electric glow-electric hover:bg-electric/20 hover:-translate-y-0.5",
        pink: "border border-pink/50 bg-pink/10 text-pink glow-pink hover:bg-pink/20 hover:-translate-y-0.5",
        success: "bg-gradient-lime text-primary-foreground glow-lime hover:-translate-y-0.5 hover:brightness-110",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-7 text-base",
        xl: "h-14 px-8 text-base sm:text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
