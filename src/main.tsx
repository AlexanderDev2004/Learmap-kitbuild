import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
	createRoute,
	createRouter,
	Navigate,
	Outlet,
	RouterProvider,
	createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect } from "react";

import type { SessionUserLike } from "@/features/auth/types";
import { LoginPage } from "@/features/auth/login-page";
import { RegisterPage } from "@/features/auth/register-page";
import { UsersPage } from "@/features/user/users-page";
import { AppShell } from "@/components/app-shell";
import { MaterialsPage } from "@/features/material/materials-page";
import { GoalMapsPage } from "@/features/goal-map/goal-maps-page";
import { GoalMapEditorPage } from "@/features/goal-map/goal-map-editor";
import { ExperimentsPage } from "@/features/experiment/experiments-page";
import { ExperimentDetailPage } from "@/features/experiment/experiment-detail-page";
import { SessionsPage } from "@/features/session/sessions-page";
import { SessionWizardPage } from "@/features/session/session-wizard";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false, staleTime: 5_000 },
	},
});

export function useMe() {
	return useQuery({
		queryKey: ["me"],
		queryFn: () => api.get<SessionUserLike | null>("/auth/me").catch(() => null),
	});
}

function Protected({ role, children }: { role?: "peneliti" | "siswa"; children: ReactNode }) {
	const { data: me, isPending } = useMe();
	if (isPending) return <Spinner />;
	if (!me) {
		window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
		return <Spinner />;
	}
	if (role && me.role !== role) return <Navigate to="/" replace />;
	return children;
}

function Layout() {
	return (
		<Protected>
			<SessionGuard>
				<AppShell>
					<Outlet />
				</AppShell>
			</SessionGuard>
		</Protected>
	);
}

/**
 * Sesi browser dibagikan semua tab (satu cookie), jadi login akun lain di tab
 * lain membuat tab ini basi. sessionStorage bersifat per-tab: jika user yang
 * tercatat di tab ini berbeda dari sesi aktif, sinkronkan tab ke sesi terbaru
 * agar tidak menampilkan halaman peran yang salah.
 */
function SessionGuard({ children }: { children: ReactNode }) {
	const { data: me, isPending } = useMe();

	useEffect(() => {
		if (isPending) return;
		if (!me) {
			sessionStorage.removeItem("learnmap_tab_user");
			return;
		}
		const tabUserId = sessionStorage.getItem("learnmap_tab_user");
		if (tabUserId === me.id) return;
		sessionStorage.setItem("learnmap_tab_user", me.id);
		if (tabUserId != null) {
			// Tab ini tercatat untuk akun lain: muat ulang agar router memilih
			// halaman sesuai peran sesi aktif.
			window.location.replace("/");
		}
	}, [isPending, me]);

	return children;
}

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const loginRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/login",
	component: LoginPage,
});

const registerRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/register",
	component: RegisterPage,
});

const layoutRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: "layout",
	component: Layout,
});

const homeRoute = createRoute({
	getParentRoute: () => layoutRoute,
	path: "/",
	component: HomeRedirect,
});

const materiRoute = createRoute({
	getParentRoute: () => layoutRoute,
	path: "/materi",
	component: () => (
		<Protected role="peneliti">
			<MaterialsPage />
		</Protected>
	),
});

const goalMapsRoute = createRoute({
	getParentRoute: () => layoutRoute,
	path: "/goal-map",
	component: () => (
		<Protected role="peneliti">
			<GoalMapsPage />
		</Protected>
	),
});

const goalMapEditorRoute = createRoute({
	getParentRoute: () => layoutRoute,
	path: "/goal-map/$id",
	component: () => (
		<Protected role="peneliti">
			<GoalMapEditorPage />
		</Protected>
	),
});

const experimentsRoute = createRoute({
	getParentRoute: () => layoutRoute,
	path: "/eksperimen",
	component: () => (
		<Protected role="peneliti">
			<ExperimentsPage />
		</Protected>
	),
});

const experimentDetailRoute = createRoute({
	getParentRoute: () => layoutRoute,
	path: "/eksperimen/$id",
	component: () => (
		<Protected role="peneliti">
			<ExperimentDetailPage />
		</Protected>
	),
});

const usersRoute = createRoute({
	getParentRoute: () => layoutRoute,
	path: "/pengguna",
	component: () => (
		<Protected role="peneliti">
			<UsersPage />
		</Protected>
	),
});

const sessionsRoute = createRoute({
	getParentRoute: () => layoutRoute,
	path: "/sesi",
	component: () => (
		<Protected role="siswa">
			<SessionsPage />
		</Protected>
	),
});

const sessionWizardRoute = createRoute({
	getParentRoute: () => layoutRoute,
	path: "/sesi/$id",
	component: () => (
		<Protected role="siswa">
			<SessionWizardPage />
		</Protected>
	),
});

const routeTree = rootRoute.addChildren([
	loginRoute,
	registerRoute,
	layoutRoute.addChildren([
		homeRoute,
		materiRoute,
		goalMapsRoute,
		goalMapEditorRoute,
		experimentsRoute,
		experimentDetailRoute,
		usersRoute,
		sessionsRoute,
		sessionWizardRoute,
	]),
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

function HomeRedirect() {
	const { data: me } = useMe();
	if (me?.role === "peneliti") return <Navigate to="/eksperimen" replace />;
	if (me?.role === "siswa") return <Navigate to="/sesi" replace />;
	return <Spinner />;
}

export function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	);
}
