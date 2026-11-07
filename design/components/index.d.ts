import type { ReactNode, MouseEventHandler } from "react";

/** Primary is ember and appears once per screen. Labels are verbs. */
export interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit";
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
}

/** A word plus a color on a soft ground. Default label is Spanish; pass children to override. */
export interface StatusPillProps {
  status: "verified" | "blocked" | "pending" | "sponsored" | "agent";
  className?: string;
  children?: ReactNode;
}

/** A tokenized asset in a list: name, meta line, price in mono, optional delta. */
export interface AssetRowProps {
  name: string;
  meta?: string;
  price: string;
  currency?: string;
  delta?: string;
  deltaTone?: "up" | "down" | "flat";
  icon?: ReactNode;
  href?: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLElement>;
}

/** Wraps a number in the mono style so no number is set in the sans. */
export interface AmountProps {
  value: string;
  currency?: string;
  size?: "m" | "l";
  muted?: boolean;
  className?: string;
}

export declare const Button: (props: ButtonProps) => JSX.Element;
export declare const StatusPill: (props: StatusPillProps) => JSX.Element;
export declare const AssetRow: (props: AssetRowProps) => JSX.Element;
export declare const Amount: (props: AmountProps) => JSX.Element;
