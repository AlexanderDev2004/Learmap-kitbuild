import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "@/lib/api";
import { useMe } from "@/main";
import { Badge, Button, Card, CardBody, Field, Input } from "@/components/ui";

export interface ManagedUser {
	id: string;
	username: string;
	name: string;
	role: "peneliti" | "siswa";
	className: string | null;
	major: string | null;
	status: "pending" | "active" | "rejected";
	createdAt: string;
}

interface UsersResponse {
	users: ManagedUser[];
	classes: string[];
}

interface UserFormState {
	name: string;
	username: string;
	password: string;
	role: "peneliti" | "siswa";
	className: string;
	major: string;
}

const emptyForm: UserFormState = { name: "", username: "", password: "", role: "siswa", className: "", major: "" };

function StatusBadge({ status }: { status: ManagedUser["status"] }) {
	if (status === "pending") return <Badge tone="amber">Menunggu ACC</Badge>;
	if (status === "active") return <Badge tone="green">Aktif</Badge>;
	return <Badge tone="slate">Ditolak</Badge>;
}

export function UsersPage() {
	const queryClient = useQueryClient();
	const { data: me } = useMe();
	const [roleFilter, setRoleFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [classFilter, setClassFilter] = useState("");
	const [search, setSearch] = useState("");
	const [creating, setCreating] = useState(false);
	const [form, setForm] = useState<UserFormState>(emptyForm);
	const [editing, setEditing] = useState<ManagedUser | null>(null);
	const [editForm, setEditForm] = useState<UserFormState>(emptyForm);
	const [error, setError] = useState<string | null>(null);

	const usersQuery = useQuery({
		queryKey: ["users", roleFilter, statusFilter, classFilter, search],
		queryFn: () => {
			const params = new URLSearchParams();
			if (roleFilter) params.set("role", roleFilter);
			if (statusFilter) params.set("status", statusFilter);
			if (classFilter) params.set("class", classFilter);
			if (search) params.set("q", search);
			return api.get<UsersResponse>(`/users?${params.toString()}`);
		},
	});

	function invalidate() {
		void queryClient.invalidateQueries({ queryKey: ["users"] });
	}

	const createMutation = useMutation({
		mutationFn: () =>
			api.post("/users", {
				name: form.name,
				username: form.username,
				password: form.password,
				role: form.role,
				className: form.role === "siswa" ? form.className || undefined : undefined,
				major: form.role === "siswa" ? form.major || undefined : undefined,
			}),
		onSuccess: () => {
			setForm(emptyForm);
			setCreating(false);
			setError(null);
			invalidate();
		},
		onError: (mutationError) => setError(mutationError.message),
	});

	const updateMutation = useMutation({
		mutationFn: (input: { id: string; body: Record<string, unknown> }) => api.put(`/users/${input.id}`, input.body),
		onSuccess: () => {
			setEditing(null);
			setError(null);
			invalidate();
		},
		onError: (mutationError) => setError(mutationError.message),
	});

	const actionMutation = useMutation({
		mutationFn: (input: { id: string; action: "approve" | "reject" | "delete" }) =>
			input.action === "delete" ? api.del(`/users/${input.id}`) : api.post(`/users/${input.id}/${input.action}`),
		onSuccess: invalidate,
		onError: (mutationError) => setError(mutationError.message),
	});

	function openEdit(user: ManagedUser) {
		setEditing(user);
		setEditForm({
			name: user.name,
			username: user.username,
			password: "",
			role: user.role,
			className: user.className ?? "",
			major: user.major ?? "",
		});
		setError(null);
	}

	const users = usersQuery.data?.users ?? [];
	const classes = usersQuery.data?.classes ?? [];
	const pendingCount = users.filter((user) => user.status === "pending").length;

	return (
		<div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-2xl font-bold">Manajemen Pengguna</h1>
					<p className="text-sm text-slate-500">
						Kelola akun peneliti dan siswa, ACC pendaftaran baru, dan lihat data kelas/jurusan.
					</p>
				</div>
				<Button onClick={() => setCreating((current) => !current)}>
					{creating ? "Tutup Formulir" : "+ Tambah Pengguna"}
				</Button>
			</div>

			{error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

			{creating ? (
				<Card>
					<CardBody className="p-5">
						<h2 className="mb-3 font-semibold">Tambah Pengguna Baru</h2>
						<form
							className="grid gap-3 sm:grid-cols-2"
							onSubmit={(event) => {
								event.preventDefault();
								createMutation.mutate();
							}}
						>
							<Field label="Nama">
								<Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
							</Field>
							<Field label="Username">
								<Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
							</Field>
							<Field label="Password" hint="Minimal 6 karakter.">
								<Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
							</Field>
							<Field label="Peran">
								<select
									className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm"
									value={form.role}
									onChange={(e) => setForm({ ...form, role: e.target.value as UserFormState["role"] })}
								>
									<option value="siswa">Siswa/Mahasiswa</option>
									<option value="peneliti">Peneliti/Dosen/Admin</option>
								</select>
							</Field>
							{form.role === "siswa" ? (
								<>
									<Field label="Kelas">
										<Input value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} placeholder="XI-A" />
									</Field>
									<Field label="Jurusan">
										<Input value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} placeholder="IPA" />
									</Field>
								</>
							) : null}
							<div className="sm:col-span-2">
								<Button type="submit" disabled={createMutation.isPending}>
									{createMutation.isPending ? "Menyimpan..." : "Simpan Pengguna"}
								</Button>
							</div>
						</form>
					</CardBody>
				</Card>
			) : null}

			{pendingCount > 0 ? (
				<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
					Ada {pendingCount} pendaftaran yang menunggu ACC. Gunakan tombol ACC pada baris bersangkutan.
				</div>
			) : null}

			<div className="flex flex-wrap items-end gap-3">
				<Field label="Cari nama/username">
					<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari..." className="w-48" />
				</Field>
				<Field label="Peran">
					<select className="h-9 rounded-lg border border-slate-300 px-2 text-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
						<option value="">Semua</option>
						<option value="siswa">Siswa</option>
						<option value="peneliti">Peneliti</option>
					</select>
				</Field>
				<Field label="Status">
					<select className="h-9 rounded-lg border border-slate-300 px-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
						<option value="">Semua</option>
						<option value="pending">Menunggu ACC</option>
						<option value="active">Aktif</option>
						<option value="rejected">Ditolak</option>
					</select>
				</Field>
				<Field label="Kelas">
					<select className="h-9 rounded-lg border border-slate-300 px-2 text-sm" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
						<option value="">Semua</option>
						{classes.map((className) => (
							<option key={className} value={className}>
								{className}
							</option>
						))}
					</select>
				</Field>
			</div>

			{usersQuery.isPending ? (
				<p className="text-sm text-slate-500">Memuat pengguna...</p>
			) : (
				<Card>
					<CardBody className="p-0">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-slate-200 text-left text-slate-500">
									<th className="px-4 py-2.5 font-medium">Nama</th>
									<th className="px-4 py-2.5 font-medium">Username</th>
									<th className="px-4 py-2.5 font-medium">Peran</th>
									<th className="px-4 py-2.5 font-medium">Kelas</th>
									<th className="px-4 py-2.5 font-medium">Jurusan</th>
									<th className="px-4 py-2.5 font-medium">Status</th>
									<th className="px-4 py-2.5 font-medium">Aksi</th>
								</tr>
							</thead>
							<tbody>
								{users.map((user) => (
									<tr key={user.id} className="border-b border-slate-100 last:border-0">
										<td className="px-4 py-2.5 font-medium">{user.name}</td>
										<td className="px-4 py-2.5">{user.username}</td>
										<td className="px-4 py-2.5">
											<Badge tone={user.role === "peneliti" ? "blue" : "green"}>
												{user.role === "peneliti" ? "Peneliti" : "Siswa"}
											</Badge>
										</td>
										<td className="px-4 py-2.5">{user.className ?? "—"}</td>
										<td className="px-4 py-2.5">{user.major ?? "—"}</td>
										<td className="px-4 py-2.5">
											<StatusBadge status={user.status} />
										</td>
										<td className="px-4 py-2.5">
											<div className="flex flex-wrap gap-1.5">
												{user.status === "pending" ? (
													<>
														<Button
															variant="outline"
															className="px-2.5 py-1 text-xs"
															onClick={() => actionMutation.mutate({ id: user.id, action: "approve" })}
														>
															ACC
														</Button>
														<Button
															variant="outline"
															className="px-2.5 py-1 text-xs"
															onClick={() => actionMutation.mutate({ id: user.id, action: "reject" })}
														>
															Tolak
														</Button>
													</>
												) : null}
												<Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => openEdit(user)}>
													Edit
												</Button>
												{user.username !== "peneliti" && user.id !== me?.id ? (
													<Button
														variant="danger"
														className="px-2.5 py-1 text-xs"
														onClick={() => {
															if (window.confirm(`Hapus akun ${user.name}? Semua datanya akan ikut terhapus.`)) {
																actionMutation.mutate({ id: user.id, action: "delete" });
															}
														}}
													>
														Hapus
													</Button>
												) : null}
											</div>
										</td>
									</tr>
								))}
								{users.length === 0 ? (
									<tr>
										<td colSpan={7} className="px-4 py-8 text-center text-slate-500">
											Tidak ada pengguna yang cocok dengan filter.
										</td>
									</tr>
								) : null}
							</tbody>
						</table>
					</CardBody>
				</Card>
			)}

			{editing ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setEditing(null)}>
					<Card className="w-full max-w-lg" >
						<div onClick={(event) => event.stopPropagation()}>
							<CardBody className="space-y-3 p-5">
								<h2 className="font-semibold">Edit Pengguna: {editing.name}</h2>
								<form
									className="grid gap-3 sm:grid-cols-2"
									onSubmit={(event) => {
										event.preventDefault();
										updateMutation.mutate({
											id: editing.id,
											body: {
												name: editForm.name,
												username: editForm.username,
												role: editForm.role,
												className: editForm.role === "siswa" ? editForm.className || null : null,
												major: editForm.role === "siswa" ? editForm.major || null : null,
												...(editForm.password ? { password: editForm.password } : {}),
											},
										});
									}}
								>
									<Field label="Nama">
										<Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
									</Field>
									<Field label="Username">
										<Input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
									</Field>
									<Field label="Password baru" hint="Kosongkan jika tidak diubah.">
										<Input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
									</Field>
									<Field label="Peran">
										<select
											className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm"
											value={editForm.role}
											onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserFormState["role"] })}
										>
											<option value="siswa">Siswa/Mahasiswa</option>
											<option value="peneliti">Peneliti/Dosen/Admin</option>
										</select>
									</Field>
									{editForm.role === "siswa" ? (
										<>
											<Field label="Kelas">
												<Input value={editForm.className} onChange={(e) => setEditForm({ ...editForm, className: e.target.value })} />
											</Field>
											<Field label="Jurusan">
												<Input value={editForm.major} onChange={(e) => setEditForm({ ...editForm, major: e.target.value })} />
											</Field>
										</>
									) : null}
									{editing.status === "rejected" ? (
										<div className="sm:col-span-2">
											<Button
												type="button"
												variant="outline"
												onClick={() => actionMutation.mutate({ id: editing.id, action: "approve" })}
											>
												Setujui Kembali (jadikan aktif)
											</Button>
										</div>
									) : null}
									<div className="flex gap-2 sm:col-span-2">
										<Button type="submit" disabled={updateMutation.isPending}>
											{updateMutation.isPending ? "Menyimpan..." : "Simpan"}
										</Button>
										<Button type="button" variant="outline" onClick={() => setEditing(null)}>
											Batal
										</Button>
									</div>
								</form>
							</CardBody>
						</div>
					</Card>
				</div>
			) : null}
		</div>
	);
}
