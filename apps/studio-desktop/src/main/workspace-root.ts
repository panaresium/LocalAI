import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export function resolveWorkspaceRoot(startDir: string, env: NodeJS.ProcessEnv = process.env): string {
  const configuredRoot = env.HERMES_STUDIO_WORKSPACE_ROOT;
  if (configuredRoot) {
    const resolvedRoot = resolve(configuredRoot);
    if (isWorkspaceRoot(resolvedRoot)) {
      return resolvedRoot;
    }

    throw new Error(`HERMES_STUDIO_WORKSPACE_ROOT is not a Hermes Local AI workspace: ${resolvedRoot}`);
  }

  let candidate = resolve(startDir);
  while (true) {
    if (isWorkspaceRoot(candidate)) {
      return candidate;
    }

    const parent = dirname(candidate);
    if (parent === candidate) {
      throw new Error(`Unable to locate Hermes Local AI workspace root from ${startDir}`);
    }

    candidate = parent;
  }
}

function isWorkspaceRoot(candidate: string): boolean {
  return (
    existsSync(join(candidate, "pnpm-workspace.yaml")) &&
    existsSync(join(candidate, "packages")) &&
    existsSync(join(candidate, "services"))
  );
}
