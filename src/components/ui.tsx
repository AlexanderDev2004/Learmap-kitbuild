import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";
import type { ClassValue } from "clsx";

export function cn(...classes: ClassValue[]) {
	return clsx(...classes);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "primary" | "secondary" | "outline" | "danger";
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
				variant === "primary" && "bg-blue-600 text-white hover:bg-blue-700",
				variant === "secondary" && "bg-slate-200 text-slate-800 hover:bg-slate-300",
				variant === "outline" && "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
				variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
				className,
			)}
			{...props}
		/>
	);
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
	return <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>{children}</div>;
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
	return (
		<div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
			<div>
				<h2 className="text-base font-semibold">{title}</h2>
				{description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
			</div>
			{action}
		</div>
	);
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
	return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
	return (
		<input
			className={cn(
				"w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
				className,
			)}
			{...props}
		/>
	);
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return (
		<textarea
			className={cn(
				"w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
				className,
			)}
			{...props}
		/>
	);
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
	return (
		<label className="block space-y-1">
			<span className="text-sm font-medium text-slate-700">{label}</span>
			{children}
			{hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
		</label>
	);
}

export function Badge({ tone = "slate", children }: { tone?: "slate" | "blue" | "green" | "amber"; children: ReactNode }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
				tone === "slate" && "bg-slate-100 text-slate-700",
				tone === "blue" && "bg-blue-100 text-blue-700",
				tone === "green" && "bg-green-100 text-green-700",
				tone === "amber" && "bg-amber-100 text-amber-700",
			)}
		>
			{children}
		</span>
	);
}

export function Spinner({ label }: { label?: string }) {
	return (
		<div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
			<span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
			{label ?? "Memuat..."}
		</div>
	);
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
	return (
		<div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
			<p className="font-medium text-slate-700">{title}</p>
			{description ? <p className="max-w-md text-sm text-slate-500">{description}</p> : null}
			{action}
		</div>
	);
}
