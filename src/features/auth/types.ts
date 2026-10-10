import type { Role } from "@/shared/types";

export interface SessionUserLike {
	id: string;
	username: string;
	name: string;
	role: Role;
}
