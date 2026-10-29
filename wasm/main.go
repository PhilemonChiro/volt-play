//go:build js && wasm

// Command wasm is the Volt compiler for the browser playground. It registers
// window.volt with functions that take a program's source and return JSON:
//
//	volt.check(src)     diagnostics, pins, devices, tasks, machines
//	volt.compile(src)   the same plus the generated C
//	volt.format(src)    {"code": formatted} or {"error": message}
//	volt.states(src)    Mermaid state diagrams, one per machine
//	volt.sequence(src)  a Mermaid sequence diagram
//
// Device descriptors are embedded (scripts/build.sh copies them in), since a
// browser has no file system to read them from.
package main

import (
	"embed"
	"encoding/json"
	"io/fs"
	"syscall/js"

	"github.com/PhilemonChiro/volt-compiler"
	"github.com/PhilemonChiro/volt-compiler/ide"
)

//go:embed devices
var devices embed.FS

// The playground edits one file; diagnostics name it.
const filename = "main.volt"

func main() {
	sub, _ := fs.Sub(devices, "devices")
	compiler.DevicesFS = sub

	api := js.Global().Get("Object").New()
	api.Set("check", fn(func(src string) any { return must(ide.Check(src, filename)) }))
	api.Set("compile", fn(func(src string) any { return must(ide.CompileFull(src, filename, nil)) }))
	api.Set("format", fn(func(src string) any {
		code, err := ide.FormatCode(src)
		if err != nil {
			return map[string]string{"error": err.Error()}
		}
		return map[string]string{"code": code}
	}))
	api.Set("states", fn(func(src string) any { return ide.StateDiagram(src) }))
	api.Set("sequence", fn(func(src string) any { return ide.SequenceDiagram(src) }))
	js.Global().Set("volt", api)

	// Keep the Go runtime alive for calls from JavaScript.
	select {}
}

// fn wraps f as a JavaScript function of one string that returns JSON text.
// A panic in the compiler comes back as {"error": ...} instead of killing the
// runtime, so one bad program doesn't break the page.
func fn(f func(string) any) js.Func {
	return js.FuncOf(func(_ js.Value, args []js.Value) (out any) {
		defer func() {
			if r := recover(); r != nil {
				b, _ := json.Marshal(map[string]any{"error": "compiler crashed", "detail": r})
				out = string(b)
			}
		}()
		src := ""
		if len(args) > 0 {
			src = args[0].String()
		}
		b, err := json.Marshal(f(src))
		if err != nil {
			b, _ = json.Marshal(map[string]string{"error": err.Error()})
		}
		return string(b)
	})
}

func must[T any](v T, err error) any {
	if err != nil {
		return map[string]string{"error": err.Error()}
	}
	return v
}
