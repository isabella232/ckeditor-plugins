import MutableElement, { ElementFilterRule } from "./MutableElement";
import Logger from "@coremedia/coremedia-utils/logging/Logger";
import LoggerProvider from "@coremedia/coremedia-utils/logging/LoggerProvider";

export type TextFilterFunctionResult = Text | string | boolean | void;
export type TextFilterFunction = (text: string | null, textNode: Text) => TextFilterFunctionResult;

export interface FilterRuleSet {
  elements?: { [key: string]: ElementFilterRule };
  text?: TextFilterFunction;
}

export const BEFORE_ELEMENT = "^";
export const AFTER_ELEMENT = "$";
export const AFTER_ELEMENT_AND_CHILDREN = "$$";

/**
 * <p>
 * This filter implements a similar behavior as the HTML filter introduced
 * with CKEditor 4.
 * </p>
 * <p><strong>Findings on CKEditor 4 Filtering</strong></p>
 * <p>
 * <strong>Element, then Children:</strong> Filtering is done in that way, that
 * first the element itself is processed. Afterwards, its children. This means,
 * that for example an element cannot determine if it is empty, when subsequent
 * filtering may remove child elements.
 * </p>
 * <p>
 * <strong>$-Rule after Children:</strong> Only the $ rule is applied last to
 * an element, i.e. it is ensured, that all children were processed. This is
 * the only valid location to judge on empty/non-empty.
 * </p>
 *
 * @see <a href="https://ckeditor.com/docs/ckeditor4/latest/api/CKEDITOR_htmlParser_filter.html">Class Filter (CKEDITOR.htmlParser.filter) - CKEditor 4 API docs</a>
 * @see <a href="https://ckeditor.com/docs/ckeditor4/latest/api/CKEDITOR_htmlParser_node.html">Class Node (CKEDITOR.htmlParser.node) - CKEditor 4 API docs</a>
 */
export default class HtmlFilter {
  private readonly logger: Logger = LoggerProvider.getLogger("HtmlFilter");

  private readonly ruleSet: FilterRuleSet;

  constructor(ruleSet: FilterRuleSet) {
    this.ruleSet = ruleSet;
  }

  public applyTo(root: Node): void {
    this.logger.debug(`Applying filter to root node ${root.nodeName}.`, { root: root });
    // TODO[cke] Provide a root-filter just as CKEditor 4?
    //   If yes, this must not replace the root node, or we need to pass
    //   the new root back.
    this.applyToChildNodes(root);
  }

  private applyToChildNodes(parent: Node): void {
    this.logger.debug(`Applying filter to child nodes of ${parent.nodeName}.`, { parent: parent });
    const childNodes: ChildNode[] = Array.from(parent.childNodes);

    for (const childNode of childNodes) {
      this.applyToCurrent(parent, childNode);
    }
  }

  /**
   * Applies rules to the current node and all of its child nodes.
   *
   * @param parent parent of node
   * @param currentNode current node to process
   * @private
   */
  private applyToCurrent(parent: Node, currentNode: Node): void {
    this.logger.debug(`Applying filter to ${currentNode.nodeName}.`, { parent: parent, currentNode: currentNode });
    if (currentNode instanceof Element && this.ruleSet.elements) {
      const beforeRule: ElementFilterRule | undefined = this.ruleSet.elements[BEFORE_ELEMENT];
      const filterRule: ElementFilterRule | undefined = this.ruleSet.elements[currentNode.nodeName.toLowerCase()];
      // We need to handle the children prior to the last rule. This provides the
      // opportunity, that the last rule may decide on a now possibly empty node.
      const handleChildrenRule: ElementFilterRule = () => {
        this.applyToChildNodes(currentNode);
      };
      const afterRule: ElementFilterRule | undefined = this.ruleSet.elements[AFTER_ELEMENT];
      const afterChildrenRule: ElementFilterRule | undefined = this.ruleSet.elements[AFTER_ELEMENT_AND_CHILDREN];

      const mutableElement = new MutableElement(currentNode);

      const newCurrent = mutableElement.applyRules(beforeRule, filterRule, afterRule, handleChildrenRule, afterChildrenRule);

      if (newCurrent) {
        this.applyToCurrent(parent, newCurrent);
      }
    }
  }
}
