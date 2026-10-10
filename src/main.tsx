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

import type { SessionUserLike } from "@/features/auth/types";
import { LoginPage } from "@/features/auth/login-page";
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
			<AppShell>
				<Outlet />
			</AppShell>
		</Protected>
	);
}

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const loginRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/login",
	component: LoginPage,
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
	layoutRoute.addChildren([
		homeRoute,
		materiRoute,
		goalMapsRoute,
		goalMapEditorRoute,
		experimentsRoute,
		experimentDetailRoute,
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
