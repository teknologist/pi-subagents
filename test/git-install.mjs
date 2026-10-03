import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const { loadExtensions } = await import(new URL("./core/extensions/loader.js", import.meta.resolve("@earendil-works/pi-coding-agent")));

const repository = fileURLToPath(new URL("..", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "pi-subagents-git-"));
try {
  // Copy the Git file set, not ignored build artifacts or development dependencies.
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: repository, encoding: "utf8" }).split("\0").filter(Boolean);
  for (const file of files) {
    await mkdir(join(temporary, file, ".."), { recursive: true });
    await cp(join(repository, file), join(temporary, file));
  }
  assert.equal(existsSync(join(temporary, "dist")), false);
  execFileSync("npm", ["install", "--omit=dev", "--legacy-peer-deps", "--no-audit", "--no-fund"], { cwd: temporary, stdio: "inherit" });
  const pkg = JSON.parse(await readFile(join(temporary, "package.json"), "utf8"));
  const result = await loadExtensions(pkg.pi.extensions.map((path) => join(temporary, path)), temporary);
  assert.deepEqual(result.errors, []);
  assert.equal(result.extensions.length, 1);
  assert.equal(existsSync(join(temporary, "dist")), false);
  for (const extension of result.extensions) {
    for (const shutdown of extension.handlers.get("session_shutdown") ?? []) {
      await shutdown({ type: "session_shutdown" }, {});
    }
  }
  console.log("Clean Git source install and real Pi loader passed without dist");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
