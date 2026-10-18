import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { generate, presets } from "../generator.js";

const root = mkdtempSync(join(tmpdir(), "c-build-compile-"));
const run = (command, args, cwd = root, env = process.env) => execFileSync(command, args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
let count = 0;
try {
  for (const target of ["native", "aarch64", "armhf", "custom"])
    for (const generator of ["make", "cmake"])
      for (const standard of ["c99", "c11", "c17"])
        for (const mode of ["Debug", "Release"])
          for (const template of ["greeting", "sensor"]) {
            const compiler = target === "custom" ? "aarch64-linux-gnu-gcc" : presets[target].compiler;
            const options = { target, generator, compiler, standard, mode, template, optimization: mode === "Debug" ? "0" : "2" };
            const p = generate(options);
            const cwd = mkdtempSync(join(root, "case-"));
            for (const [name, text] of Object.entries(p.files)) writeFileSync(join(cwd, name), text);
            if (generator === "make") run("make", [], cwd);
            else {
              run("cmake", ["-S", ".", "-B", p.directory, `-DCMAKE_BUILD_TYPE=${mode}`, ...(p.cross ? ["-DCMAKE_TOOLCHAIN_FILE=toolchain.cmake"] : [`-DCMAKE_C_COMPILER=${compiler}`])], cwd);
              run("cmake", ["--build", p.directory, "--config", mode], cwd);
            }
            const binary = join(cwd, p.binary);
            const elf = readFileSync(binary);
            assert.equal(elf.subarray(0, 4).toString(), "\x7fELF");
            const machine = elf.readUInt16LE(18);
            assert.equal(machine, target === "native" ? 62 : target === "armhf" ? 40 : 183);
            assert.equal(elf[4], target === "armhf" ? 1 : 2);
            if (target === "native") assert.equal(run(binary, [], cwd), p.expected);
            if (target === "armhf") assert.match(run("readelf", ["-h", binary]), /hard-float ABI/);
            if (generator === "make" && target === "native" && standard === "c11" && mode === "Debug" && template === "greeting") {
              const obj = join(cwd, p.directory, "main.o");
              const before = statSync(obj).mtimeMs;
              run("make", [], cwd);
              assert.equal(statSync(obj).mtimeMs, before, "up-to-date build should not compile");
              writeFileSync(join(cwd, "value.h"), '#define MESSAGE "Header tracked!"\n');
              writeFileSync(join(cwd, "main.c"), '#include <stdio.h>\n#include "value.h"\nint main(void) { puts(MESSAGE); return 0; }\n');
              run("make", [], cwd);
              assert.equal(run(binary, [], cwd), "Header tracked!\n");
              writeFileSync(join(cwd, "value.h"), '#define MESSAGE "Header changed!"\n');
              run("make", [], cwd);
              assert.equal(run(binary, [], cwd), "Header changed!\n");
              writeFileSync(join(cwd, "keep.txt"), "keep");
              run("make", ["clean"], cwd);
              assert.equal(readFileSync(join(cwd, "keep.txt"), "utf8"), "keep");
              const commandLine = run("make", ["-n", "CC=clang", "CFLAGS=-std=c17 -O1", "LDFLAGS=-Wl,--as-needed", "LDLIBS=-lm"], cwd);
              assert.match(commandLine, /clang.*-std=c17 -O1/);
              assert.match(commandLine, /-Wl,--as-needed.*-lm/);
              const environment = run("make", ["-n"], cwd, { ...process.env, CC: "clang" });
              assert.match(environment, /clang/);
              run("make", ["CC=clang", "CFLAGS=-std=c17 -O1 -Wall", "LDLIBS=-lm"], cwd);
              assert.equal(run(binary, [], cwd), "Header changed!\n");
            }
            count++;
          }
  console.log(`${count} real Linux builds passed; native output exact; ARM/AArch64 ELF headers verified (cross binaries NOT executed).`);
} catch (error) {
  console.error(error.stderr?.toString() || error);
  process.exitCode = 1;
} finally {
  rmSync(root, { recursive: true, force: true });
}
