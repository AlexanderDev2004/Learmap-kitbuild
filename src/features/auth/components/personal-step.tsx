import type { AnyFieldApi } from "@tanstack/react-form";

import { FieldInfo } from "@/components/ui/field-info";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useSignUpForm } from "./signup-form.context";

interface PersonalStepProps {
	onLastFieldSubmit?: () => void;
}

export function PersonalStep({ onLastFieldSubmit }: PersonalStepProps) {
	const form = useSignUpForm();
	return (
		<div className="space-y-5">
			<form.Field name="age">
				{(field: AnyFieldApi) => (
					<div className="space-y-1.5">
						<Label htmlFor="age">Age</Label>
						<Input
							id="age"
							type="number"
							placeholder="e.g., 20"
							value={field.state.value ?? ""}
							onChange={(e) =>
								field.handleChange(e.target.value ? Number(e.target.value) : null)
							}
							onBlur={field.handleBlur}
							min="1"
							max="120"
						/>
						<FieldInfo field={field} />
					</div>
				)}
			</form.Field>

			<form.Field name="motivation">
				{(field: AnyFieldApi) => (
					<div className="space-y-1.5">
						<Label htmlFor="motivation">
							What motivates you to learn this subject?
						</Label>
						<Textarea
							id="motivation"
							placeholder="Share your motivation..."
							value={field.state.value ?? ""}
							onChange={(e) => field.handleChange(e.target.value || null)}
							onBlur={field.handleBlur}
							rows={3}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey && onLastFieldSubmit) {
									e.preventDefault();
									onLastFieldSubmit();
								}
							}}
						/>
						<FieldInfo field={field} />
					</div>
				)}
			</form.Field>
		</div>
	);
}
