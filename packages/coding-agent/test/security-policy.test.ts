import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeCommandRisk, isProtectedPath, sanitizeKernelEnv } from "../src/core/security/security-policy.js";

describe("Security Policy Engine", () => {
	describe("Layer 1: Sensitive Path & Credential Shield (isProtectedPath)", () => {
		const cwd = join(homedir(), "projects", "my-app");

		it("should flag protected SSH directory and key paths", () => {
			const sshKeyPath = join(homedir(), ".ssh", "id_ed25519");
			const result = isProtectedPath(sshKeyPath, cwd);
			expect(result.protected).toBe(true);
			expect(result.reason).toBeDefined();

			const relativeSsh = join("~", ".ssh", "id_rsa");
			expect(isProtectedPath(relativeSsh, cwd).protected).toBe(true);
		});

		it("should flag protected AWS credentials directory and files", () => {
			const awsCredsPath = join(homedir(), ".aws", "credentials");
			const result = isProtectedPath(awsCredsPath, cwd);
			expect(result.protected).toBe(true);

			const relativeAws = join("~", ".aws", "config");
			expect(isProtectedPath(relativeAws, cwd).protected).toBe(true);
		});

		it("should flag protected GnuPG directory", () => {
			const gpgPath = join(homedir(), ".gnupg", "secring.gpg");
			expect(isProtectedPath(gpgPath, cwd).protected).toBe(true);
		});

		it("should flag protected credential files like .git-credentials and .netrc", () => {
			const gitCreds = join(homedir(), ".git-credentials");
			expect(isProtectedPath(gitCreds, cwd).protected).toBe(true);

			const netrc = join(homedir(), ".netrc");
			expect(isProtectedPath(netrc, cwd).protected).toBe(true);
		});

		it("should flag system shadow and sudoers paths", () => {
			expect(isProtectedPath("/etc/shadow", cwd).protected).toBe(true);
			expect(isProtectedPath("/etc/sudoers", cwd).protected).toBe(true);
		});

		it("should flag .env files when outside cwd", () => {
			const externalEnv = join(homedir(), "other-project", ".env");
			expect(isProtectedPath(externalEnv, cwd).protected).toBe(true);

			const externalEnvLocal = join(homedir(), "other-project", ".env.local");
			expect(isProtectedPath(externalEnvLocal, cwd).protected).toBe(true);
		});

		it("should allow regular project source files inside cwd", () => {
			const srcFile = join(cwd, "src", "index.ts");
			expect(isProtectedPath(srcFile, cwd).protected).toBe(false);

			const readme = join(cwd, "README.md");
			expect(isProtectedPath(readme, cwd).protected).toBe(false);

			const projectEnv = join(cwd, ".env");
			expect(isProtectedPath(projectEnv, cwd).protected).toBe(false);
		});
	});

	describe("Layer 1: Environment Variable Sanitizer (sanitizeKernelEnv)", () => {
		it("should redact sensitive host credentials and API keys", () => {
			const hostEnv: NodeJS.ProcessEnv = {
				PATH: "/usr/bin:/bin",
				NODE_ENV: "production",
				ANTHROPIC_API_KEY: "sk-ant-12345",
				OPENAI_API_KEY: "sk-proj-67890",
				GITHUB_TOKEN: "ghp_secrettoken",
				SSH_AUTH_SOCK: "/tmp/ssh-agent.sock",
				AWS_SECRET_ACCESS_KEY: "awsSecretKey123",
				MY_CUSTOM_SECRET: "topsecret",
				CUSTOM_API_KEY: "key999",
				PUBLIC_VAR: "allowed_value",
			};

			const sanitized = sanitizeKernelEnv(hostEnv);

			expect(sanitized.PATH).toBe("/usr/bin:/bin");
			expect(sanitized.NODE_ENV).toBe("production");
			expect(sanitized.PUBLIC_VAR).toBe("allowed_value");

			expect(sanitized.ANTHROPIC_API_KEY).toBeUndefined();
			expect(sanitized.OPENAI_API_KEY).toBeUndefined();
			expect(sanitized.GITHUB_TOKEN).toBeUndefined();
			expect(sanitized.SSH_AUTH_SOCK).toBeUndefined();
			expect(sanitized.AWS_SECRET_ACCESS_KEY).toBeUndefined();
			expect(sanitized.MY_CUSTOM_SECRET).toBeUndefined();
			expect(sanitized.CUSTOM_API_KEY).toBeUndefined();
		});

		it("should respect explicit allowlist when specified", () => {
			const hostEnv: NodeJS.ProcessEnv = {
				OPENAI_API_KEY: "sk-proj-123",
				GITHUB_TOKEN: "ghp_123",
			};

			const sanitized = sanitizeKernelEnv(hostEnv, ["GITHUB_TOKEN"]);
			expect(sanitized.GITHUB_TOKEN).toBe("ghp_123");
			expect(sanitized.OPENAI_API_KEY).toBeUndefined();
		});
	});

	describe("Layer 2: Destructive Command Interceptor (analyzeCommandRisk)", () => {
		it("should flag filesystem wipe commands as DESTRUCTIVE", () => {
			expect(analyzeCommandRisk("rm -rf /").riskLevel).toBe("DESTRUCTIVE");
			expect(analyzeCommandRisk("rm -rf $HOME").riskLevel).toBe("DESTRUCTIVE");
			expect(analyzeCommandRisk("rm -rf *").riskLevel).toBe("DESTRUCTIVE");
			expect(analyzeCommandRisk("rm -fr /").riskLevel).toBe("DESTRUCTIVE");
			expect(analyzeCommandRisk("rm -rf --no-preserve-root /").riskLevel).toBe("DESTRUCTIVE");
			expect(analyzeCommandRisk("del /f /s /q C:\\*").riskLevel).toBe("DESTRUCTIVE");
			expect(analyzeCommandRisk("rmdir /s /q C:\\").riskLevel).toBe("DESTRUCTIVE");
			expect(analyzeCommandRisk("Remove-Item -Path C:\\ -Recurse -Force").riskLevel).toBe("DESTRUCTIVE");
		});

		it("should flag destructive Git operations as DESTRUCTIVE", () => {
			expect(analyzeCommandRisk("git push origin main --force").riskLevel).toBe("DESTRUCTIVE");
			expect(analyzeCommandRisk("git push -f origin main").riskLevel).toBe("DESTRUCTIVE");
			expect(analyzeCommandRisk("git reset --hard HEAD~1").riskLevel).toBe("DESTRUCTIVE");
			expect(analyzeCommandRisk("git clean -fd").riskLevel).toBe("DESTRUCTIVE");
			expect(analyzeCommandRisk("git branch -D main").riskLevel).toBe("DESTRUCTIVE");
		});

		it("should flag disk partitioning and format commands as DESTRUCTIVE", () => {
			expect(analyzeCommandRisk("mkfs.ext4 /dev/sda1").riskLevel).toBe("DESTRUCTIVE");
			expect(analyzeCommandRisk("dd if=/dev/zero of=/dev/sda bs=1M").riskLevel).toBe("DESTRUCTIVE");
			expect(analyzeCommandRisk("format C:").riskLevel).toBe("DESTRUCTIVE");
			expect(analyzeCommandRisk("diskpart").riskLevel).toBe("DESTRUCTIVE");
			expect(analyzeCommandRisk("fdisk /dev/sda").riskLevel).toBe("DESTRUCTIVE");
		});

		it("should flag critical system process termination as DESTRUCTIVE", () => {
			expect(analyzeCommandRisk("taskkill /F /IM explorer.exe").riskLevel).toBe("DESTRUCTIVE");
			expect(analyzeCommandRisk("taskkill /F /IM svchost.exe").riskLevel).toBe("DESTRUCTIVE");
			expect(analyzeCommandRisk("killall -9 systemd").riskLevel).toBe("DESTRUCTIVE");
		});

		it("should flag fork bombs as DESTRUCTIVE", () => {
			expect(analyzeCommandRisk(":(){ :|:& };:").riskLevel).toBe("DESTRUCTIVE");
			expect(analyzeCommandRisk("%0|%0").riskLevel).toBe("DESTRUCTIVE");
		});

		it("should allow safe standard developer commands as SAFE", () => {
			expect(analyzeCommandRisk("git commit -m 'feat: safe commit'").riskLevel).toBe("SAFE");
			expect(analyzeCommandRisk("git checkout -b new-feature").riskLevel).toBe("SAFE");
			expect(analyzeCommandRisk("npm test").riskLevel).toBe("SAFE");
			expect(analyzeCommandRisk("npm run build").riskLevel).toBe("SAFE");
			expect(analyzeCommandRisk("git status").riskLevel).toBe("SAFE");
			expect(analyzeCommandRisk("git add .").riskLevel).toBe("SAFE");
			expect(analyzeCommandRisk("rm -rf node_modules").riskLevel).toBe("SAFE");
			expect(analyzeCommandRisk("rm -rf dist").riskLevel).toBe("SAFE");
			expect(analyzeCommandRisk("ls -la").riskLevel).toBe("SAFE");
			expect(analyzeCommandRisk("cat package.json").riskLevel).toBe("SAFE");
			expect(analyzeCommandRisk("").riskLevel).toBe("SAFE");
		});
	});
});
