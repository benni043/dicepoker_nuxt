declare module "#auth-utils" {
	interface User {
		id: string;
		name: string;
		avatarUrl: string | null;
	}
}

export {};
