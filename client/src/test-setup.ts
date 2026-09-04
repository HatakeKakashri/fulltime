import { Window } from "happy-dom";

// Set up global DOM environment before any tests run
const window = new Window();
(globalThis as Record<string, unknown>)["document"] = window.document;
(globalThis as Record<string, unknown>)["navigator"] = window.navigator;
(globalThis as Record<string, unknown>)["window"] = window;
