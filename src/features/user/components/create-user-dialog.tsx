import { useForm } from "@tanstack/react-form";
import { Schema } from "effect";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useRpcMutation } from "@/hooks/use-rpc-query";
import { NonEmpty } from "@/lib/validation-schemas";
import { UserRpc } from "@/server/rpc/user";

const CreateUserFormSchema = Schema.Struct({
	email: Schema.String.pipe(
		Schema.filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), {
			message: () => "Please enter a valid email address",
		}),
	),
	password: Schema.String.pipe(
		Schema.filter((password) => password.length >= 8, {
			message: () => "Password must be at least 8 characters",
		}),
	),
	name: NonEmpty("Name"),
	role: Schema.Literal("student", "teacher", "admin"),
	studentId: Schema.String,
});

interface CreateUserDialogProps {
	/** Whether the signed-in user is an admin (admins may pick any role). */
	isAdmin: boolean;
}

export function CreateUserDialog({ isAdmin }: CreateUserDialogProps) {
	const [isOpen, setIsOpen] = useState(false);
	const { mutate: createUser, isPending } = useRpcMutation(UserRpc.createUser(), {
		operation: "create user",
		showSuccess: true,
		successMessage: "User created successfully",
		onSuccess: () => {
			setIsOpen(false);
			form.reset();
		},
	});

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
			name: "",
			role: "student" as "student" | "teacher" | "admin",
			studentId: "",
		},
		validators: {
			onSubmit: Schema.standardSchemaV1(CreateUserFormSchema),
		},
		onSubmit: async ({ value }) => {
			createUser({
				email: value.email,
				password: value.password,
				name: value.name,
				role: value.role,
				studentId: value.studentId || undefined,
			});
		},
	});

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button size="sm">
					<Plus className="size-4" />
					Add User
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						void form.handleSubmit();
					}}
				>
					<DialogHeader>
						<DialogTitle>Add New User</DialogTitle>
						<DialogDescription>
							Create an account manually. Share the email and password with the user
							so they can sign in.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<form.Field name="name">
							{(field) => (
								<div className="grid gap-2">
									<Label htmlFor="new-user-name">Name</Label>
									<Input
										id="new-user-name"
										placeholder="Full name"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
									/>
									{field.state.meta.errors.length > 0 && (
										<p className="text-sm text-destructive">
											{field.state.meta.errors[0]?.message}
										</p>
									)}
								</div>
							)}
						</form.Field>
						<form.Field name="email">
							{(field) => (
								<div className="grid gap-2">
									<Label htmlFor="new-user-email">Email</Label>
									<Input
										id="new-user-email"
										type="email"
										placeholder="user@example.com"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
									/>
									{field.state.meta.errors.length > 0 && (
										<p className="text-sm text-destructive">
											{field.state.meta.errors[0]?.message}
										</p>
									)}
								</div>
							)}
						</form.Field>
						<form.Field name="password">
							{(field) => (
								<div className="grid gap-2">
									<Label htmlFor="new-user-password">Password</Label>
									<Input
										id="new-user-password"
										type="password"
										placeholder="At least 8 characters"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
									/>
									{field.state.meta.errors.length > 0 && (
										<p className="text-sm text-destructive">
											{field.state.meta.errors[0]?.message}
										</p>
									)}
								</div>
							)}
						</form.Field>
						<form.Field name="role">
							{(field) => (
								<div className="grid gap-2">
									<Label htmlFor="new-user-role">Role</Label>
									<Select
										value={field.state.value}
										onValueChange={(value) =>
											field.handleChange(
												value as "student" | "teacher" | "admin",
											)
										}
									>
										<SelectTrigger id="new-user-role">
											<SelectValue placeholder="Select a role" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="student">Student</SelectItem>
											{isAdmin && (
												<>
													<SelectItem value="teacher">Teacher</SelectItem>
													<SelectItem value="admin">Admin</SelectItem>
												</>
											)}
										</SelectContent>
									</Select>
								</div>
							)}
						</form.Field>
						<form.Field name="studentId">
							{(field) => (
								<div className="grid gap-2">
									<Label htmlFor="new-user-student-id">
										Student ID{" "}
										<span className="text-muted-foreground">(optional)</span>
									</Label>
									<Input
										id="new-user-student-id"
										placeholder="e.g. 2201234"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
									/>
								</div>
							)}
						</form.Field>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							disabled={isPending}
							onClick={() => setIsOpen(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? (
								<>
									<Loader2 className="mr-2 size-4 animate-spin" />
									Creating…
								</>
							) : (
								"Create User"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
