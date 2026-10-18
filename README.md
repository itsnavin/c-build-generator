# C Build Lab

A beginner-friendly, static **Makefile and CMake generator in one project**.
Choose a simple greeting or simulated temperature program, configure a native
Linux or cross build, inspect every generated file and download a ready-to-edit ZIP.

**Site:** https://itsnavin.github.io/c-build-generator/

## What it generates

- `main.c` with a clean C99/C11/C17 starter and deterministic output.
- A GNU Makefile, or `CMakeLists.txt` plus `toolchain.cmake` for cross builds.
- A project-specific README with prerequisites, build/run commands and explanations.

Set a validated project/executable name, compiler, language standard, Debug/Release,
optimization and warnings. Linux cross presets cover AArch64 and ARM hard-float;
custom Linux toolchains can select AArch64, ARM, x86_64 or RISC-V 64 and an optional
absolute sysroot. Compilers must accept GCC-style flags. This is not a bare-metal
generator, a full IDE, or a native Windows/MSVC generator.

All generation, previews, copying and ZIP creation happen in the browser. No
backend, compiler service, API key, analytics or user accounts are used. Invalid
fields stop preview/download instead of emitting unsafe shell, Make or CMake syntax.
Paths intentionally exclude spaces, variables, backslashes and dot segments.
Generated source templates are fixed; edit the downloaded `main.c` to go further.

## Learn the build

Preprocessing expands headers/macros; compilation and assembly create objects;
linking joins objects and runtime libraries, using the compiler driver.
The page's learning guide and downloaded README explain build/host/target,
compiler prefixes, sysroots, ABI compatibility and where executables run.

Cross binaries must run on a compatible target, not directly on an x86 build host.
A Raspberry Pi CPU does not establish OS, ABI, libc or loader compatibility.
QEMU and target runtime setup are intentionally not provided. A simulated sensor
does not access hardware.

GNU Make recipes use real tabs, replace only the built-in/undefined `CC`, honor
user flags, track headers with `-MMD -MP`, link through the compiler, and scope
cleaning to one generated configuration directory. Clean before changing manual
compiler/flag overrides. CMake requires 3.16+, uses C-only target properties,
and loads cross toolchains at configure time before `project()`. No compiler-check
bypass or install target is generated. Generated commands assume a single-config
Linux generator such as Unix Makefiles or Ninja.

## Local development

The site itself needs no build step or runtime dependencies. Use Node.js 22+ and
Python 3 for development checks:

```sh
npm ci
npm start
# Open http://127.0.0.1:4173
npm test
npx playwright install chromium
npm run test:browser
```

On Ubuntu/Debian, to run actual compilation checks:

```sh
sudo apt update
sudo apt install build-essential cmake clang gcc-aarch64-linux-gnu gcc-arm-linux-gnueabihf
npm run test:build
```

`npm test` checks option combinations, invalid/injection inputs, build isolation,
toolchain output and ZIP byte integrity (using Python's ZIP CRC validation).
`test:build` builds 96 combinations across Make/CMake, three C standards, both
configurations, two templates and native/AArch64/ARM/custom toolchains. It runs
native binaries and compares exact output, checks ARM ELF machine/class and
hard-float ABI, and checks Make header dependencies, overrides and clean scope.
Cross binaries are inspected, **not executed**. Custom uses the installed AArch64
compiler in CI; arbitrary vendor SDKs and user-provided sysroots cannot be
certified by these tests.

Playwright checks Chromium at desktop and mobile sizes, field errors, file-tab
keyboard controls, copy, actual downloaded ZIP contents and horizontal overflow.
Screenshots/traces are uploaded as CI artifacts. These checks do not replace a
manual screen-reader audit or real-device/other-browser testing.

## Publishing

GitHub Pages serves only the five static app files. In repository Settings → Pages,
select **GitHub Actions** as the source. Push to `main` to run **Publish Pages**.
The separate **Verify** workflow performs unit, actual Linux compilation and
browser checks on pushes and pull requests. Check it before merging; publishing
itself does not imply tests passed.

To verify a deployed site with the same browser/download checks:

```sh
LIVE_URL=https://itsnavin.github.io/c-build-generator/ npm run test:browser
```

On PowerShell use `$env:LIVE_URL = 'https://itsnavin.github.io/c-build-generator/'`
before `npm run test:browser`.

## Official references

- [GNU Make built-in compiler variables](https://www.gnu.org/software/make/manual/html_node/Implicit-Variables.html)
- [GNU Make variable origin](https://www.gnu.org/software/make/manual/html_node/Origin-Function.html)
- [CMake Linux cross toolchains and find-root policies](https://cmake.org/cmake/help/latest/manual/cmake-toolchains.7.html)
- [GCC include and sysroot options](https://gcc.gnu.org/onlinedocs/gcc/Directory-Options.html)
- [Debian cross-compiler package: AArch64](https://packages.debian.org/stable/gcc-aarch64-linux-gnu)
- [Debian cross-compiler package: ARM hard-float](https://packages.debian.org/stable/gcc-arm-linux-gnueabihf)

Package examples are Ubuntu/Debian-specific; check your distribution's package
manager and your target OS/vendor documentation for matching runtime libraries.
