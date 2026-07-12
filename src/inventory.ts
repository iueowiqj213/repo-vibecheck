import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

const IGNORED = new Set([".git", "node_modules", "dist", "build", "coverage", ".next", ".turbo", ".sisyphus"]);
const TEXT_EXTENSIONS = /\.(?:[cm]?[jt]sx?|py|md|json|ya?ml|toml|env|txt|prisma)$/i;
const SPECIAL_TEXT = /(?:^|\/)(?:Dockerfile|\.env\.example)$/i;

export interface Inventory { files: string[]; sources: Map<string, string> }

export async function inventoryRepository(root: string): Promise<Inventory> {
  const absoluteRoot = resolve(root);
  const rootStats = await stat(absoluteRoot);
  if (!rootStats.isDirectory()) throw new Error(`Target is not a directory: ${root}`);
  const files: string[] = [];
  const sources = new Map<string, string>();
  let totalTextBytes = 0;
  await walk(absoluteRoot, 0);
  files.sort();
  return { files, sources };

  async function walk(directory: string, depth: number): Promise<void> {
    if (depth > 40) throw new Error("Repository exceeds the maximum scan depth (40)");
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || IGNORED.has(entry.name) || (/^\.env(?:\.|$)/.test(entry.name) && entry.name !== ".env.example")) continue;
      const fullPath = resolve(directory, entry.name);
      if (entry.isDirectory()) { await walk(fullPath, depth + 1); continue; }
      if (!entry.isFile()) continue;
      const name = relative(absoluteRoot, fullPath).replaceAll("\\", "/");
      files.push(name);
      if (files.length > 20_000) throw new Error("Repository exceeds the maximum file count (20000)");
      const fileSize = (await stat(fullPath)).size;
      if ((TEXT_EXTENSIONS.test(name) || SPECIAL_TEXT.test(name)) && fileSize <= 512_000) {
        totalTextBytes += fileSize;
        if (totalTextBytes > 20_000_000) throw new Error("Repository exceeds the maximum text scan size (20 MB)");
        sources.set(name, await readFile(fullPath, "utf8"));
      }
    }
  }
}
