export function queryString(value: unknown): string | undefined {
	const first = Array.isArray(value) ? value[0] : value;
	return typeof first === "string" ? first : undefined;
}
