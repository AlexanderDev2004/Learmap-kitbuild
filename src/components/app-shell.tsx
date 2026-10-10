import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { FlaskConical, LogOut, Map, ScrollText } from "lucide-react";
import type { ReactNode } from "react";
import type { Role } from "@/shared/types";

import { useMe } from "@/main";
import { api } from "@/lib/api";
import { Badge, Button } from "@/components/ui";

const navItems: { to: string; label: string; icon: typeof Map; roles: Role[] }[] = [
	{ to: "/materi", label: "Materi", icon: ScrollText, roles: ["peneliti"] },
	{ to: "/goal-map", label: "Goal Map", icon: Map, roles: ["peneliti"] },
	{ to: "/eksperimen", label: "Eksperimen", icon: FlaskConical, roles: ["peneliti"] },
	{ to: "/sesi", label: "Sesi Saya", icon: FlaskConical, roles: ["siswa"] },
];

export function AppShell({ children }: { children: ReactNode }) {
	const { data: me } = useMe();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const logout = useMutation({
		mutationFn: () => api.post("/auth/logout"),
		onSuccess: () => {
			queryClient.clear();
			void navigate({ to: "/login", replace: true });
		},
	});

	return (
		<div className="min-h-screen">
			<header className="border-b border-slate-200 bg-white">
				<div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
					<Link to="/" className="text-lg font-bold">
						Learn<span className="text-blue-600">Map</span>
					</Link>
					<nav className="flex items-center gap-1">
						{navItems
							.filter((item) => me && item.roles.includes(me.role))
							.map((item) => (
								<Link
									key={item.to}
									to={item.to}
									className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
									activeProps={{ className: "bg-blue-50 text-blue-700" }}
								>
									<item.icon className="size-4" />
									{item.label}
								</Link>
							))}
					</nav>
					<div className="ml-auto flex items-center gap-3">
						{me ? (
							<>
								<span className="flex items-center gap-2 text-sm">
									{me.name}
									<Badge tone={me.role === "peneliti" ? "blue" : "green"}>
										{me.role === "peneliti" ? "Peneliti" : "Siswa"}
									</Badge>
								</span>
								<Button variant="outline" onClick={() => logout.mutate()}>
									<LogOut className="size-4" />
									Keluar
								</Button>
							</>
						) : null}
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
		</div>
	);
}
