"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-base font-bold transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:scale-[0.98] motion-reduce:transform-none disabled:pointer-events-none disabled:opacity-50",
  { variants: { variant: {
    primary: "bg-primary text-white shadow-[0_8px_18px_rgba(23,97,90,0.16)] hover:bg-blue-700",
    secondary: "border-2 border-border bg-card text-foreground hover:border-primary/40 hover:bg-blue-50 dark:hover:bg-blue-950/50",
    success: "bg-success text-white shadow-[0_8px_18px_rgba(24,122,84,0.15)] hover:bg-green-700",
    danger: "bg-danger text-white hover:bg-red-700",
    ghost: "bg-transparent text-foreground hover:bg-blue-50 dark:hover:bg-blue-950/40",
    warning: "bg-amber-50 text-amber-950 border-2 border-amber-200 hover:bg-amber-100",
  }, size: { default: "min-h-12", large: "min-h-16 px-6 text-xl", icon: "h-12 w-12 p-0" } }, defaultVariants: { variant: "primary", size: "default" } }
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
});
Button.displayName = "Button";
