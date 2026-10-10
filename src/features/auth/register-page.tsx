import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "@/lib/api";
import { Button, Card, CardBody, Field, Input } from "@/components/ui";

export function RegisterPage() {
	const [form, setForm] = useState({ name: "", username: "", password: "", className: "", major: "" });
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const register = useMutation({
		mutationFn: () => api.post<{ message: string }>("/auth/register", form),
		onSuccess: (result) => {
			setSuccess(result.message);
			setError(null);
		},
		onError: (mutationError) => setError(mutationError.message),
	});

	function update(patch: Partial<typeof form>) {
		setForm((current) => ({ ...current, ...patch }));
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
			<Card className="w-full max-w-md">
				<CardBody className="space-y-4 p-6">
					<div className="space-y-1 text-center">
						<h1 className="text-xl font-bold">Daftar Akun Siswa</h1>
						<p className="text-sm text-slate-500">
							Isi formulir berikut. Akun akan aktif setelah disetujui peneliti/admin.
						</p>
					</div>

					{success ? (
						<div className="space-y-4">
							<div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{success}</div>
							<a href="/login" className="block no-underline">
								<Button className="w-full">Kembali ke Halaman Masuk</Button>
							</a>
						</div>
					) : (
						<form
							className="space-y-3"
							onSubmit={(event) => {
								event.preventDefault();
								register.mutate();
							}}
						>
							<Field label="Nama lengkap">
								<Input value={form.name} onChange={(e) => update({ name: e.target.value })} />
							</Field>
							<Field label="Username">
								<Input value={form.username} onChange={(e) => update({ username: e.target.value })} minLength={3} />
							</Field>
							<Field label="Password" hint="Minimal 6 karakter.">
								<Input type="password" value={form.password} onChange={(e) => update({ password: e.target.value })} minLength={6} />
							</Field>
							<div className="grid grid-cols-2 gap-3">
								<Field label="Kelas">
									<Input value={form.className} onChange={(e) => update({ className: e.target.value })} placeholder="XI-A" />
								</Field>
								<Field label="Jurusan">
									<Input value={form.major} onChange={(e) => update({ major: e.target.value })} placeholder="IPA" />
								</Field>
							</div>
							{error ? <p className="text-sm text-red-600">{error}</p> : null}
							<Button type="submit" className="w-full" disabled={register.isPending}>
								{register.isPending ? "Mendaftarkan..." : "Daftar"}
							</Button>
							<p className="text-center text-sm text-slate-500">
								Sudah punya akun?{" "}
								<a href="/login" className="font-medium text-blue-600 hover:underline">
									Masuk
								</a>
							</p>
						</form>
					)}
				</CardBody>
			</Card>
		</div>
	);
}
