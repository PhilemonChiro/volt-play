// Loads the Volt compiler (public/volt.wasm, built by scripts/build-wasm.sh)
// and exposes its functions with types. Each call runs synchronously and
// returns in a few milliseconds.

export type Diagnostic = {
  line: number;
  col: number;
  end_line?: number;
  end_col?: number;
  message: string;
  severity: 'error' | 'warning' | string;
  hint: string;
  code?: string;
};

export type Compiled = {
  diagnostics: Diagnostic[] | null;
  c_code: string;
  chip: string;
  error?: string;
};

export type States = { machines: { name: string; mermaid: string }[] | null; error?: string };

type Api = Record<'compile' | 'format' | 'states', (src: string) => string>;

declare global {
  interface Window {
    Go: new () => { importObject: WebAssembly.Imports; run(i: WebAssembly.Instance): Promise<void> };
    volt: Api;
  }
}

async function loadScript(src: string) {
  await new Promise<void>((ok, fail) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => ok();
    s.onerror = () => fail(new Error(`couldn't load ${src}`));
    document.head.append(s);
  });
}

export async function loadCompiler() {
  await loadScript('/wasm_exec.js');
  const go = new window.Go();
  const { instance } = await WebAssembly.instantiateStreaming(fetch('/volt.wasm'), go.importObject);
  go.run(instance);
  const call = <T>(op: keyof Api, src: string) => JSON.parse(window.volt[op](src)) as T;
  return {
    compile: (src: string) => call<Compiled>('compile', src),
    format: (src: string) => call<{ code?: string; error?: string }>('format', src),
    states: (src: string) => call<States>('states', src),
  };
}
