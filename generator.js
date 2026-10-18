export const presets = {
  native: { label: "Native Linux", compiler: "gcc", processor: null },
  aarch64: { label: "AArch64 Linux (64-bit ARM)", compiler: "aarch64-linux-gnu-gcc", processor: "aarch64" },
  armhf: { label: "ARM Linux hard-float (32-bit)", compiler: "arm-linux-gnueabihf-gcc", processor: "arm" },
  custom: { label: "Custom Linux toolchain", compiler: "aarch64-linux-gnu-gcc", processor: "aarch64" }
};

export const defaults = {
  name: "hello_c", generator: "make", target: "native", compiler: "gcc",
  processor: "aarch64", sysroot: "", standard: "c11", mode: "Debug",
  optimization: "0", warnings: "strict", template: "greeting"
};

const choices = {
  generator: ["make", "cmake"], target: Object.keys(presets),
  processor: ["aarch64", "arm", "x86_64", "riscv64"],
  standard: ["c99", "c11", "c17"], mode: ["Debug", "Release"],
  optimization: ["0", "1", "2", "3", "s"],
  warnings: ["basic", "strict"], template: ["greeting", "sensor"]
};
const reserved = /^(all|clean|help|install|uninstall|test|package|package_source|edit_cache|rebuild_cache|zero_check|run_tests|continuous.*|experimental.*|nightly.*)$/i;
const safePath = value => /^\/[A-Za-z0-9_./+-]+$/.test(value) &&
  !value.split("/").some(part => part === ".." || part === ".") &&
  !value.includes("//") && !value.endsWith("/");

export function validate(input) {
  const o = { ...defaults, ...input };
  const errors = {};
  if (typeof o.name !== "string" || !/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(o.name) || reserved.test(o.name)) {
    errors.name = "Use 1–40 letters, digits, underscores or hyphens; start with a letter. Build command names such as all and clean are reserved.";
  }
  for (const [key, allowed] of Object.entries(choices)) {
    if (!allowed.includes(o[key])) errors[key] = `Choose a supported ${key}.`;
  }
  if (typeof o.compiler !== "string" ||
      !(/^[A-Za-z][A-Za-z0-9_.+-]*$/.test(o.compiler) || safePath(o.compiler))) {
    errors.compiler = "Enter one compiler name or absolute Linux path. Spaces, shell syntax, relative paths and arguments are not allowed.";
  }
  if (typeof o.sysroot !== "string" || (o.sysroot !== "" && !safePath(o.sysroot))) {
    errors.sysroot = "Use an absolute Linux directory without spaces, quotes, variables or dot segments, or leave empty for the compiler's default.";
  }
  if (o.target === "native" && o.sysroot) errors.sysroot = "A sysroot is only supported for cross-compilation.";
  return { options: o, errors };
}

function hash(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16);
}

