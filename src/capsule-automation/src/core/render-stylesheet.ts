function uniqueRules(rules: string[]): string[] {
	return [...new Set(rules.map((rule) => rule.trim()).filter(Boolean))];
}

/**
 * Render a single stylesheet string from a list of CSS rules.
 */
export function renderAutoCapsuleStyleSheet(rules: string[]): string {
	return uniqueRules(rules).join("\n");
}
