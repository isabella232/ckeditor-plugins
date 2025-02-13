/* eslint no-null/no-null: off */

import Plugin from "@ckeditor/ckeditor5-core/src/plugin";
import Logger from "@coremedia/ckeditor5-logging/logging/Logger";
import LoggerProvider from "@coremedia/ckeditor5-logging/logging/LoggerProvider";
import Editor from "@ckeditor/ckeditor5-core/src/editor/editor";
import Clipboard from "@ckeditor/ckeditor5-clipboard/src/clipboard";
import ClipboardPipeline from "@ckeditor/ckeditor5-clipboard/src/clipboardpipeline";
import { receiveUriPathsFromDragDropService } from "@coremedia/ckeditor5-coremedia-studio-integration/content/DragAndDropUtils";
import DragDropAsyncSupport from "@coremedia/ckeditor5-coremedia-studio-integration/content/DragDropAsyncSupport";
import ModelRange from "@ckeditor/ckeditor5-engine/src/model/range";
import ViewRange from "@ckeditor/ckeditor5-engine/src/view/range";
import EventInfo from "@ckeditor/ckeditor5-utils/src/eventinfo";
import { ClipboardEventData } from "@ckeditor/ckeditor5-clipboard/src/clipboardobserver";
import ContentClipboardEditing from "./ContentClipboardEditing";
import ModelDocumentFragment from "@ckeditor/ckeditor5-engine/src/model/documentfragment";
import ViewDocumentFragment from "@ckeditor/ckeditor5-engine/src/view/documentfragment";
import { getUriListValues } from "@coremedia/ckeditor5-coremedia-studio-integration/content/DataTransferUtils";
import {
  ifPlugin,
  optionalPluginNotFound,
  reportInitEnd,
  reportInitStart,
} from "@coremedia/ckeditor5-core-common/Plugins";
import { disableUndo, UndoSupport } from "./integrations/Undo";
import { isRaw } from "@coremedia/ckeditor5-common/AdvancedTypes";
import { isUriPath } from "@coremedia/ckeditor5-coremedia-studio-integration/content/UriPath";
import { insertContentMarkers } from "./ContentMarkers";

const PLUGIN_NAME = "ContentClipboardPlugin";

/**
 * Artificial interface of `ClipboardEventData`, which holds a content.
 */
declare interface ContentEventData<T> extends ClipboardEventData {
  content: T;
}

/**
 * Type-Guard for ContentEventData.
 *
 * @param value - value to validate
 */
const isContentEventData = <T extends ClipboardEventData>(value: T): value is T & ContentEventData<unknown> =>
  isRaw<ContentEventData<unknown>>(value, "content");

/**
 * Specifies the additional data provided by ClipboardPipeline's
 * `contentInsertion` event.
 */
declare interface ContentInsertionEventData extends ContentEventData<ModelDocumentFragment> {
  method: "paste" | "drop";
  targetRanges: ViewRange[];
  resultRange?: ModelRange;
}

/**
 * Specifies the additional data provided by ClipboardPipeline's
 * `inputTransformation` event.
 */
declare interface InputTransformationEventData extends ContentEventData<ViewDocumentFragment> {
  /**
   * Whether the event was triggered by a paste or drop operation.
   */
  method: "paste" | "drop";
  /**
   * The target drop ranges.
   */
  targetRanges: ViewRange[];
}

/**
 * Event data of `clipboardInput` event in `view.Document`.
 */
declare interface ClipboardInputEvent extends ClipboardEventData {
  /**
   * Required for hack to mark event as consumed.
   */
  content?: ViewDocumentFragment;
  // noinspection GrazieInspection - copied original description
  /**
   * Ranges which are the target of the operation (usually – into which the
   * content should be inserted). If the clipboard input was triggered by a
   * paste operation, this property is not set. If by a drop operation, then it
   * is the drop position (which can be different than the selection
   * at the moment of drop).
   */
  targetRanges: ViewRange[];
}

/**
 * This plugin takes care of linkable Studio contents, which are dropped
 * directly into the editor or pasted from the clipboard.
 */
export default class ContentClipboard extends Plugin {
  static readonly pluginName = PLUGIN_NAME;
  static readonly #logger: Logger = LoggerProvider.getLogger(PLUGIN_NAME);

  static readonly requires = [Clipboard, ClipboardPipeline, ContentClipboardEditing, UndoSupport];

  init(): void {
    const initInformation = reportInitStart(this);
    this.#initEventListeners();
    reportInitEnd(initInformation);
  }

  /**
   * Adds a listener to `dragover` and `clipboardInput` to process possibly
   * dragged contents.
   */
  #initEventListeners(): void {
    const editor = this.editor;
    const view = editor.editing.view;
    const viewDocument = view.document;

