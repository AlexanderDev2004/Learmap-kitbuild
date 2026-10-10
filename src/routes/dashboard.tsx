import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getMe, ProfileRpc } from "@/server/rpc/profile";

export const Route = createFileRoute("/dashboard")({
	head: () => ({
		meta: [{ title: "Dashboard - LearnMap" }],
	}),
	beforeLoad: async () => {
		const me = await getMe();
		if (!me.success) throw redirect({ to: "/login" });

		return { me };
	},
	loader: async ({ context }) => {
		context.queryClient.setQueryData(ProfileRpc.me(), context.me);
	},
	component: DashboardLayout,
});

function DashboardLayout() {
	const { me } = Route.useRouteContext();

	// Cookie sesi dibagikan semua tab browser. sessionStorage bersifat per-tab:
	// jika sesi aktif berbeda dari akun yang tercatat di tab ini (mis. login
	// akun lain di tab lain), sinkronkan tab agar tidak menampilkan halaman
	// milik peran yang salah.
	useEffect(() => {
		const userId = me.success ? me.data.id : null;
		const tabUserId = sessionStorage.getItem("learnmap_tab_user");
		if (userId == null) {
			sessionStorage.removeItem("learnmap_tab_user");
			return;
		}
		if (tabUserId === userId) return;
		sessionStorage.setItem("learnmap_tab_user", userId);
		if (tabUserId != null) {
			window.location.replace("/");
		}
	}, [me]);

	return (
		<SidebarProvider>
			<AppSidebar className="border-none" />
			<SidebarInset className="p-0 md:p-2 md:pl-0 bg-sidebar">
				<main className="bg-card h-dvh md:h-full md:max-h-[calc(100svh-16px)] md:rounded-xl flex flex-col overflow-hidden md:shadow-sm md:border md:border-border/50">
					<header className="flex h-14 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b-[0.5px]">
						<div className="flex items-center gap-2 px-4">
							<SidebarTrigger className="-ml-1 interactive-sm" />
							<Separator
								orientation="vertical"
								className="data-[orientation=vertical]:h-4"
							/>
						</div>
					</header>
					<div className="flex-1 min-h-0 px-4 overflow-y-auto overflow-x-hidden">
						<Outlet />
					</div>
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
