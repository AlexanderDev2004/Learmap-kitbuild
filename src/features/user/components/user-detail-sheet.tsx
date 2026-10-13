import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
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
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { UserWithCohorts, UpdateUserInput } from "@/features/user/lib/user-service.shared";

type UserDetailSheetProps = {
	user: UserWithCohorts | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (userId: string, data: UpdateUserInput) => void;
	onBan: (userId: string, reason: string) => void;
	onUnban: (userId: string) => void;
	onDelete: (userId: string) => void;
	onRoleChange: (userId: string, role: string) => void;
	onSetPassword: (userId: string, newPassword: string) => void;
	isAdmin: boolean;
	currentUserId: string;
	isSaving?: boolean;
	isDeleting?: boolean;
	isSettingPassword?: boolean;
};

export function UserDetailSheet({
	user,
	open,
	onOpenChange,
	onSave,
	onBan,
	onUnban,
	onDelete,
	onRoleChange,
	onSetPassword,
	isAdmin,
	currentUserId,
	isSaving,
	isDeleting,
	isSettingPassword,
}: UserDetailSheetProps) {
	const [formData, setFormData] = useState<Partial<UpdateUserInput>>({});
	const [banReason, setBanReason] = useState("");
	const [showBanInput, setShowBanInput] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [passwordOpen, setPasswordOpen] = useState(false);
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");

	useEffect(() => {
		if (user) {
			setFormData({
				name: user.name ?? undefined,
				email: user.email ?? undefined,
				studentId: user.studentId ?? "",
				age: user.age ?? undefined,
				jlptLevel: user.jlptLevel ?? undefined,
				japaneseLearningDuration: user.japaneseLearningDuration ?? undefined,
				previousJapaneseScore: user.previousJapaneseScore ?? undefined,
				mediaConsumption: user.mediaConsumption ?? undefined,
				motivation: user.motivation ?? undefined,
				studyGroup: user.studyGroup ?? "experiment",
			});
		}
		setBanReason("");
		setShowBanInput(false);
		setPasswordOpen(false);
		setNewPassword("");
		setConfirmPassword("");
	}, [user]);

	if (!user) return null;

	const canModifyRole = isAdmin && user.id !== currentUserId;
	const canBan = isAdmin && user.id !== currentUserId;

	const handleSave = () => {
		const changes: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(formData)) {
			if (value === undefined || value === "") continue;
			changes[key] = value;
		}
		onSave(user.id, changes as UpdateUserInput);
	};

	const handleBan = () => {
		if (banReason.trim()) {
			onBan(user.id, banReason.trim());
			setShowBanInput(false);
			setBanReason("");
		}
	};

	const passwordValid = newPassword.length >= 8 && newPassword === confirmPassword;

	const handleSetPassword = () => {
		if (!passwordValid) return;
		onSetPassword(user.id, newPassword);
		setPasswordOpen(false);
		setNewPassword("");
		setConfirmPassword("");
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="sm:max-w-lg overflow-y-auto">
				<SheetHeader>
					<SheetTitle>User Details</SheetTitle>
					<SheetDescription>View and edit user information</SheetDescription>
				</SheetHeader>

				<div className="space-y-6 p-6">
					{/* Basic Info */}
					<div className="space-y-4">
						<h3 className="text-sm font-medium text-muted-foreground">
							Basic Information
						</h3>
						<div className="grid gap-4">
							<div className="grid gap-2">
								<Label htmlFor="name">Name</Label>
								<Input
									id="name"
									value={formData.name ?? ""}
									onChange={(e) =>
										setFormData((prev) => ({ ...prev, name: e.target.value }))
									}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="studentId">Student ID</Label>
								<Input
									id="studentId"
									value={formData.studentId ?? ""}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											studentId: e.target.value,
										}))
									}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="email">Email</Label>
								<Input
									id="email"
									type="email"
									value={formData.email ?? ""}
									onChange={(e) =>
										setFormData((prev) => ({ ...prev, email: e.target.value }))
									}
								/>
							</div>
							{canModifyRole && (
								<div className="grid gap-2">
									<Label htmlFor="role">Role</Label>
									<Select
										value={user.role ?? "student"}
										onValueChange={(role) => onRoleChange(user.id, role)}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="student">Student</SelectItem>
											<SelectItem value="teacher">Teacher</SelectItem>
											<SelectItem value="admin">Admin</SelectItem>
										</SelectContent>
									</Select>
								</div>
							)}
						</div>
					</div>

					{/* Profile Fields */}
					<div className="space-y-4">
						<h3 className="text-sm font-medium text-muted-foreground">Profile</h3>
						<div className="grid gap-4">
							<div className="grid gap-2">
								<Label htmlFor="age">Age</Label>
								<Input
									id="age"
									type="number"
									value={formData.age ?? ""}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											age: e.target.value
												? Number(e.target.value)
												: undefined,
										}))
									}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="jlptLevel">JLPT Level</Label>
								<Select
									value={formData.jlptLevel ?? ""}
									onValueChange={(level) =>
										setFormData((prev) => ({
											...prev,
											jlptLevel: level as UpdateUserInput["jlptLevel"],
										}))
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select level" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="None">None</SelectItem>
										<SelectItem value="N5">N5</SelectItem>
										<SelectItem value="N4">N4</SelectItem>
										<SelectItem value="N3">N3</SelectItem>
										<SelectItem value="N2">N2</SelectItem>
										<SelectItem value="N1">N1</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="studyGroup">Study Group</Label>
								<Select
									value={formData.studyGroup ?? "experiment"}
									onValueChange={(group) =>
										setFormData((prev) => ({
											...prev,
											studyGroup: group as UpdateUserInput["studyGroup"],
										}))
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select group" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="experiment">Experiment</SelectItem>
										<SelectItem value="control">Control</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="motivation">Motivation</Label>
								<Textarea
									id="motivation"
									value={formData.motivation ?? ""}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											motivation: e.target.value,
										}))
									}
								/>
							</div>
						</div>
					</div>

					{/* Cohorts */}
					<div className="space-y-2">
						<h3 className="text-sm font-medium text-muted-foreground">Cohorts</h3>
						<div className="flex flex-wrap gap-2">
							{user.cohorts.length > 0 ? (
								user.cohorts.map((c) => (
									<Badge key={c.id} variant="secondary">
										{c.name}
									</Badge>
								))
							) : (
								<span className="text-sm text-muted-foreground">
									No cohorts assigned
								</span>
							)}
						</div>
					</div>

					{/* Account Actions */}
					<div className="space-y-4 border-t pt-4">
						<h3 className="text-sm font-medium text-muted-foreground">
							Account Actions
						</h3>
						<Button
							variant="outline"
							onClick={() => setPasswordOpen(true)}
							disabled={isSettingPassword}
						>
							Set Password
						</Button>
					</div>

					{/* Admin Actions */}
					{canBan && (
						<div className="space-y-4 border-t pt-4">
							<h3 className="text-sm font-medium text-muted-foreground">
								Admin Actions
							</h3>
							{user.banned ? (
								<Button variant="outline" onClick={() => onUnban(user.id)}>
									Unban User
								</Button>
							) : showBanInput ? (
								<div className="space-y-2">
									<Textarea
										placeholder="Enter ban reason..."
										value={banReason}
										onChange={(e) => setBanReason(e.target.value)}
									/>
									<div className="flex gap-2">
										<Button variant="destructive" onClick={handleBan}>
											Confirm Ban
										</Button>
										<Button
											variant="outline"
											onClick={() => setShowBanInput(false)}
										>
											Cancel
										</Button>
									</div>
								</div>
							) : (
								<div className="flex gap-2">
									<Button
										variant="destructive"
										onClick={() => setShowBanInput(true)}
									>
										Ban User
									</Button>
								</div>
							)}
							<Button
								variant="outline"
								className="text-destructive border-destructive hover:bg-destructive/10"
								onClick={() => setDeleteOpen(true)}
								disabled={isDeleting}
							>
								Delete User
							</Button>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex justify-end gap-2 border-t px-6 pb-6 pt-4">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={isSaving}>
						{isSaving ? "Saving..." : "Save Changes"}
					</Button>
				</div>
			</SheetContent>

			<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete User</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this user? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() => {
								onDelete(user.id);
								setDeleteOpen(false);
							}}
							disabled={isDeleting}
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Set New Password</DialogTitle>
						<DialogDescription>
							Replace this user's password with a new one. Minimum 8 characters.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="newPassword">New Password</Label>
							<Input
								id="newPassword"
								type="password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								placeholder="At least 8 characters"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="confirmNewPassword">Confirm Password</Label>
							<Input
								id="confirmNewPassword"
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								placeholder="Repeat the new password"
							/>
						</div>
						{newPassword.length > 0 && newPassword.length < 8 && (
							<p className="text-sm text-destructive">
								Password must be at least 8 characters
							</p>
						)}
						{confirmPassword.length > 0 && newPassword !== confirmPassword && (
							<p className="text-sm text-destructive">Passwords do not match</p>
						)}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setPasswordOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleSetPassword}
							disabled={!passwordValid || isSettingPassword}
						>
							{isSettingPassword ? "Saving..." : "Save Password"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Sheet>
	);
}