    // Processing pasted or dropped content.
    this.listenTo(viewDocument, "clipboardInput", this.#clipboardInputHandler);
    // Priority `low` required, so that we can control the `dropEffect`.
    this.listenTo(viewDocument, "dragover", ContentClipboard.#dragOverHandler, { priority: "low" });

    void ifPlugin(editor, ClipboardPipeline).then((p) =>
      this.listenTo(p, "inputTransformation", this.#inputTransformation)
    );
  }

  destroy(): void {
    const editor = this.editor;
    const view = editor.editing.view;
    const viewDocument = view.document;

    this.stopListening(viewDocument, "clipboardInput", this.#clipboardInputHandler);
    this.stopListening(viewDocument, "dragover", ContentClipboard.#dragOverHandler);
    ifPlugin(editor, ClipboardPipeline)
      .then((p) => this.stopListening(p, "inputTransformation", this.#inputTransformation))
      .catch(optionalPluginNotFound);
  }

  /**
   * Drag-over handler to control drop-effect icons, which is, to forbid for
   * any content-sets containing types, which are not allowed to be linked.
   *
   * @param evt - event information
   * @param data - clipboard data
   */
  static #dragOverHandler(evt: EventInfo, data: ClipboardEventData): void {
    // The clipboard content was already processed by the listener on the
    // higher priority (for example, while pasting into the code block).
    if (isContentEventData(data) && !!data.content) {
      return;
    }
    const cmDataUris = receiveUriPathsFromDragDropService();
    if (!cmDataUris) {
      return;
    }

    // @ts-expect-error Bad typing, DefinitelyTyped/DefinitelyTyped#60966
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    data.preventDefault();

    // for now, we only support content uris in ckeditor.
    const validContentUris = ContentClipboard.#filterValidUris(cmDataUris);

    const containsDisplayableContents = DragDropAsyncSupport.containsDisplayableContents(validContentUris);
    // Applying dropEffects required to be run *after* CKEditor's normal
    // listeners, which almost always enforce `move` as dropEffect. We also must
    // not `stop` processing (at least at normal priority), as otherwise the
    // range indicator won't be updated.
    if (containsDisplayableContents) {
      data.dataTransfer.dropEffect = "link";
    } else {
      data.dataTransfer.dropEffect = "none";
    }
  }

  // noinspection JSUnusedLocalSymbols
  /**
   * Handler for the clipboardInput event. This function gets called when
   * an item is dropped or pasted into the editor.
   *
   * See: https://github.com/ckeditor/ckeditor5/blob/6eab4831ef4432152069c457c8921395315c1b33/packages/ckeditor5-clipboard/src/clipboardpipeline.js#L59-L121
   * The goal here is to hook into the clipboardPipeline and use our
   * inputTransform method if the clipboard data is a CoreMedia content.
   *
   * @param evt - event information
   * @param data - clipboard data
   */
  #clipboardInputHandler = (evt: EventInfo, data: ClipboardInputEvent): void => {
    // Return if this is no CoreMedia content drop.
    if ((getUriListValues(data) ?? []).length === 0) {
      return;
    }

    // This is kinda hacky, we need to set content to skip the default
    // clipboardInputHandler by setting content, we mark this event as
    // "already resolved".
    data.content = new ViewDocumentFragment();
  };

  /**
   * Event listener callback that gets hooked into CKEditor's clipboardPipeline.
   * If the retrieved data is a CoreMedia content, the event will be stopped.
   * This also stops the default clipboardPipeline.
   *
   * After adding all needed markers (and UIElements), we trigger the last step
   * of the pipeline manually by firing an event with an empty document
   * fragment.
   *
   * **Important:** This function also disabled the undo command. Be sure to
   * enable it again after the content has been written to the model.
   *
   * @param evt - event information
   * @param data - clipboard data
   */
  #inputTransformation = (evt: EventInfo, data: InputTransformationEventData): void => {
    const cmDataUris: string[] = getUriListValues(data) ?? [];
    // Return if this is no CoreMedia content drop.
    if (cmDataUris.length === 0) {
      return;
    }

    const { editor } = this;

    // Return if no range has been set (usually indicated by a blue cursor
    // during the drag)
    const targetRange = ContentClipboard.#evaluateTargetRange(editor, data);
    if (!targetRange) {
      return;
    }

    // Do not trigger the default inputTransformation event listener to avoid
    // rendering the text of the input data.
    evt.stop();

    // for now, we only support content uris in ckeditor.
    const validContentUris = ContentClipboard.#filterValidUris(cmDataUris);

    if (!DragDropAsyncSupport.containsDisplayableContents(validContentUris)) {
      return;
    }

    // We might run into trouble during complex input scenarios:
    //
    // A drop with multiple items will result in different requests that might
    // differ in response time, for example.
    //
    // Triggering undo/redo while only a part of the input has already been
    // resolved, will cause an inconsistent state between content and
    // placeholder elements.
    //
    // The best solution for this seems to disable the undo command before the
    // input and enable it again afterwards.
    void ifPlugin(editor, UndoSupport).then(disableUndo);

    const { model } = editor;

    insertContentMarkers(editor, targetRange, validContentUris);
    // Fire content insertion event in a single change block to allow other
    // handlers to run in the same block without post-fixers called in between
    // (i.e., the selection post-fixer).
    model.change(() => {
      this.fire("contentInsertion", {
        content: new ModelDocumentFragment(),
        method: data.method,
        dataTransfer: data.dataTransfer,
        targetRanges: data.targetRanges,
      } as ContentInsertionEventData);
    });
  };

  /**
   * Evaluate target range. `null` if no range could be determined.
   *
   * @param editor - current editor instance
   * @param data - event data
   */
  static #evaluateTargetRange(editor: Editor, data: InputTransformationEventData): ModelRange | null {
    if (!data.targetRanges) {
      return editor.model.document.selection.getFirstRange();
    }
    const targetRanges: ModelRange[] = data.targetRanges.map(
      (viewRange: ViewRange): ModelRange => editor.editing.mapper.toModelRange(viewRange)
    );
    if (targetRanges.length > 0) {
      return targetRanges[0];
    }
    return null;
  }

  static #filterValidUris(uris: string[]): string[] {
    return uris.filter((uri) => {
      if (isUriPath(uri)) {
        return true;
      }
      ContentClipboard.#logger.debug(`Found an unsupported uri, will be ignored: ${uri}`);
      return false;
    });
  }
}
