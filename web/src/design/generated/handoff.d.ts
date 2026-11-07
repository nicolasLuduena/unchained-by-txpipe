import type { JSX } from "react";
import type { ReactNode, MouseEventHandler, ChangeEventHandler } from "react";

export type StampStatus = "verified" | "blocked" | "pending" | "sponsored" | "agent" | "sold" | "cancelled" | "reverted" | "unused";
export type CouponState = "open" | "sold" | "cancelled" | "reverted";

/** Primary is the filled indigo button and appears once per screen. Labels are verbs. */
export interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit";
  disabled?: boolean;
  /** Blocks clicks and shows the working state. Use while signing. */
  busy?: boolean;
  ariaLabel?: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
}

/** A word in a ruled box. The border style carries the state without colour. */
export interface StampProps { status: StampStatus; className?: string; children?: ReactNode; }

/** Every number goes through this, in Jost tabular figures. Sizes: s in rows, m in fields, l for the one headline figure. */
export interface AmountProps { value: string; currency?: string; size?: "s" | "m" | "l"; muted?: boolean; className?: string; }

/** Address or transaction hash, truncated. Links to the explorer when href is set. */
export interface HashProps { value: string; href?: string; className?: string; }

/** Ruled two-column grid of labelled figures. */
export interface FieldsProps { items: { label: string; value: string }[]; className?: string; }

/** The signature object: an order with a stub. It never disappears; it changes state. */
export interface CouponProps {
  label: string;
  number?: string;
  title: string;
  fields?: { label: string; value: string }[];
  note?: string;
  stubLabel?: string;
  total: string;
  currency?: string;
  state?: CouponState;
  /** Plays the tear once. Set when a fill lands. */
  torn?: boolean;
  hash?: string;
  hashHref?: string;
  reason?: string;
  className?: string;
  children?: ReactNode;
}

/** One asset in a list: name, one meta fact, price, optional stamp. */
export interface AssetRowProps {
  name: string;
  meta?: string;
  price: string;
  currency?: string;
  status?: StampStatus;
  href?: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLElement>;
}

/** Labelled input with help or error text. */
export interface TextFieldProps {
  label: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  help?: string;
  error?: string;
  disabled?: boolean;
  inputMode?: "decimal" | "numeric" | "text";
  className?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
}

/** The allowed price range, drawn to scale. */
export interface PriceBandProps { min: number; max: number; value: number; format?: (n: number) => string; className?: string; }

/** Navigation with a dot per place: filled for the current one. Pass className="hf-tabs--rail" for the vertical rail. */
export interface TabsProps { items: { label: string; href?: string; current?: boolean }[]; ariaLabel?: string; className?: string; }

/** The bottom sheet: the one surface with a shadow. */
export interface SheetProps { title: string; caveat?: string; className?: string; children?: ReactNode; }

/** One line of the compliance feed: every order, cancel and fill. */
export interface FeedRowProps { time: string; event: string; status: StampStatus; asset: string; /** The seller. */ from: string; /** The buyer, on a fill. */ to?: string; price: string; currency?: string; className?: string; }

/** Handoff's one appearance inside a host wallet. */
export interface OperatedByProps { className?: string; }

/** The three-colour chord across the top of a page. Decoration: aria-hidden, drifts in once on load. Place it in a positioned parent. */
export interface RibbonsProps { className?: string; }

/** What happened and what to do next. */
export interface NoticeProps { status?: StampStatus; word?: string; className?: string; children: ReactNode; }

export declare const Button: (props: ButtonProps) => JSX.Element;
export declare const Stamp: (props: StampProps) => JSX.Element;
export declare const Amount: (props: AmountProps) => JSX.Element;
export declare const Hash: (props: HashProps) => JSX.Element;
export declare const Fields: (props: FieldsProps) => JSX.Element;
export declare const Coupon: (props: CouponProps) => JSX.Element;
export declare const AssetRow: (props: AssetRowProps) => JSX.Element;
export declare const TextField: (props: TextFieldProps) => JSX.Element;
export declare const PriceBand: (props: PriceBandProps) => JSX.Element;
export declare const Tabs: (props: TabsProps) => JSX.Element;
export declare const Notice: (props: NoticeProps) => JSX.Element;
export declare const Sheet: (props: SheetProps) => JSX.Element;
export declare const FeedRow: (props: FeedRowProps) => JSX.Element;
export declare const OperatedBy: (props: OperatedByProps) => JSX.Element;
export declare const Ribbons: (props: RibbonsProps) => JSX.Element;
