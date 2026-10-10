import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "@/lib/api";
import { Button, Card, CardBody, Field, Input } from "@/components/ui";
import type { SessionUserLike } from "./types";

export function LoginPage() {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);

	const login = useMutation({
		mutationFn: () => api.post<SessionUserLike>("/auth/login", { username, password }),
		onSuccess: (user) => {
			const next = new URLSearchParams(window.location.search).get("next");
			const fallback = user.role === "peneliti" ? "/eksperimen" : "/sesi";
			window.location.assign(next && next.startsWith("/") && next !== "/login" ? next : fallback);
		},
		onError: (mutationError) => setError(mutationError.message),
	});

	return (
		<div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
			<Card className="w-full max-w-sm">
				<CardBody className="space-y-4 p-6">
					<div className="space-y-1 text-center">
						<h1 className="text-xl font-bold">LearnMap</h1>
						<p className="text-sm text-slate-500">
							Kit-Build Concept Map — Eksperimen Model Segmentasi
						</p>
					</div>
					<form
						className="space-y-3"
						onSubmit={(event) => {
							event.preventDefault();
							setError(null);
							login.mutate();
						}}
					>
						<Field label="Username">
							<Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
						</Field>
						<Field label="Password">
							<Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
						</Field>
						{error ? <p className="text-sm text-red-600">{error}</p> : null}
						<Button type="submit" className="w-full" disabled={login.isPending}>
							{login.isPending ? "Memproses..." : "Masuk"}
						</Button>
					</form>
					<p className="text-center text-sm text-slate-500">
						Belum punya akun?{" "}
						<a href="/register" className="font-medium text-blue-600 hover:underline">
							Daftar siswa baru
						</a>
					</p>
				</CardBody>
			</Card>
		</div>
	);
}
