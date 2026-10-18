import { presets, validate, generate } from "./generator.js";
import { zip } from "./zip.js";

const form = document.querySelector("#settings");
const tabs = document.querySelector("#file-tabs");
const panel = document.querySelector("#file-panel");
const preview = document.querySelector("#preview");
const copy = document.querySelector("#copy");
const download = document.querySelector("#download");
const status = document.querySelector("#status");
let project;
let active = "main.c";

function showFile(name) {
  active = name;
  for (const tab of tabs.children) {
    const selected = tab.dataset.file === name;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected) panel.setAttribute("aria-labelledby", tab.id);
  }
  preview.textContent = project.files[name];
}

function update() {
  const values = Object.fromEntries(new FormData(form));
  const { options, errors } = validate(values);
  status.textContent = "";
  for (const field of ["name", "compiler", "sysroot"]) {
    document.getElementById(`${field}-error`).textContent = errors[field] || "";
    form.elements[field].setAttribute("aria-invalid", String(Boolean(errors[field])));
  }
  const invalid = Object.keys(errors).length > 0;
  document.querySelector("#form-error").textContent = invalid ? "Fix the highlighted fields to preview or download your project." : "";
  copy.disabled = invalid;
  download.disabled = invalid;
  if (invalid) {
    project = null;
    preview.textContent = "Preview paused. Fix the highlighted fields to continue.";
    tabs.replaceChildren();
    panel.removeAttribute("aria-labelledby");
    document.querySelector("#commands").textContent = "";
    document.querySelector("#file-count").textContent = "Invalid settings";
    return;
  }
  project = generate(options);
  tabs.replaceChildren();
  Object.keys(project.files).forEach((name, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.role = "tab";
    tab.id = `file-${index}`;
    tab.dataset.file = name;
    tab.textContent = name;
    tab.setAttribute("aria-controls", "file-panel");
    tab.addEventListener("click", () => showFile(name));
    tabs.append(tab);
  });
  showFile(active in project.files ? active : "main.c");
  document.querySelector("#file-count").textContent = `${Object.keys(project.files).length} files`;
  document.querySelector("#commands").textContent = project.commands;
  document.querySelector("#command-title").textContent = project.cross ? "Build here. Run on your target." : "Build it. Run it.";
  document.querySelector("#run-note").textContent = project.cross
    ? "Do not run an ARM binary directly on an x86 host. Transfer it to a compatible Linux target. See README.md for ABI and execution guidance."
    : "Requires Linux tools (or WSL), not native Windows commands. The README includes prerequisites and exact output.";
  document.querySelector("#system-hint").textContent = options.generator === "make"
    ? "Direct, readable build rules. A great place to start."
    : "Describe your target; CMake creates the build rules.";
}

form.addEventListener("submit", event => event.preventDefault());
form.addEventListener("input", update);
form.addEventListener("change", event => {
  if (event.target.name === "target") {
    const target = form.elements.target.value;
    form.elements.compiler.value = presets[target].compiler;
    document.querySelector("#custom-settings").hidden = target !== "custom";
    document.querySelector("#sysroot-settings").hidden = target === "native";
    if (target === "native") form.elements.sysroot.value = "";
    document.querySelector("#target-note").textContent = target === "native"
      ? "Native: build and run on the same Linux computer."
      : "Cross-build: tools run here; the executable runs on a compatible target Linux OS, not necessarily this computer.";
  }
  update();
});
tabs.addEventListener("keydown", event => {
  const buttons = [...tabs.children];
  const index = buttons.indexOf(document.activeElement);
  let next;
  if (event.key === "ArrowRight") next = (index + 1) % buttons.length;
  if (event.key === "ArrowLeft") next = (index - 1 + buttons.length) % buttons.length;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = buttons.length - 1;
  if (next !== undefined && buttons[next]) {
    event.preventDefault();
    showFile(buttons[next].dataset.file);
    buttons[next].focus();
  }
});
copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(project.files[active]);
    status.textContent = `${active} copied.`;
  } catch {
    status.textContent = "Clipboard access failed. Select the preview text and copy it manually.";
  }
});
download.addEventListener("click", () => {
  const url = URL.createObjectURL(zip(project.files));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${form.elements.name.value}-${form.elements.generator.value}.zip`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  status.textContent = "Download requested. Extract the ZIP and start with README.md.";
});
update();
