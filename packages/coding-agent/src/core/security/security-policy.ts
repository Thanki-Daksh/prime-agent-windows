import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, normalize, relative, resolve } from "node:path";

/**
 * Security Risk Levels for shell commands
 */
export type CommandRiskLevel = "SAFE" | "CAUTIOUS" | "DESTRUCTIVE";

/**
 * Sensitive environment variables to redact from subagent/kernel subprocesses
 */
export const SENSITIVE_ENV_VARS: ReadonlySet<string> = new Set([
	"SSH_AUTH_SOCK",
	"SSH_AGENT_PID",
	"AWS_SECRET_ACCESS_KEY",
	"AWS_SESSION_TOKEN",
	"AWS_BEARER_TOKEN_BEDROCK",
	"AZURE_CLIENT_SECRET",
	"AZURE_OPENAI_API_KEY",
	"GITHUB_TOKEN",
	"GH_TOKEN",
	"COPILOT_GITHUB_TOKEN",
	"GCLOUD_KEY",
	"GOOGLE_APPLICATION_CREDENTIALS",
	"GOOGLE_CLOUD_API_KEY",
	"ANTHROPIC_API_KEY",
	"ANTHROPIC_OAUTH_TOKEN",
	"OPENAI_API_KEY",
	"PRIME_API_KEY",
	"GEMINI_API_KEY",
	"GROQ_API_KEY",
	"DEEPSEEK_API_KEY",
	"OPENROUTER_API_KEY",
	"CLOUDFLARE_API_KEY",
	"MISTRAL_API_KEY",
	"XAI_API_KEY",
	"CEREBRAS_API_KEY",
	"ZAI_API_KEY",
	"FIREWORKS_API_KEY",
	"HF_TOKEN",
	"KIMI_API_KEY",
	"MINIMAX_API_KEY",
	"MINIMAX_CN_API_KEY",
	"AI_GATEWAY_API_KEY",
	"OPENCODE_API_KEY",
]);

/**
 * Patterns matching sensitive system or credential paths
 */
export const PROTECTED_PATH_PATTERNS: readonly RegExp[] = [
	// SSH keys and configurations
	/[/\\]\.ssh([/\\]|$)/i,
	// AWS credentials
	/[/\\]\.aws([/\\]|$)/i,
	// GnuPG keys
	/[/\\]\.gnupg([/\\]|$)/i,
	// Git credentials and netrc
	/[/\\]\.git-credentials$/i,
	/[/\\]\.netrc$/i,
	// Unix system auth files (matches /etc/shadow, /etc/sudoers on POSIX or Windows)
	/(^|[/\\])etc[/\\](shadow|sudoers|master\.passwd)($|[/\\])/i,
	// Windows credential vaults
	/[/\\]Microsoft[/\\]Vault([/\\]|$)/i,
	/[/\\]Microsoft[/\\]Credentials([/\\]|$)/i,
];

/**
 * Destructive command rules and descriptions
 */