export function generate(input = {}) {
  const { options: o, errors } = validate(input);
  if (Object.keys(errors).length) throw new Error(Object.values(errors).join("\n"));
  const cross = o.target !== "native";
  const processor = o.target === "custom" ? o.processor : presets[o.target].processor;
  const id = `${o.target}-${o.mode.toLowerCase()}-${hash(JSON.stringify(o))}`;
  const dir = `build/${o.generator}-${id}`;
  const warnings = o.warnings === "strict" ? "-Wall -Wextra -Wpedantic" : "-Wall";
  const flags = `-std=${o.standard} -O${o.optimization} ${o.mode === "Debug" ? "-g" : "-DNDEBUG"} ${warnings}`;
  const sysroot = o.sysroot ? `--sysroot=${o.sysroot}` : "";
  const files = {
    "main.c": o.template === "greeting"
      ? '#include <stdio.h>\n\nint main(void)\n{\n    puts("Hello from C!");\n    return 0;\n}\n'
      : '#include <stdio.h>\n\nint main(void)\n{\n    const int temperature = 23;\n    printf("Sensor reading: %d C\\n", temperature);\n    return 0;\n}\n'
  };
  let commands;
  if (o.generator === "make") {
    files.Makefile = `# GNU Make; recipes below begin with real tabs.
# Replace Make's built-in CC=cc, but preserve environment/command-line overrides.
ifneq ($(filter default undefined,$(origin CC)),)
CC := ${o.compiler}
endif
CFLAGS ?= ${flags}
CPPFLAGS ?=
LDFLAGS ?=
LDLIBS ?=

.DEFAULT_GOAL := all
.PHONY: all clean
all: ${dir}/${o.name}

${dir}/${o.name}: ${dir}/main.o Makefile
\t$(CC) ${sysroot} $(CFLAGS) $(LDFLAGS) ${dir}/main.o $(LDLIBS) -o $@

${dir}/main.o: main.c Makefile
\t@mkdir -p ${dir}
\t$(CC) ${sysroot} $(CPPFLAGS) $(CFLAGS) -MMD -MP -c $< -o $@

-include ${dir}/main.d

clean:
\trm -rf -- ${dir}
`;
    commands = `make\n${cross ? "# Copy the following binary to your compatible target:\n# " : "./"}${dir}/${o.name}`;
  } else {
    files["CMakeLists.txt"] = `cmake_minimum_required(VERSION 3.16)
project(${o.name} LANGUAGES C)

add_executable(${o.name} main.c)
set_target_properties(${o.name} PROPERTIES
    C_STANDARD ${o.standard.slice(1)}
    C_STANDARD_REQUIRED YES
    C_EXTENSIONS NO
    RUNTIME_OUTPUT_DIRECTORY "\${CMAKE_BINARY_DIR}/bin")
if(CMAKE_C_COMPILER_ID MATCHES "GNU|Clang")
    target_compile_options(${o.name} PRIVATE ${warnings} -O${o.optimization})
endif()
`;
    if (cross) {
      files["toolchain.cmake"] = `set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR ${processor})
set(CMAKE_C_COMPILER "${o.compiler}")
${o.sysroot ? `set(CMAKE_SYSROOT "${o.sysroot}")\nset(CMAKE_FIND_ROOT_PATH "${o.sysroot}")\n` : ""}set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)
`;
    }
    commands = `cmake -S . -B ${dir} -DCMAKE_BUILD_TYPE=${o.mode} ${cross ? "-DCMAKE_TOOLCHAIN_FILE=toolchain.cmake" : `-DCMAKE_C_COMPILER=${o.compiler}`}\ncmake --build ${dir} --config ${o.mode}\n${cross ? "# Copy the following binary to your compatible target:\n# " : "./"}${dir}/bin/${o.name}`;
  }
  const binary = `${dir}/${o.generator === "cmake" ? "bin/" : ""}${o.name}`;
  const expected = o.template === "greeting" ? "Hello from C!\n" : "Sensor reading: 23 C\n";
  files["README.md"] = `# ${o.name}

Generated by C Build Lab: https://itsnavin.github.io/c-build-generator/
Target: ${presets[o.target].label}${cross ? ` (${processor})` : ""}.
Compiler: ${o.compiler}. C standard: ${o.standard}. Configuration: ${o.mode}.
Optimization: -O${o.optimization}. ${o.template === "sensor" ? "The sensor is simulated; no hardware is accessed." : ""}

## Prerequisites

These commands assume Linux (or a Linux environment such as WSL) with GNU Make
${o.generator === "cmake" ? "and CMake 3.16 or newer " : ""}and a GCC-compatible compiler.
On Ubuntu/Debian, for example:

\`\`\`sh
sudo apt update
sudo apt install build-essential${o.generator === "cmake" ? " cmake" : ""}${o.target === "aarch64" ? " gcc-aarch64-linux-gnu" : o.target === "armhf" ? " gcc-arm-linux-gnueabihf" : ""}
\`\`\`

${o.target === "custom" ? "Install your vendor's Linux-targeting GCC-compatible compiler and matching libraries separately.\n" : ""}
Extract this ZIP, open a terminal inside its folder, then:

\`\`\`sh
${commands}
\`\`\`

${cross ? `## Run on the target, NOT this build computer

Inspect the file on the build computer with \`file ${binary}\` and
\`readelf -h ${binary}\`. Check the architecture, ELF class, ABI, dynamic loader,
libc version and CPU/FPU support against your target OS. AArch64 needs a 64-bit
ARM Linux userspace; an ARM hard-float toolchain needs a matching hard-float OS.
A Raspberry Pi model alone does not establish compatibility.

Copy \`${binary}\` to your target using your usual file transfer method.
On the target, in the directory containing the copied file:

\`\`\`sh
chmod +x ${o.name}
./${o.name}
\`\`\`

An ARM binary cannot run directly on an x86 host. Emulation requires separately
configured QEMU and matching target runtime libraries; it is not set up here.
` : "## Run locally\n\nThe run command above is for the same compatible Linux computer used to build.\n"}
Expected output:

\`\`\`text
${expected}\`\`\`

## What is happening?

1. Preprocessing expands #include and macros.
2. Compilation (including assembly) creates an object file from C source.
3. Linking uses the compiler driver to combine objects and runtime libraries.

The build machine runs the tools. For this simple program, host/target means the
machine that runs the resulting program. In compiler-building terminology, host
is where a compiler runs, and target is what that compiler generates code for.
Native builds use the same platform; cross builds use a different platform.

A compiler prefix (such as aarch64-linux-gnu-) selects tool executables.
A sysroot is a directory of TARGET headers and libraries, not a compiler folder.
${o.sysroot ? `This project uses sysroot ${o.sysroot}; supply it on the build machine.` : "No sysroot is forced; the compiler's configured target libraries are used."}
Never substitute host x86 libraries for ARM libraries.

## Changing settings and cleaning

Regenerate when changing target, compiler or options: generated configurations
use distinct build directories. Do not reconfigure an existing CMake directory
with another toolchain. These examples use a single-config generator (Unix Makefiles
or Ninja); choose a fresh directory if switching generators.
${o.generator === "make" ? `\`make clean\` deletes only ${dir}.
GNU Make respects CC, CPPFLAGS, CFLAGS, LDFLAGS and LDLIBS overrides.
For example: \`make clean && make CC=${o.compiler} CFLAGS='-std=${o.standard} -O2 -Wall'\`.
Clean first when changing flags or CC via overrides; Make cannot detect those changes.` : `To clean compiled outputs, use \`cmake --build ${dir} --target clean\`.
Debug/Release flags come from CMake; the selected optimization is target-specific.
This starter intentionally does not define an install target.`}

## References

- https://www.gnu.org/software/make/manual/
- https://cmake.org/cmake/help/latest/manual/cmake-toolchains.7.html
- https://gcc.gnu.org/onlinedocs/gcc/Directory-Options.html
`;
  return { files, commands, binary, expected, directory: dir, cross };
}
