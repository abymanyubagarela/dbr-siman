const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const zxing = require("@zxing/library");
const { BrowserMultiFormatReader } = require("@zxing/browser");

// Exercise the real JS decoder with a generated asset QR, without BarcodeDetector.
const code = "E10638D355513F1EE0531561F20A829B";
const matrix = new zxing.QRCodeWriter().encode(code, zxing.BarcodeFormat.QR_CODE, 256, 256, new Map());
const pixels = new Uint8ClampedArray(256 * 256);
for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) pixels[y * 256 + x] = matrix.get(x, y) ? 0 : 255;
const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(new zxing.RGBLuminanceSource(pixels, 256, 256)));
assert.equal(new BrowserMultiFormatReader().decodeBitmap(bitmap).getText(), code);

const source = fs.readFileSync(require.resolve("../components/inventory/CameraBarcodeScanner.tsx"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;

function harness({ pending = false, denied = false, decoderFails = false } = {}) {
  const effects = [], states = [], events = {}, buttons = [], videos = [], detected = [];
  let trackStops = 0, decoderStops = 0, callback, resolveMedia;
  const stream = { getTracks: () => [{ stop: () => trackStops++ }] };
  const controls = { stop: () => decoderStops++ };
  const media = pending ? new Promise(resolve => { resolveMedia = resolve; }) : Promise.resolve(stream);
  const react = {
    useRef: current => ({ current }), useCallback: fn => fn,
    useState: value => { const i = states.push(value) - 1; return [value, next => { states[i] = next; }]; },
    useEffect: fn => effects.push(fn),
  };
  const jsx = (type, props) => {
    if (type === "video") { props.ref.current = { srcObject: null }; videos.push(props); }
    if (type === "button") buttons.push(props);
    return { type, props };
  };
  const doc = { hidden: false, addEventListener: (n, fn) => { events[n] = fn; }, removeEventListener: n => { delete events[n]; } };
  const exports = {};
  const context = {
    exports, Error, navigator: { mediaDevices: { getUserMedia: () => denied ? Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" })) : media } },
    document: doc, // Deliberately no window.BarcodeDetector.
    require: name => {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "@zxing/browser") return { BrowserMultiFormatReader: class {
        async decodeFromStream(_stream, _video, fn) { if (decoderFails) throw new Error("decoder failed"); callback = fn; return controls; }
      } };
      throw new Error(`Unexpected module: ${name}`);
    },
  };
  vm.runInNewContext(compiled, context);
  exports.CameraBarcodeScanner({ onDetected: value => detected.push(value) });
  const cleanups = effects.map(fn => fn()).filter(fn => typeof fn === "function");
  return {
    start: () => buttons[0].onClick(), unmount: () => cleanups.forEach(fn => fn()),
    complete: () => callback({ getText: () => code }, undefined, controls),
    grant: () => resolveMedia(stream), hide: () => { doc.hidden = true; events.visibilitychange(); },
    stats: () => ({ trackStops, decoderStops, detected, states, videos }),
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const live = harness(); live.start(); await tick();
  assert.equal(live.stats().videos[0].playsInline, true);
  assert.equal(live.stats().videos[0].muted, true);
  live.complete();
  assert.deepEqual(live.stats().detected, [code]);
  assert.ok(live.stats().trackStops > 0);
  live.complete(); // Late callback must not submit twice.
  assert.equal(live.stats().detected.length, 1);
  live.unmount();

  const pending = harness({ pending: true }); pending.start(); pending.unmount(); pending.grant(); await tick();
  assert.equal(pending.stats().trackStops, 1);
  assert.equal(pending.stats().detected.length, 0);

  const denied = harness({ denied: true }); denied.start(); await tick();
  assert.ok(denied.stats().states.some(value => typeof value === "string" && value.includes("Izin kamera ditolak")));
  denied.unmount();

  const broken = harness({ decoderFails: true }); broken.start(); await tick();
  assert.equal(broken.stats().trackStops, 1);
  broken.unmount();

  const hidden = harness(); hidden.start(); await tick(); hidden.hide();
  assert.equal(hidden.stats().trackStops, 1);
  assert.ok(hidden.stats().decoderStops > 0);
  hidden.unmount();
  console.log("PASS: real QR decoding without BarcodeDetector; scan success, stale callback, pending unmount, denied permission, decoder failure, background cleanup");
})().catch(error => { console.error(error); process.exitCode = 1; });
