# Volt Playground

Write Volt in the browser: every change is checked against the ESP32 by the
real compiler, built to WebAssembly, with the generated C and state machine
diagrams alongside. No server; shared links carry the program in the URL.

    npm install
    npm run build      # scripts/build-wasm.sh, then the site into dist/
    npm run dev        # after `npm run wasm` once

The build expects the compiler at ../compiler and device descriptors at
../volt/devices.

## License

[GNU AGPL v3](LICENSE). A commercial licence is available: contact pchiro29@gmail.com. Contributions are made under the
[Contributor License Agreement](CLA.md); see [CONTRIBUTING.md](CONTRIBUTING.md).
