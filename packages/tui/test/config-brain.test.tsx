/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { Schema } from "effect"
import { Info, resolve } from "../src/config"

const decodeInfo = Schema.decodeUnknownSync(Info)
const options = { terminalSuspend: true }

test("decodes BrainTentacle approval modes and hidden codes", () => {
  expect(decodeInfo({ brain: { approval: "auto", snippets: { "??": "explain this code" } } })).toMatchObject({
    brain: { approval: "auto", snippets: { "??": "explain this code" } },
  })
  expect(() => decodeInfo({ brain: { approval: "yolo" } })).toThrow()
  expect(decodeInfo({ brain: { approval: "inherit" } })).toMatchObject({ brain: { approval: "inherit" } })
  expect(() => decodeInfo({ brain: { snippets: { rr: 1 } } })).toThrow()
})

test("resolves BrainTentacle defaults", () => {
  expect(resolve({}, options).brain).toEqual({ approval: "inherit", snippets: {}, theme_sync: true })
})

test("resolves BrainTentacle overrides", () => {
  expect(
    resolve({ brain: { approval: "auto", snippets: { rr: "review the diff" }, theme_sync: false } }, options).brain,
  ).toEqual({ approval: "auto", snippets: { rr: "review the diff" }, theme_sync: false })
})
