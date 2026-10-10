/** Klien API ringan untuk LearnMap. */

export class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`/api${path}`, {
		headers: init?.body != null ? { "Content-Type": "application/json" } : undefined,
		credentials: "same-origin",
		...init,
	});
	const text = await response.text();
	const data = text ? (JSON.parse(text) as unknown) : null;
	if (!response.ok) {
		const message =
			data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : `HTTP ${response.status}`;
		throw new ApiError(response.status, message);
	}
	return data as T;
}

export const api = {
	get: <T>(path: string) => request<T>(path),
	post: <T>(path: string, body?: unknown) =>
		request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
	put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
	del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