export const DESTRUCTIVE_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
	// Root or home directory wipe
	{
		pattern: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\s+([/~*]|\$HOME\b|%USERPROFILE%|[a-zA-Z]:[/\\])/i,
		reason: "Recursive forced deletion of root, home, or drive root",
	},
	{
		pattern: /\brm\s+-[a-zA-Z]*\s+--no-preserve-root/i,
		reason: "Deletion with --no-preserve-root flag",
	},
	{
		pattern: /\b(del|erase)\s+.*\/[fF]\s+.*\/[sS]\s+.*\/[qQ]\s+([a-zA-Z]:[/\\]|\*|[/\\])/i,
		reason: "Forced silent deletion of drive or root directory",
	},
	{
		pattern: /\brmdir\s+\/[sS]\s+\/[qQ]\s+([a-zA-Z]:[/\\]|\*|[/\\])/i,
		reason: "Forced recursive removal of drive or root directory",
	},
	{
		pattern: /\bRemove-Item\b.*(-Recurse|-r\b).*(-Force|-f\b).*([a-zA-Z]:[/\\]|[/\\]|\$HOME\b|\*)/i,
		reason: "PowerShell forced recursive deletion of root or home directory",
	},
	{
		pattern: /\bRemove-Item\b.*([a-zA-Z]:[/\\]|[/\\]|\$HOME\b|\*).*(-Recurse|-r\b).*(-Force|-f\b)/i,
		reason: "PowerShell forced recursive deletion of root or home directory",
	},
	// Destructive git operations
	{
		pattern: /\bgit\s+push\s+.*(--force|-f\b)/,
		reason: "Forced Git push can overwrite remote repository history",
	},
	{
		pattern: /\bgit\s+reset\s+--hard\b/,
		reason: "Hard Git reset discards all uncommitted and committed changes",
	},
	{
		pattern: /\bgit\s+clean\s+.*-[a-zA-Z]*f[a-zA-Z]*d/,
		reason: "Forced Git clean deletes untracked files and directories",
	},
	{
		pattern: /\bgit\s+branch\s+-[dD]\s+(main|master|production|release)\b/,
		reason: "Deletion of primary production branch",
	},
	// Disk / Partition operations
	{
		pattern: /\b(mkfs|mkfs\.[a-z0-9]+)\b/i,
		reason: "Filesystem creation / formatting command",
	},
	{
		pattern: /\bdd\s+if=.*of=(\/dev\/[a-z]+|\\\\\.\\)/i,
		reason: "Direct raw block device write",
	},
	{
		pattern: /\bformat\s+[a-zA-Z]:/i,
		reason: "Drive format operation",
	},
	{
		pattern: /\b(diskpart|fdisk|parted|gdisk)\b/i,
		reason: "Disk partitioning tool",
	},
	// Critical system process termination
	{
		pattern: /\btaskkill\s+.*\/[fF]\s+.*\/[iI][mM]\s+(svchost|csrss|explorer|wininit|lsass|services)\.exe/i,
		reason: "Force termination of essential Windows system processes",
	},
	{
		pattern: /\bkillall\s+(-9\s+)?(systemd|init|launchd|kernel_task)\b/i,
		reason: "Termination of core OS init process",
	},
	// Fork bombs & system crashes
	{
		pattern: /:\(\)\s*\{\s*:\|:&\s*\}\s*;\s*:/,
		reason: "POSIX fork bomb detected",
	},
	{
		pattern: /%(0|%0)/,
		reason: "Batch fork bomb detected",
	},
	{
		pattern: />\s*\/dev\/sd[a-z]/,
		reason: "Overwriting raw storage device",
	},
];

/**
 * Normalizes a path for cross-platform matching
 */
function normalizePathForCheck(p: string): string {
	return normalize(p).replace(/\\/g, "/");
}

/**
 * Resolves the real canonical path if the file/directory or an ancestor exists
 */
function getCanonicalPath(targetPath: string): string {
	try {
		return realpathSync(targetPath);
	} catch {
		// If the file doesn't exist, resolve its absolute path
		return resolve(targetPath);
	}
}

/**
 * Checks whether a given path is a protected credential, system, or sensitive path
 */
