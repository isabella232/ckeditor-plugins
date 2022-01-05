import "jest-xml-matcher";
import { Strictness } from "../src/RichTextSchema";
import HtmlFilter from "@coremedia/ckeditor5-dataprocessor-support/HtmlFilter";
import Editor from "@ckeditor/ckeditor5-core/src/editor/editor";
import { getConfig } from "../src/CoreMediaRichTextConfig";
import { NamedTestCase, SkippableTestCase, testData } from "./DataDrivenTests";
import { flatten } from "./Utils";

jest.mock("@ckeditor/ckeditor5-core/src/editor/editor");

/**
 * Will be checked for "startsWith" for a given Data Driven Testname. Meant
 * to be used for debugging purpose. Example:
 *
 * `TEST_SELECTOR = "TABLE#3"`
 */
const TEST_SELECTOR = "";

const MOCK_EDITOR = new Editor();

const LAST_RESORT =
  "This is a last-resort fix, prior to sending data to the " +
  "server. It's actually almost an indicator of missing explicit data " +
  "processing. That's why `toView` will not be able to restore the original " +
  "result.";

type StrictnessAwareTestData = {
  /**
   * To which strictness modes the test applies to.
   */
  strictness: Strictness[];
};

type XmlInputTestData = {
  /**
   * Input. This is actually HTML, but already embedded in CoreMedia RichText
   * DIV, as this is the pre-processing done by RichTextDataProcessor.
   */
  inputFromView: string;
};

type ExpectTransformationTestData = {
  /**
   * Expected result of mapping input to data.
   */
  expectedData: string;
  /**
   * <p>
   * Optional: Expected result of mapping generated data back to view.
   * This still contains the RichText Namespace DIV, as this will be
   * removed later in processing.
   * </p>
   * <p>
   * If just "true", it will expect the same result as original input.
   * </p>
   */
  expectedView?: string | boolean;
};

const parser = new DOMParser();
const serializer = new XMLSerializer();
const strictnessKeys = Object.keys(Strictness).filter((x) => !(parseInt(x) >= 0));
const whitespace = " \t\n";
const text = `Lorem${whitespace}Ipsum`;
const attr_class = "alpha";
// noinspection HttpUrlsUsage
const ns_richtext = "http://www.coremedia.com/2003/richtext-1.0";
const ns_xhtml = "http://www.w3.org/1999/xhtml";
// noinspection HttpUrlsUsage
const ns_xdiff = "http://www.coremedia.com/2015/xdiff";

