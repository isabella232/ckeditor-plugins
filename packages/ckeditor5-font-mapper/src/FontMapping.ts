import { htmlEncodingMap } from "./HtmlEncodingMap";
import LoggerProvider from "@coremedia/ckeditor5-logging/logging/LoggerProvider";

/**
 * A mapping table for a certain font.
 * This table maps a decimal code point value to a replacement string.
 */
export type FontMap = Map<number, string>;

/**
 * The mode for appending a FontMapping.
 * New mappings will always be created with {@link htmlEncodingMap} as a base.
 * Existing mappings can be overridden by using the `"replace"` `mode`.
 * `"append"` is the default if no other `mode` is set.
 */
export type Mode = "replace" | "append";

/**
 * A FontMapping defines a strategy on how to map characters of a given
 * font-family to their alternative representation.
 *
 * A FontMapping must be provided with a corresponding map that defines
 * the representation mapping for the font's characters.
 * Please note, that a given map will always be extended with an
 * {@link htmlEncodingMap}, a minimum replacement map for custom mappings.
 *
 */
export class FontMapping {
  static readonly #logger = LoggerProvider.getLogger("FontMapper");
  #map: FontMap;
  #DECODE_ELEMENT_HELP = document.createElement("textarea");

  constructor(map: FontMap) {
    this.#map = FontMapping.#mergeFontMaps(htmlEncodingMap, map);
  }

  /**
   * Alters the FontMap of this FontMapping.
   * This method is especially used to change the "Symbol" FontMapping after
   * it has been registered with its default map. The custom configuration of
   * this plugin might then change this map or replace it entirely.
   *
   * If a config is applied to a FontMapping with "replace" `mode`,
   * a new map, based on the {@link htmlEncodingMap} will be created.
   * {@link htmlEncodingMap} is a minimum replacement map for custom mapping.
   * As we decode the HTML prior to replacement we need to ensure, that the
   * encoded characters are restored.
   *
   * @param map - the custom map to alter the existing FontMap
   * @param mode - the apply mode (only "replace" is taken into account)
   */
  applyMapConfig(map: FontMap, mode: Mode = "append"): void {
    if (mode === "replace") {
      this.#map = FontMapping.#mergeFontMaps(htmlEncodingMap, map);
    } else {
      this.#map = FontMapping.#mergeFontMaps(this.#map, map);
    }
  }

  /**
   * Merges two FontMaps into one.
   * The first FontMap `baseFontMap` serves as the base for the output map.
   * The contents of the second FontMap `additionalMap` will be added
   * afterwards and override duplicate entries.
   *
   * @param baseFontMap - the base fontMap
   * @param additionalMap - the additional mapping to apply to the fontMapping's map
   * @returns the merge result as a new map
   */
  static #mergeFontMaps(baseFontMap: FontMap, additionalMap: FontMap): FontMap {
    return new Map([...baseFontMap.entries(), ...additionalMap.entries()]);
  }

  /**
   * Maps a character or a string to their corresponding entity.
   *
   * @param input - a character or a string to be mapped to their corresponding entity
   * @returns the corresponding entity
   */
  toReplacementCharacter(input: string): string {
    FontMapping.#logger.debug(`Replace characters in "${input}"`);
    const decodedInput: string | null = this.#decodeHtmlEntities(input);
    FontMapping.#logger.debug(`Decoded html characters before replacing. New string to process: ${decodedInput}`);

    const characters: string[] = [...decodedInput];
    const replacedInput: (string | null)[] = characters.map((value) => {
      const charCode = value.charCodeAt(0);
      const htmlEntity = this.#map.get(charCode);
      if (htmlEntity) {
        FontMapping.#logger.debug(`Found a replacement for "${value}": ${htmlEntity}`);
        return this.#decodeHtmlEntities(htmlEntity);
      }
      FontMapping.#logger.debug(`Did not find a replacement for "${value}", returning old character`);
      return String.fromCharCode(charCode);
    });
    return replacedInput.join();
  }

  /**
   * Decodes all HTML entities of the content of a text node.
   *
   * Some characters like ", ' and non-breakable-space will be encoded when Word places the HTML
   * into the clipboard. Thus to prevent for example &nbsp; to be transformed to &&nu;&beta;&sigma;&pi;; we
   * need to first decode the HTML.
   *
   * @param inputString - text node content
   * @see {@link https://stackoverflow.com/questions/5796718/html-entity-decode| javascript - HTML Entity Decode - Stack Overflow}
   * @returns the decoded string
   */
  #decodeHtmlEntities(inputString: string): string {
    //This is mentioned by CodeQL as security vulnerability but using a textarea element it can't be misused.
    //Therefore, the vulnerability is ignored.
    this.#DECODE_ELEMENT_HELP.innerHTML = inputString;
    const textContent = this.#DECODE_ELEMENT_HELP.value;
    if (!textContent) {
      // see https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent
      throw new Error("Error during decodeHtmlEntities: HTMLDivElement has no textContent");
    }
    return textContent;
  }

  toString(): string {
    return `[FontMapping; ${this.#map.size} entries]`;
  }
}
