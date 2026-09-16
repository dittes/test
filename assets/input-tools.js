/**
 * Small, local input instruments for Test Institute.
 * Each mount owns its listeners and removes them when replaced or page-hidden.
 */

const keyboardRows = [
  ["Escape", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"],
  ["Backquote", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal", "Backspace"],
  ["Tab", "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight", "Backslash"],
  ["CapsLock", "KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Enter"],
  ["ShiftLeft", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash", "ShiftRight"],
  ["ControlLeft", "MetaLeft", "AltLeft", "Space", "AltRight", "ContextMenu", "ControlRight"],
];

const keyNames = {
  Escape: "Esc", Backquote: "`", Backspace: "Backspace", Tab: "Tab", CapsLock: "Caps", Enter: "Enter",
  ShiftLeft: "Shift", ShiftRight: "Shift", ControlLeft: "Ctrl", ControlRight: "Ctrl", MetaLeft: "⌘ / Win",
  AltLeft: "Alt", AltRight: "Alt Gr", ContextMenu: "Menu", Space: "Space", Minus: "-", Equal: "=",
  BracketLeft: "[", BracketRight: "]", Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/",
};

function labelForCode(code) {
  if (keyNames[code]) return keyNames[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^F\d+$/.test(code)) return code;
  return code;
}

function attach(root, listener, type, handler, options) {
  listener.addEventListener(type, handler, options);
  return () => listener.removeEventListener(type, handler, options);
}

function base(root, title, description, body) {
  root.innerHTML = `
    <section class="input-tool" aria-label="${title}">
      ${body}
    </section>`;
}

function mountKeyboard(root, cleanups) {
  const rows = keyboardRows.map((row) => `<div class="key-row">${row.map((code) => {
    const wide = ["Backspace", "Tab", "CapsLock", "Enter", "ShiftLeft", "ShiftRight", "Space"].includes(code);
    return `<span class="key${wide ? " key--wide" : ""}" data-code="${code}" aria-hidden="true">${labelForCode(code)}</span>`;
  }).join("")}</div>`).join("");
  base(root, "Keyboard test", "Activate the pad, then press physical keys. We show the events this browser receives.", `
    <div class="tool-stage keyboard-stage">
      <div class="tool-controls">
        <button type="button" class="button" data-action="activate">Activate key test</button>
        <button type="button" class="button-secondary button-small" data-action="stop">Stop</button>
        <button type="button" class="button-secondary button-small" data-action="reset">Reset</button>
      </div>
      <div class="keyboard-pad" data-keyboard-pad tabindex="0" role="region" aria-label="Keyboard test surface" aria-describedby="keyboard-help">
        <div class="keyboard-grid">${rows}</div>
        <p class="keyboard-pad__prompt">Select “Activate key test”, then use this focused surface. Press Escape to release pressed keys.</p>
      </div>
    </div>
    <div class="measurement-grid" aria-label="Keyboard results">
      <div class="measurement"><span class="measurement__label">Last event</span><strong data-last-event>—</strong></div>
      <div class="measurement"><span class="measurement__label">State</span><strong data-key-state>Ready</strong></div>
      <div class="measurement"><span class="measurement__label">Tested keys</span><strong data-tested-count>0</strong></div>
      <div class="measurement"><span class="measurement__label">Modifiers</span><strong data-modifiers>None</strong></div>
    </div>
    <p id="keyboard-help" class="help-note">This illustrative ANSI layout helps you locate common keys. Key label and code are reported from the event, so a different layout may look different. Tab and system shortcuts are left to your browser; virtual phone keyboards cannot verify physical switches.</p>
    <p class="status" data-status role="status" aria-live="polite">Ready. Activate the test to focus the capture surface.</p>`);

  const pad = root.querySelector("[data-keyboard-pad]");
  const activate = root.querySelector("[data-action=activate]");
  const stop = root.querySelector("[data-action=stop]");
  const reset = root.querySelector("[data-action=reset]");
  const last = root.querySelector("[data-last-event]");
  const state = root.querySelector("[data-key-state]");
  const count = root.querySelector("[data-tested-count]");
  const modifiers = root.querySelector("[data-modifiers]");
  const status = root.querySelector("[data-status]");
  const tested = new Set();
  const pressed = new Set();
  let active = false;

  const paint = () => root.querySelectorAll(".key").forEach((key) => {
    key.classList.toggle("is-pressed", pressed.has(key.dataset.code));
    key.classList.toggle("is-tested", tested.has(key.dataset.code));
  });
  const release = (message = "Ready. Activate the test to focus the capture surface.") => {
    pressed.clear(); paint(); active = false; state.textContent = "Ready"; modifiers.textContent = "None"; status.textContent = message;
  };
  const doReset = () => { tested.clear(); count.textContent = "0"; last.textContent = "—"; release("Cleared. Activate the test to continue."); };
  cleanups.push(attach(root, activate, "click", () => { active = true; pad.focus(); state.textContent = "Listening"; status.textContent = "Listening for keys on the focused test surface."; }));
  cleanups.push(attach(root, stop, "click", () => release("Key test stopped. Press Activate key test to continue.")));
  cleanups.push(attach(root, reset, "click", doReset));
  cleanups.push(attach(root, pad, "keydown", (event) => {
    if (!active || event.key === "Tab") return;
    if (event.key === "Escape") { release("Pressed keys released. The test surface remains available."); return; }
    if (!event.ctrlKey && !event.metaKey && (event.key === " " || event.key.startsWith("Arrow"))) event.preventDefault();
    pressed.add(event.code); tested.add(event.code); paint();
    last.textContent = `${event.key || "Unidentified"} · ${event.code || "no code"}`;
    count.textContent = String(tested.size); state.textContent = event.repeat ? "Key down · repeat" : "Key down";
    modifiers.textContent = [event.shiftKey && "Shift", event.altKey && "Alt", event.ctrlKey && "Ctrl", event.metaKey && "Meta"].filter(Boolean).join(" + ") || "None";
    status.textContent = `${event.repeat ? "Repeated key down" : "Key down"}: ${event.key || "Unidentified"}, ${event.code || "no code"}.`;
  }));
  cleanups.push(attach(root, pad, "keyup", (event) => {
    if (!active || event.key === "Tab") return;
    if (!event.ctrlKey && !event.metaKey && (event.key === " " || event.key.startsWith("Arrow"))) event.preventDefault();
    pressed.delete(event.code); paint(); state.textContent = "Key up";
    modifiers.textContent = [event.shiftKey && "Shift", event.altKey && "Alt", event.ctrlKey && "Ctrl", event.metaKey && "Meta"].filter(Boolean).join(" + ") || "None";
    status.textContent = `Key up: ${event.key || "Unidentified"}, ${event.code || "no code"}.`;
  }));
  cleanups.push(attach(root, pad, "blur", () => release("Focus moved away. Pressed keys were released.")));
}

function mountMouse(root, cleanups) {
  base(root, "Mouse test", "Move, click, scroll, and double-click inside the test area. Nothing is captured outside it.", `
    <div class="tool-stage mouse-stage">
      <div class="tool-controls"><button type="button" class="button-secondary button-small" data-action="reset">Reset counters</button></div>
      <div class="mouse-pad" data-mouse-pad tabindex="0" role="region" aria-label="Mouse test area" aria-describedby="mouse-help">
        <span class="mouse-pad__cross" aria-hidden="true"></span>
        <span class="mouse-pad__dot" data-pointer-dot aria-hidden="true"></span>
        <p>Move and click here</p>
        <span class="mouse-pad__coordinates" data-coordinates>—</span>
      </div>
    </div>
    <div class="measurement-grid" aria-label="Mouse results">
      <div class="measurement"><span class="measurement__label">Move samples</span><strong data-moves>0</strong></div>
      <div class="measurement"><span class="measurement__label">Buttons</span><strong data-buttons>0</strong></div>
      <div class="measurement"><span class="measurement__label">Double-clicks</span><strong data-doubles>0</strong></div>
      <div class="measurement"><span class="measurement__label">Scroll</span><strong data-scroll>—</strong></div>
    </div>
    <p id="mouse-help" class="help-note">The dot marks the last pointer position inside this pad. Button and wheel values come from browser events; this is not a test of tracking accuracy, driver settings, or the whole desktop.</p>
    <p class="status" data-status role="status" aria-live="polite">Click or move inside the test area to begin.</p>`);
  const pad = root.querySelector("[data-mouse-pad]");
  const dot = root.querySelector("[data-pointer-dot]");
  const coordinates = root.querySelector("[data-coordinates]");
  const status = root.querySelector("[data-status]");
  const values = { moves: root.querySelector("[data-moves]"), buttons: root.querySelector("[data-buttons]"), doubles: root.querySelector("[data-doubles]"), scroll: root.querySelector("[data-scroll]") };
  let moves = 0, buttons = 0, doubles = 0;
  const local = (event) => { const rect = pad.getBoundingClientRect(); return { x: Math.round(event.clientX - rect.left), y: Math.round(event.clientY - rect.top) }; };
  cleanups.push(attach(root, pad, "pointermove", (event) => { const p = local(event); moves++; values.moves.textContent = String(moves); coordinates.textContent = `${p.x} × ${p.y}`; dot.style.transform = `translate(${p.x}px, ${p.y}px)`; dot.classList.add("is-visible"); }));
  cleanups.push(attach(root, pad, "pointerdown", (event) => { pad.focus(); buttons++; values.buttons.textContent = String(buttons); status.textContent = `${["Primary", "Auxiliary", "Secondary"][event.button] || "Other"} button received.`; }));
  cleanups.push(attach(root, pad, "dblclick", () => { doubles++; values.doubles.textContent = String(doubles); status.textContent = "Double-click received."; }));
  cleanups.push(attach(root, pad, "wheel", (event) => { const unit = ["px", "lines", "pages"][event.deltaMode] || "units"; const direction = event.deltaY < 0 ? "Up" : event.deltaY > 0 ? "Down" : event.deltaX ? "Horizontal" : "No movement"; values.scroll.textContent = `Δx ${Math.round(event.deltaX)}, Δy ${Math.round(event.deltaY)} ${unit}`; if (document.activeElement === pad) event.preventDefault(); status.textContent = `Wheel ${direction}: Δx ${Math.round(event.deltaX)}, Δy ${Math.round(event.deltaY)} ${unit}.`; }, { passive: false }));
  cleanups.push(attach(root, root.querySelector("[data-action=reset]"), "click", () => { moves = buttons = doubles = 0; values.moves.textContent = values.buttons.textContent = values.doubles.textContent = "0"; values.scroll.textContent = coordinates.textContent = "—"; dot.classList.remove("is-visible"); status.textContent = "Counters cleared."; }));
}

function mountScreen(root, cleanups) {
  const colors = [
    ["White", "#ffffff"], ["Black", "#000000"], ["Red", "#ff0000"], ["Green", "#00ff00"], ["Blue", "#0000ff"], ["Neutral grey", "#808080"],
  ];
  base(root, "Screen check", "Use full solid colours and gradients to inspect your display with your own eyes.", `
    <div class="tool-stage screen-stage" data-screen-stage>
      <div class="screen-pattern" data-pattern aria-label="White display pattern"><span data-pattern-name>White</span></div>
      <div class="tool-controls screen-controls">
        <button type="button" class="button" data-action="next">Next colour</button>
        <button type="button" class="button-secondary button-small" data-action="dark">Dark</button>
        <button type="button" class="button-secondary button-small" data-action="light">Light</button>
        <button type="button" class="button-secondary button-small" data-action="gradient">Gradient</button>
        <button type="button" class="button-secondary button-small" data-action="fullscreen">Full screen</button>
        <button type="button" class="button-secondary button-small" data-action="exit" disabled>Exit full screen</button>
      </div>
    </div>
    <div class="measurement-grid" aria-label="Screen information">
      <div class="measurement"><span class="measurement__label">Viewport</span><strong data-viewport>—</strong></div>
      <div class="measurement"><span class="measurement__label">Pattern</span><strong data-current-pattern>White</strong></div>
      <div class="measurement"><span class="measurement__label">Your observation</span><strong data-observation>Not recorded</strong></div>
    </div>
    <fieldset class="field observation-field"><legend>What do you see?</legend><label><input type="radio" name="screen-observation" value="Looks even"> Looks even</label><label><input type="radio" name="screen-observation" value="I see a mark or uneven area"> I see a mark or uneven area</label><label><input type="radio" name="screen-observation" value="Not sure"> Not sure</label></fieldset>
    <p class="help-note">These are local patterns for visual inspection. They can help you notice a mark, tint, or uneven area, but they cannot automatically detect dead pixels, prove a display fault, or measure refresh rate.</p>
    <p class="status" data-status role="status" aria-live="polite">Choose a pattern and inspect it at a comfortable brightness.</p>`);
  const stage = root.querySelector("[data-screen-stage]");
  const pattern = root.querySelector("[data-pattern]");
  const patternName = root.querySelector("[data-pattern-name]");
  const current = root.querySelector("[data-current-pattern]");
  const viewport = root.querySelector("[data-viewport]");
  const status = root.querySelector("[data-status]");
  const fullscreen = root.querySelector("[data-action=fullscreen]");
  const exit = root.querySelector("[data-action=exit]");
  let index = 0;
  const setViewport = () => { viewport.textContent = `${window.innerWidth} × ${window.innerHeight}`; };
  const setSolid = () => { const [name, value] = colors[index]; pattern.style.background = value; pattern.style.color = name === "Black" ? "#fff" : "#172321"; patternName.textContent = name; current.textContent = name; pattern.setAttribute("aria-label", `${name} display pattern`); status.textContent = `${name} pattern shown. Inspect the screen with your own eyes.`; };
  const setGradient = () => { pattern.style.background = "linear-gradient(135deg, #101212, #f7f7f2 50%, #1759c5)"; pattern.style.color = "#172321"; patternName.textContent = "Gradient"; current.textContent = "Gradient"; pattern.setAttribute("aria-label", "Gradient display pattern"); status.textContent = "Gradient shown. Inspect it with your own eyes."; };
  const setFullScreenUi = () => { const isFull = document.fullscreenElement === stage; fullscreen.hidden = isFull; exit.disabled = !isFull; status.textContent = isFull ? "Full screen active. Use Escape or Exit full screen when finished." : "Full screen ended. Use Full screen to inspect a larger pattern."; };
  setViewport(); setSolid();
  cleanups.push(attach(root, root.querySelector("[data-action=next]"), "click", () => { index = (index + 1) % colors.length; setSolid(); }));
  cleanups.push(attach(root, root.querySelector("[data-action=dark]"), "click", () => { index = 1; setSolid(); }));
  cleanups.push(attach(root, root.querySelector("[data-action=light]"), "click", () => { index = 0; setSolid(); }));
  cleanups.push(attach(root, root.querySelector("[data-action=gradient]"), "click", setGradient));
  cleanups.push(attach(root, fullscreen, "click", async () => { try { await stage.requestFullscreen(); } catch { status.textContent = "Full screen was unavailable. You can still inspect the pattern here."; } }));
  cleanups.push(attach(root, exit, "click", () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => { status.textContent = "Could not exit full screen. Press Escape to return."; }); }));
  cleanups.push(attach(root, document, "fullscreenchange", setFullScreenUi));
  cleanups.push(attach(root, window, "resize", setViewport));
  root.querySelectorAll("input[name=screen-observation]").forEach((input) => cleanups.push(attach(root, input, "change", () => { root.querySelector("[data-observation]").textContent = input.value; status.textContent = `Observation noted: ${input.value}.`; })));
}

export function mountInputTool(root, kind) {
  if (!(root instanceof HTMLElement)) throw new TypeError("mountInputTool needs an HTML element root.");
  if (!["keyboard", "mouse", "screen"].includes(kind)) throw new RangeError(`Unknown input tool: ${kind}`);
  if (typeof root.__inputToolCleanup === "function") root.__inputToolCleanup();
  const cleanups = [];
  const cleanup = () => { while (cleanups.length) cleanups.pop()(); if (document.fullscreenElement && root.contains(document.fullscreenElement)) document.exitFullscreen().catch(() => {}); };
  const pagehide = () => cleanup();
  const pageshow = (event) => { if (event.persisted) { dispose(); mountInputTool(root, kind); } };
  const dispose = () => { cleanup(); window.removeEventListener("pagehide", pagehide); window.removeEventListener("pageshow", pageshow); };
  root.__inputToolCleanup = dispose;
  window.addEventListener("pagehide", pagehide, { once: true });
  window.addEventListener("pageshow", pageshow);
  if (kind === "keyboard") mountKeyboard(root, cleanups);
  else if (kind === "mouse") mountMouse(root, cleanups);
  else if (kind === "screen") mountScreen(root, cleanups);
  return dispose;
}