describe("Default Data Filter Rules", () => {
  type DataFilterRulesTestData = NamedTestCase &
    SkippableTestCase &
    StrictnessAwareTestData &
    XmlInputTestData &
    ExpectTransformationTestData;

  const tableFixtures: DataFilterRulesTestData[] = [
    {
      name: "TABLE#01: Empty table should be removed, as it is invalid.",
      comment: `${LAST_RESORT}`,
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table/></div>`,
      expectedData: `<div xmlns="${ns_richtext}"/>`,
    },
    {
      name: "TABLE#02: tbody should be added if missing.",
      comment:
        "This is a design decision which eases data-processing implementation. If this is unexpected, it may be changed.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><tr><td>${text}</td></tr></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody><tr><td>${text}</td></tr></tbody></table></div>`,
      expectedView: `<div xmlns="${ns_richtext}"><table><tbody><tr><td>${text}</td></tr></tbody></table></div>`,
    },
    {
      name: "TABLE#03: thead should be transformed as being part of tbody.",
      comment:
        "ckeditor/ckeditor5#9360: We must try at best effort to keep information about rows which are meant to be part of thead.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><thead><tr><th>Head</th></tr></thead></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody><tr class="tr--header"><td class="td--header">Head</td></tr></tbody></table></div>`,
      expectedView: true,
    },
    {
      name: "TABLE#04: tbody should be kept as is.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><tbody><tr><td>Body</td></tr></tbody></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody><tr><td>Body</td></tr></tbody></table></div>`,
      expectedView: true,
    },
    {
      name: "TABLE#05: thead should merge into tbody",
      comment:
        "One contract is, that thead merges into existing tbody, so that e.g. class attributes at tbody are kept.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><thead><tr><td>Head</td></tr></thead><tbody class="${attr_class}"><tr><td>Body</td></tr></tbody></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody class="${attr_class}"><tr class="tr--header"><td>Head</td></tr><tr><td>Body</td></tr></tbody></table></div>`,
      expectedView: true,
    },
    {
      name: "TABLE#06: th should be transformed to td with class.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><tbody><tr><th>Head</th></tr></tbody></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody><tr><td class="td--header">Head</td></tr></tbody></table></div>`,
      expectedView: true,
    },
    {
      name: "TABLE#07: Should remove figure around table. By default CKEditor 5 adds a figure around table.",
      comment: `${LAST_RESORT}`,
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><figure><table><tbody><tr><td>Body</td></tr></tbody></table></figure></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody><tr><td>Body</td></tr></tbody></table></div>`,
    },
    {
      name: "TABLE#08: Should remove empty tbody, and thus empty table.",
      comment: `${LAST_RESORT}`,
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><tbody/></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"/>`,
    },
    {
      name: "TABLE#09: Should remove empty tr, and thus empty tbody, and thus empty table.",
      comment: `${LAST_RESORT}`,
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><tbody><tr/></tbody></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"/>`,
    },
    {
      name: "TABLE#10: Should keep empty td.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><tbody><tr><td/></tr></tbody></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody><tr><td/></tr></tbody></table></div>`,
      expectedView: true,
    },
    {
      name: "TABLE#11: Should keep td with several children.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><tbody><tr><td><p>${text}</p><p>${text}</p></td></tr></tbody></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody><tr><td><p>${text}</p><p>${text}</p></td></tr></tbody></table></div>`,
      expectedView: true,
    },
    {
      name: "TABLE#12: Should remove singleton br in td.",
      comment: "This is the behavior of CoreMedia RichText with CKEditor 4.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><tbody><tr><td><br/></td></tr></tbody></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody><tr><td/></tr></tbody></table></div>`,
      expectedView: `<div xmlns="${ns_richtext}"><table><tbody><tr><td/></tr></tbody></table></div>`,
    },
    {
      name: "TABLE#13: Should remove singleton p in td.",
      comment: "This is the behavior of CoreMedia RichText with CKEditor 4.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><tbody><tr><td><p/></td></tr></tbody></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody><tr><td/></tr></tbody></table></div>`,
    },
    {
      name: "TABLE#14: Should remove singleton p in td if it only contains br.",
      comment: "This is the behavior of CoreMedia RichText with CKEditor 4.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><tbody><tr><td><p><br/></p></td></tr></tbody></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody><tr><td/></tr></tbody></table></div>`,
    },
    {
      name: "TABLE#15: Should not remove singleton p in td if it contains text.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><tbody><tr><td><p>${text}</p></td></tr></tbody></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody><tr><td><p>${text}</p></td></tr></tbody></table></div>`,
      expectedView: true,
    },
    {
      name: "TABLE#16: th should be transformed to td with class and continue with normal tds.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><tbody><tr><th>Head</th></tr><tr><td>Data</td></tr></tbody></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody><tr><td class="td--header">Head</td></tr><tr><td>Data</td></tr></tbody></table></div>`,
      expectedView: true,
    },
    {
      name: "TABLE#17: tfoot should be transformed and merged to tbody.",
      comment: "tfoot in CKEditor 5 24.x is not supported in view and will be merged to tbody.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><tfoot><tr><th>Foot</th></tr></tfoot></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody><tr class="tr--footer"><td class="td--header">Foot</td></tr></tbody></table></div>`,
      expectedView: true,
    },
    {
      name: "TABLE#18: Multiple tbodies should be merged into first.",
      comment:
        "HTML may provide multiple tbodies, CoreMedia RichText may only have one. Design decision: Only keep attributes of first tbody.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><tbody class="body1"><tr><td>Body 1</td></tr></tbody><tbody class="body2"><tr><td>Body 2</td></tr></tbody></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody class="body1"><tr><td>Body 1</td></tr><tr><td>Body 2</td></tr></tbody></table></div>`,
      expectedView: `<div xmlns="${ns_richtext}"><table><tbody class="body1"><tr><td>Body 1</td></tr><tr><td>Body 2</td></tr></tbody></table></div>`,
    },
  ];
  const listFixtures: DataFilterRulesTestData[] = flatten(
    ["ul", "ol"].map((el): DataFilterRulesTestData[] => {
      const key = el.toUpperCase();
      return [
        {
          name: `${key}#1: Should remove if empty, as empty <${el}> not allowed by DTD.`,
          comment: `${LAST_RESORT}`,
          strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
          inputFromView: `<div xmlns="${ns_richtext}"><${el}>${whitespace}</${el}></div>`,
          expectedData: `<div xmlns="${ns_richtext}"/>`,
        },
        {
          name: `${key}#2: Should keep if valid.`,
          strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
          inputFromView: `<div xmlns="${ns_richtext}"><${el}><li>${text}</li></${el}></div>`,
          expectedData: `<div xmlns="${ns_richtext}"><${el}><li>${text}</li></${el}></div>`,
          expectedView: true,
        },
        {
          name: `${key}#3: Should keep class attribute.`,
          strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
          inputFromView: `<div xmlns="${ns_richtext}"><${el} class="${attr_class}"><li>${text}</li></${el}></div>`,
          expectedData: `<div xmlns="${ns_richtext}"><${el} class="${attr_class}"><li>${text}</li></${el}></div>`,
          expectedView: true,
        },
      ];
    })
  );

  const headingFixtures: DataFilterRulesTestData[] = flatten(
    [1, 2, 3, 4, 5, 6].map((level): DataFilterRulesTestData[] => {
      const el = `h${level}`;
      const key = el.toUpperCase();
      const expectedClass = `p--heading-${level}`;

      return [
        {
          name: `${key}#1: Should transform to empty <p> if empty.`,
          strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
          inputFromView: `<div xmlns="${ns_richtext}"><${el}/></div>`,
          expectedData: `<div xmlns="${ns_richtext}"><p class="${expectedClass}"/></div>`,
          expectedView: true,
        },
        {
          name: `${key}#2: Should transform to <p> with class attribute.`,
          strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
          inputFromView: `<div xmlns="${ns_richtext}"><${el}>${text}</${el}></div>`,
          expectedData: `<div xmlns="${ns_richtext}"><p class="${expectedClass}">${text}</p></div>`,
          expectedView: true,
        },
      ];
    })
  );

  const invalidHeadingFixtures: DataFilterRulesTestData[] = flatten(
    [0, 7, 10].map((level): DataFilterRulesTestData[] => {
      const key = `INVALID_H${level}`;
      const invalidHeadingClass = `p--heading-${level}`;

      return [
        {
          name: `${key}#1: Should not handle invalid heading class.`,
          strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
          inputFromView: `<div xmlns="${ns_richtext}"><p class="${invalidHeadingClass}">${text}</p></div>`,
          expectedData: `<div xmlns="${ns_richtext}"><p class="${invalidHeadingClass}">${text}</p></div>`,
          expectedView: true,
        },
      ];
    })
  );

  const defaultBlockFixtures: DataFilterRulesTestData[] = flatten(
    ["p", "pre", "blockquote"].map((el): DataFilterRulesTestData[] => {
      const key = el.toUpperCase();
      return [
        {
          name: `${key}#1: Should keep if empty.`,
          strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
          inputFromView: `<div xmlns="${ns_richtext}"><${el}/></div>`,
          expectedData: `<div xmlns="${ns_richtext}"><${el}/></div>`,
          expectedView: true,
        },
        {
          name: `${key}#2: Should adapt namespace if required.`,
          strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
          inputFromView: `<div xmlns="${ns_richtext}"><${el} xmlns="${ns_xhtml}"/></div>`,
          expectedData: `<div xmlns="${ns_richtext}"><${el}/></div>`,
        },
        {
          name: `${key}#3: Should keep class attribute.`,
          strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
          inputFromView: `<div xmlns="${ns_richtext}"><${el} class="${attr_class}"/></div>`,
          expectedData: `<div xmlns="${ns_richtext}"><${el} class="${attr_class}"/></div>`,
          expectedView: true,
        },
      ];
    })
  );

  const replaceInlineSimpleFixtures: DataFilterRulesTestData[] = flatten(
    [
      {
        view: "b",
        data: "strong",
        bijective: false,
      },
      {
        view: "i",
        data: "em",
        bijective: true,
      },
    ].map(({ view, data, bijective }): DataFilterRulesTestData[] => {
      const key = view.toUpperCase();
      return [
        {
          name: `${key}#1: View: <${view}> ${bijective ? "<" : ""}-> Data: <${data}>.`,
          strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
          inputFromView: `<div xmlns="${ns_richtext}"><p><${view}>${text}</${view}></p></div>`,
          expectedData: `<div xmlns="${ns_richtext}"><p><${data}>${text}</${data}></p></div>`,
          expectedView: bijective,
        },
        {
          name: `${key}#2: Should keep <${data}> when transformed.`,
          strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
          inputFromView: `<div xmlns="${ns_richtext}"><p><${data}>${text}</${data}></p></div>`,
          expectedData: `<div xmlns="${ns_richtext}"><p><${data}>${text}</${data}></p></div>`,
        },
      ];
    })
  );

  const replaceInlineBySpanFixtures: DataFilterRulesTestData[] = flatten(
    [
      {
        view: "u",
        dataClass: "underline",
        bijective: true,
      },
      {
        view: "strike",
        dataClass: "strike",
        bijective: false,
      },
      {
        view: "s",
        dataClass: "strike",
        bijective: true,
      },
      {
        view: "del",
        dataClass: "strike",
        bijective: false,
      },
    ].map(({ view, dataClass, bijective }): DataFilterRulesTestData[] => {
      // bijective: Typically false for "alias" mappings.
      // The mapping, which corresponds to the default representation in
      // CKEditor should be bijective (i.e. = true).
      const key = view.toUpperCase();
      return [
        {
          name: `${key}#1: View: <${view}> ${bijective ? "<" : ""}-> Data: by <span class="${dataClass}">.`,
          strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
          inputFromView: `<div xmlns="${ns_richtext}"><p><${view}>${text}</${view}></p></div>`,
          expectedData: `<div xmlns="${ns_richtext}"><p><span class="${dataClass}">${text}</span></p></div>`,
          expectedView: bijective,
        },
        {
          name: `${key}#2: Should keep <span class="${dataClass}"> when transformed.`,
          strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
          inputFromView: `<div xmlns="${ns_richtext}"><p><span class="${dataClass}">${text}</span></p></div>`,
          expectedData: `<div xmlns="${ns_richtext}"><p><span class="${dataClass}">${text}</span></p></div>`,
        },
      ];
    })
  );
  /*
   * In CKEditor 4 data-processing we did some clean-up of elements. While this
   * was most likely dealing with shortcomings of CKEditor 4, we want to ensure
   * (for now) that the clean-up mechanisms still work, at least to provide
   * compatibility with existing richtext data.
   *
   * Later, it may become a configuration option to keep this legacy behavior.
   */
  const cleanupFixtures: DataFilterRulesTestData[] = [
    {
      name: "CLEANUP#1: Remove top-level <br> tag.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><br/></div>`,
      expectedData: `<div xmlns="${ns_richtext}"/>`,
    },
    {
      name: "CLEANUP#2: Remove trailing <br> tag in <td>.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><tbody><tr><td>${text}<br/></td></tr></tbody></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody><tr><td>${text}</td></tr></tbody></table></div>`,
    },
    {
      name: "CLEANUP#3: Remove trailing <br> tag in <p>.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><p>${text}<br/></p></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><p>${text}</p></div>`,
    },
    {
      name: "CLEANUP#4: Remove singleton <br> in <td>",
      comment: "This is a CKEditor 4 CoreMedia RichText Behavior.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><tbody><tr><td><br/></td></tr></tbody></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody><tr><td/></tr></tbody></table></div>`,
    },
    {
      name: "CLEANUP#5: Remove singleton <p> in <td>",
      comment: "This is a CKEditor 4 CoreMedia RichText Behavior.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><tbody><tr><td><p/></td></tr></tbody></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody><tr><td/></tr></tbody></table></div>`,
    },
    {
      name: "CLEANUP#6: Remove singleton <p> only containing <br> in <td>",
      comment: "This is a CKEditor 4 CoreMedia RichText Behavior.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><table><tbody><tr><td><p><br/></p></td></tr></tbody></table></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><table><tbody><tr><td/></tr></tbody></table></div>`,
    },
    {
      name: "CLEANUP#7: Don't remove possibly irrelevant <span>.",
      comment:
        "While around 2011 we decided to delete irrelevant spans, there is no reason with regards to RichText DTD. And clean-up will make things more complicate. Thus, decided in 2021 to keep it.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}"><p><span>${text}</span></p></div>`,
      expectedData: `<div xmlns="${ns_richtext}"><p><span>${text}</span></p></div>`,
    },
  ];

  /*
   * The <xdiff:span> element (xmlns:xdiff="http://www.coremedia.com/2015/xdiff")
   * must not make it to the server. There may be scenarios (for example
   * copy & paste), where these elements become part of the richtext to store
   * on the server.
   *
   * Note, that the namespace declaration will not make it onto the server, but
   * needs to be added for testing purpose only, as there is no "namespace
   * cleanup feature".
   */
  // noinspection XmlUnusedNamespaceDeclaration
  const xdiffFixtures: DataFilterRulesTestData[] = [
    {
      name: "XDIFF#1: Should remove invalid <xdiff:span> tag, but keep children.",
      strictness: [Strictness.STRICT, Strictness.LOOSE, Strictness.LEGACY],
      inputFromView: `<div xmlns="${ns_richtext}" xmlns:xdiff="${ns_xdiff}"><p><xdiff:span xdiff:class="diff-html-removed">${text}</xdiff:span></p></div>`,
      expectedData: `<div xmlns="${ns_richtext}" xmlns:xdiff="${ns_xdiff}"><p>${text}</p></div>`,
    },
  ];

  const testFixtures: DataFilterRulesTestData[] = [
    ...tableFixtures,
    ...listFixtures,
    ...headingFixtures,
    ...invalidHeadingFixtures,
    ...defaultBlockFixtures,
    ...replaceInlineSimpleFixtures,
    ...replaceInlineBySpanFixtures,
    ...cleanupFixtures,
    ...xdiffFixtures,
  ].sort((a, b) => {
    const nameA = a.name;
    const nameB = b.name;
    if (nameA < nameB) {
      return -1;
    }
    if (nameA > nameB) {
      return 1;
    }
    return 0;
  });

  describe.each<[string, DataFilterRulesTestData]>(testData(testFixtures))(
    "(%#) %s",
    (name: string, testData: DataFilterRulesTestData) => {
      const { skip, strictness, inputFromView, expectedData, expectedView } = testData;

      if (TEST_SELECTOR && !name.startsWith(TEST_SELECTOR)) {
        test.todo(`${name} (disabled by test selector for debugging purpose)`);
        return;
      }

      for (const currentStrictness of strictness) {
        const { toData, toView } = getConfig();
        const toDataFilter = new HtmlFilter(toData, MOCK_EDITOR);
        const toViewFilter = new HtmlFilter(toView, MOCK_EDITOR);

        const testCaseName = `${name} (mode: ${strictnessKeys[currentStrictness]})`;
        const toDataTestCase = () => {
          const xmlDocument: Document = parser.parseFromString(inputFromView, "text/xml");

          if (xmlDocument.documentElement.outerHTML.indexOf("parsererror") >= 0) {
            throw new Error(`Failed parsing XML: ${inputFromView}: ${xmlDocument.documentElement.outerHTML}`);
          }

          toDataFilter.applyTo(xmlDocument.documentElement);
          const actualXml = serializer.serializeToString(xmlDocument.documentElement);
          expect(actualXml).toEqualXML(expectedData);
        };

        const toViewTestCase = () => {
          if (!!expectedView) {
            // If `true` expect bijective mapping.
            const expectedViewXml = expectedView === true ? inputFromView : expectedView;
            const xmlDocument: Document = parser.parseFromString(expectedData, "text/xml");

            if (xmlDocument.documentElement.outerHTML.indexOf("parsererror") >= 0) {
              throw new Error(`Failed parsing XML: ${expectedData}: ${xmlDocument.documentElement.outerHTML}`);
            }

            toViewFilter.applyTo(xmlDocument.documentElement);
            // Note, that in RichTextDataProcessor we serialize via CKEditor's
            // BasicHtmlWriter, which provides subtle differences, which again
            // cause CoreMedia/ckeditor-plugins#40.
            const actualXml = serializer.serializeToString(xmlDocument.documentElement);
            expect(actualXml).toEqualXML(expectedViewXml);
          }
        };

        if (skip) {
          const disabledMessage = typeof skip === "string" ? ` (${skip})` : "";
          const disabledName = `${testCaseName}${disabledMessage}`;
          test.skip(`toData: ${disabledName}`, toDataTestCase);
          !!expectedView && test.skip(`toView: ${disabledName}`, toViewTestCase);
        } else {
          test(`toData: ${testCaseName}`, toDataTestCase);
          !!expectedView && test(`toView: ${testCaseName}`, toViewTestCase);
        }
      }
    }
  );
});