export function isProtectedPath(targetPath: string, cwd?: string): { protected: boolean; reason?: string } {
	if (!targetPath || typeof targetPath !== "string") {
		return { protected: false };
	}

	const home = homedir();

	// Expand ~ to user homedir
	let expanded = targetPath;
	if (expanded === "~") {
		expanded = home;
	} else if (expanded.startsWith("~/") || expanded.startsWith("~\\")) {
		expanded = resolve(home, expanded.slice(2));
	}

	// Resolve absolute path relative to cwd
	const absolutePath = isAbsolute(expanded) ? resolve(expanded) : resolve(cwd ?? process.cwd(), expanded);
	const canonicalPath = getCanonicalPath(absolutePath);
	const normalizedCanonical = normalizePathForCheck(canonicalPath);

	// Check system and user-level protected path patterns
	for (const pattern of PROTECTED_PATH_PATTERNS) {
		if (
			pattern.test(normalizedCanonical) ||
			pattern.test(normalizePathForCheck(absolutePath)) ||
			pattern.test(normalizePathForCheck(targetPath))
		) {
			return {
				protected: true,
				reason: `Path matches protected credential or system pattern: ${pattern.toString()}`,
			};
		}
	}

	// Check if target is directly inside homedir sensitive config directories
	const sensitiveHomeDirs = [".ssh", ".aws", ".gnupg", ".docker"];
	for (const dir of sensitiveHomeDirs) {
		const sensitivePath = normalizePathForCheck(resolve(home, dir));
		if (normalizedCanonical === sensitivePath || normalizedCanonical.startsWith(`${sensitivePath}/`)) {
			return {
				protected: true,
				reason: `Path is inside protected user directory: ~/${dir}`,
			};
		}
	}

	// Check Windows specific credential directories
	if (process.platform === "win32") {
		const appData = process.env.APPDATA;
		const localAppData = process.env.LOCALAPPDATA;
		if (appData) {
			const vaultPath = normalizePathForCheck(resolve(appData, "Microsoft", "Vault"));
			if (normalizedCanonical === vaultPath || normalizedCanonical.startsWith(`${vaultPath}/`)) {
				return { protected: true, reason: "Path is inside Windows Vault credential store" };
			}
		}
		if (localAppData) {
			const credPath = normalizePathForCheck(resolve(localAppData, "Microsoft", "Credentials"));
			if (normalizedCanonical === credPath || normalizedCanonical.startsWith(`${credPath}/`)) {
				return { protected: true, reason: "Path is inside Windows Credentials store" };
			}
		}
	}

	// Project-level .env protection: Protect .env files when outside the project cwd
	const isEnvFile = /[/\\]\.env(\.[a-zA-Z0-9_-]+)?$/i.test(normalizedCanonical);
	if (isEnvFile && cwd) {
		const normalizedCwd = normalizePathForCheck(resolve(cwd));
		const rel = relative(normalizedCwd, normalizedCanonical);
		const isOutsideCwd = rel.startsWith("..") || isAbsolute(rel);
		if (isOutsideCwd) {
			return {
				protected: true,
				reason: "Direct access to external environment file outside the current workspace is blocked",
			};
		}
	}

	return { protected: false };
}

/**
 * Sanitizes environment variables for subagents and Python kernel execution,
 * redacting sensitive host credentials unless explicitly exempted.
 */
export function sanitizeKernelEnv(
	env: NodeJS.ProcessEnv = process.env,
	allowedKeys?: readonly string[],
): NodeJS.ProcessEnv {
	const sanitized: NodeJS.ProcessEnv = { ...env };
	const allowedSet = new Set(allowedKeys ?? []);

	for (const key of Object.keys(sanitized)) {
		if (allowedSet.has(key)) {
			continue;
		}

		if (SENSITIVE_ENV_VARS.has(key)) {
			delete sanitized[key];
			continue;
		}

		// Redact general secret-like patterns in non-standard env vars
		if (/_(SECRET|TOKEN|API_KEY|PRIVATE_KEY)$/i.test(key)) {
			delete sanitized[key];
		}
	}

	return sanitized;
}

/**
 * Analyzes a shell command and classifies its risk level
 */
export function analyzeCommandRisk(command: string, _cwd?: string): { riskLevel: CommandRiskLevel; reason?: string } {
	if (!command || typeof command !== "string") {
		return { riskLevel: "SAFE" };
	}

	const trimmed = command.trim();
	if (!trimmed) {
		return { riskLevel: "SAFE" };
	}

	// Test against destructive rules
	for (const { pattern, reason } of DESTRUCTIVE_PATTERNS) {
		if (pattern.test(trimmed)) {
			return {
				riskLevel: "DESTRUCTIVE",
				reason,
			};
		}
	}

	return { riskLevel: "SAFE" };
}
