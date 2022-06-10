import ViewDocument from "./document"
import ViewNode from "./node"
import { Item } from "./item";

/**
 * Document fragment.
 *
 * To create a new document fragment instance use the `UpcastWriter#createDocumentFragment()` method.
 *
 * @see <a href="https://ckeditor.com/docs/ckeditor5/latest/api/module_engine_view_documentfragment-DocumentFragment.html">Class DocumentFragment (engine/view/documentfragment~DocumentFragment) - CKEditor 5 API docs</a>
 */
export default class DocumentFragment {
  /**
   * The document to which this document fragment belongs.
   */
  readonly document: ViewDocument;

  readonly isEmpty: boolean;

  /**
   * Gets child nodes iterator.
   *
   * @returns {Iterable.<ViewNode>} Child nodes iterator.
   */
  getChildren(): IterableIterator<ViewNode>;

  _insertChild(index: number, items: Item | Iterable<Item>): number;
  
  _removeChildren(index: number, howMany?: number): Array<ViewNode>;

  getChild(index: number): ViewNode;

  /**
   * Gets index of the given child node. Returns `-1` if child node is not found.
   *
   * @param {ViewNode} node Child node.
   * @returns {number} Index of the child node.
   */
  getChildIndex(node: ViewNode): number;
}
