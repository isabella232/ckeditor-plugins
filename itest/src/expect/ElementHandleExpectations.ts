import { extendingWaitForExpect } from "./ExpectationsBase";
import { ElementHandle } from "playwright-core";

/**
 * JEST Extension: Add matchers for `ClassicEditorWrapper`.
 */
expect.extend({
  async waitForInnerHtmlToContain(handle: ElementHandle, expected: string): Promise<jest.CustomMatcherResult> {
    // noinspection InnerHTMLJS
    return extendingWaitForExpect(
      "waitForInnerHtmlToContain",
      async () => expect(await handle.innerHTML()).toContain(expected),
      async () => expect(await handle.innerHTML()).not.toContain(expected),
      this
    );
  },
});

/**
 * Extension to matchers for Application Console.
 */
export interface ElementHandleMatchers<R = unknown, T = unknown> {
  waitForInnerHtmlToContain: T extends ElementHandle
    ? (expected: string) => R
    : "Type-level Error: Received value must be an ElementHandle";
}
