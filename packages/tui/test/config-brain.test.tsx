/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { Schema } from "effect"
import { Info, resolve } from "../src/config"

const decodeInfo = Schema.decodeUnknownSync(Info)
const options = { terminalSuspend: true }

test("decodes BrainTentacle approval modes and hidden codes", () => {
  expect(decodeInfo({ brain: { approval: "auto", hidden_codes: { "??": "explain this code" } } })).toMatchObject({
    brain: { approval: "auto", hidden_codes: { "??": "explain this code" } },
  })
  expect(() => decodeInfo({ brain: { approval: "yolo" } })).toThrow()
  expect(() => decodeInfo({ brain: { hidden_codes: { rr: 1 } } })).toThrow()
})

test("resolves BrainTentacle defaults", () => {
  expect(resolve({}, options).brain).toEqual({ approval: "ask", hidden_codes: {}, theme_sync: true })
})

test("resolves BrainTentacle overrides", () => {
  expect(
    resolve({ brain: { approval: "auto", hidden_codes: { rr: "review the diff" }, theme_sync: false } }, options).brain,
  ).toEqual({ approval: "auto", hidden_codes: { rr: "review the diff" }, theme_sync: false })
})
