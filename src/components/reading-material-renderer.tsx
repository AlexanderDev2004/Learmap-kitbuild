import { cn } from "@/lib/utils";

// Parenthesized glosses ("OOP (Object Oriented Programming)") are dimmed so the
// main sentence stays readable.
function dimParentheses(text: string): string {
	return text.replaceAll(/(（[^）]*）)/g, (match) => `<span style="opacity:0.5">${match}</span>`);
}

interface ReadingMaterialRendererProps {
	content: string;
	className?: string;
}

export function ReadingMaterialRenderer({ content, className }: ReadingMaterialRendererProps) {
	return (
		<div
			className={cn("text-xl leading-loose text-foreground/90", className)}
			dangerouslySetInnerHTML={{ __html: dimParentheses(content) }}
		/>
	);
}
