import Plugin from "@ckeditor/ckeditor5-core/src/plugin";
import Editor from "@ckeditor/ckeditor5-core/src/editor/editor";
import {
  extractContentUriFromDragEventJsonData,
  receiveUriPathFromDragData,
} from "@coremedia/coremedia-studio-integration/content/DragAndDropUtils";
import { serviceAgent } from "@coremedia/studio-apps-service-agent";
import ContentDisplayService from "@coremedia/coremedia-studio-integration/content/ContentDisplayService";
import ContentDisplayServiceDescriptor from "@coremedia/coremedia-studio-integration/content/ContentDisplayServiceDescriptor";
import { Subscription } from "rxjs";
import EventInfo from "@ckeditor/ckeditor5-utils/src/eventinfo";
import DragDropAsyncSupport from "@coremedia/coremedia-studio-integration/content/DragDropAsyncSupport";
import { requireContentCkeModelUri } from "@coremedia/coremedia-studio-integration/content/UriPath";
import Writer from "@ckeditor/ckeditor5-engine/src/model/writer";
import Range from "@ckeditor/ckeditor5-engine/src/model/range";
import Position from "@ckeditor/ckeditor5-engine/src/model/position";
import { ROOT_NAME } from "../contentlink/Constants";
import Logger from "@coremedia/coremedia-utils/logging/Logger";
import LoggerProvider from "@coremedia/coremedia-utils/logging/LoggerProvider";

export default class ContentLinkClipboard extends Plugin {
  private _contentSubscription: Subscription | undefined = undefined;
  static #CONTENT_LINK_CLIPBOARD_PLUGIN_NAME = "ContentLinkClipboard";
  static #LOGGER: Logger = LoggerProvider.getLogger(ContentLinkClipboard.#CONTENT_LINK_CLIPBOARD_PLUGIN_NAME);
  static get pluginName(): string {
    return ContentLinkClipboard.#CONTENT_LINK_CLIPBOARD_PLUGIN_NAME;
  }

  static get requires(): Array<new (editor: Editor) => Plugin> {
    return [];
  }

  init(): Promise<void> | null {
    this.#defineClipboardInputOutput();
    return null;
  }

  #defineClipboardInputOutput(): void {
    const view = this.editor.editing.view;
    const viewDocument = view.document;

    const editor = this.editor;
    // Processing pasted or dropped content.
    this.listenTo(viewDocument, "clipboardInput", (evt, data) => {
      // The clipboard content was already processed by the listener on the higher priority
      // (for example while pasting into the code block).
      if (data.content) {
        return;
      }

      const linkContents: Array<LinkContent> | null = ContentLinkClipboard.#evaluateLinkContent(data);
      if (!linkContents || linkContents.length === 0) {
        return;
      }
      ContentLinkClipboard.#LOGGER.debug("Links dropped: " + JSON.stringify(linkContents));

      //If it is a content link we have to handle the event asynchronously to fetch data like the content name from a remote service.
      //Therefore we have to stop the event, otherwise we would have to treat the event synchronously.
      evt.stop();
      const dropCondition: DropCondition = ContentLinkClipboard.#createDropCondition(editor, data, linkContents);
      ContentLinkClipboard.#LOGGER.debug("Calculated drop condition: " + JSON.stringify(dropCondition));
      if (ContentLinkClipboard.#hasOnlyContentLinks(linkContents)) {
        serviceAgent
          .fetchService<ContentDisplayService>(new ContentDisplayServiceDescriptor())
          .then((contentDisplayService: ContentDisplayService): void => {
            ContentLinkClipboard.#makeContentNameRequests(contentDisplayService, editor, dropCondition, linkContents);
          });
      } else {
        for (const index in linkContents) {
          if (!linkContents.hasOwnProperty(index)) {
            continue;
          }
          const isLast = linkContents.length - 1 === Number(index);
          const isFirst = Number(index) === 0;
          const link = linkContents[index];
          ContentLinkClipboard.#writeLink(editor, link.href, link.href, dropCondition, isFirst, isLast);
        }
      }
    });

    this.listenTo(viewDocument, "dragover", (evt: EventInfo, data) => {
      // The clipboard content was already processed by the listener on the higher priority
      // (for example while pasting into the code block).
      if (data.content) {
        return;
      }

      const linkContent: Array<LinkContent> | null = ContentLinkClipboard.#evaluateLinkContentOnDragover();
      if (!linkContent) {
        return;
      }
      if (ContentLinkClipboard.#hasOnlyContentLinks(linkContent)) {
        const uriPaths = linkContent.map<string>((value) => value.href);
        const containOnlyLinkables = DragDropAsyncSupport.containsOnlyLinkables(uriPaths);
        if (containOnlyLinkables) {
          data.dataTransfer.dropEffect = "copy";
        } else {
          data.dataTransfer.dropEffect = "none";
          evt.stop();
        }
      }
    });
  }

  static #makeContentNameRequests(
    contentDisplayService: ContentDisplayService,
    editor: Editor,
    dropCondition: DropCondition,
    linkContents: Array<LinkContent>
  ): void {
    const namePromises: Array<Promise<string>> = [];
    for (const index in linkContents) {
      if (!linkContents.hasOwnProperty(index)) {
        continue;
      }
      const contentLink = linkContents[index];
      const namePromise = contentDisplayService.name(contentLink.href);
      namePromises.push(namePromise);
    }
    Promise.all(namePromises).then((contentNames: Array<string>) => {
      ContentLinkClipboard.#LOGGER.debug(JSON.stringify(contentNames));
      for (const index in contentNames) {
        if (!contentNames.hasOwnProperty(index) || !linkContents.hasOwnProperty(index)) {
          continue;
        }
        const contentName = contentNames[index];
        const contentLink = linkContents[index];
        const isLast = linkContents.length - 1 === Number(index);
        const isFirst = Number(index) === 0;
        ContentLinkClipboard.#handleContentNameResponse(
          editor,
          contentLink.href,
          contentName,
          dropCondition,
          isFirst,
          isLast
        );
      }
    });
  }

  static #handleContentNameResponse(
    editor: Editor,
    uriPath: string,
    contentName: string,
    dropCondition: DropCondition,
    isFirstInsertedLink: boolean,
    isLastInsertedLink: boolean
  ): void {
    ContentLinkClipboard.#LOGGER.debug(
      "Rendering link: " +
        JSON.stringify({
          uriPath,
          contentName,
          dropCondition,
          isFirst: isFirstInsertedLink,
          isLast: isLastInsertedLink,
        })
    );
    const isLinkableContent = DragDropAsyncSupport.isLinkable(uriPath);
    DragDropAsyncSupport.resetIsLinkableContent(uriPath);
    if (!isLinkableContent) {
      return;
    }
    const contentNameRespectingRoot = contentName ? contentName : ROOT_NAME;
    ContentLinkClipboard.#writeLink(
      editor,
      requireContentCkeModelUri(uriPath),
      contentNameRespectingRoot,
      dropCondition,
      isFirstInsertedLink,
      isLastInsertedLink
    );
  }

  static #writeLink(
    editor: Editor,
    href: string,
    linkText: string,
    dropCondition: DropCondition,
    isFirstInsertedLink: boolean,
    isLastInsertedLink: boolean
  ): void {
    if (dropCondition.multipleContentDrop) {
      ContentLinkClipboard.#writeLinkInOwnParagraph(
        editor,
        href,
        linkText,
        dropCondition,
        isFirstInsertedLink,
        isLastInsertedLink
      );
    } else {
      ContentLinkClipboard.#writeLinkInline(editor, href, linkText, dropCondition);
    }
  }

  static #writeLinkInline(editor: Editor, href: string, linkText: string, dropCondition: DropCondition): void {
    editor.model.change((writer: Writer) => {
      if (dropCondition.targetRange) {
        writer.setSelection(dropCondition.targetRange);
      }
      const firstPosition = editor.model.document.selection.getFirstPosition();
      if (firstPosition === null) {
        return;
      }
      writer.overrideSelectionGravity();
      const linkElement = writer.createText(linkText, { linkHref: href });
      writer.insert(linkElement, firstPosition);
      const positionAfterText = writer.createPositionAfter(linkElement);
      const textRange = writer.createRange(firstPosition, positionAfterText);
      ContentLinkClipboard.#setSelectionAttributes(writer, [textRange], dropCondition.selectedAttributes);
    });
  }

  static #writeLinkInOwnParagraph(
    editor: Editor,
    href: string,
    linkText: string,
    dropCondition: DropCondition,
    isFirstInsertedLink: boolean,
    isLastInsertedLink: boolean
  ): void {
    editor.model.change((writer: Writer) => {
      // When dropping the drop position is stored as range but the editor not yet updated, so we have to update the
      // the selection to the drop position/cursor position.
      if (isFirstInsertedLink && dropCondition.targetRange) {
        writer.setSelection(dropCondition.targetRange);
      }
      const actualPosition = editor.model.document.selection.getFirstPosition();
      if (actualPosition === null) {
        return;
      }

      const textRange = ContentLinkClipboard.#insertLink(
        writer,
        actualPosition,
        href,
        linkText,
        dropCondition.initialDropAtStartOfParagraph,
        isFirstInsertedLink
      );
      ContentLinkClipboard.#setSelectionAttributes(writer, [textRange], dropCondition.selectedAttributes);
      if (isLastInsertedLink && !dropCondition.initialDropAtEndOfParagraph) {
        //Finish with a new line if the contents are dropped into an inline position
        const secondSplit = writer.split(textRange.end);
        writer.setSelection(secondSplit.range.end);
      } else {
        if (isLastInsertedLink) {
          //If we drop to the end of the document we do not end in the next paragraph so we have to make sure that we do not
          //end in the link tag to not proceed the link when typing.
          writer.overrideSelectionGravity();
        }
        writer.setSelection(textRange.end);
      }
    });
  }

  static #insertLink(
    writer: Writer,
    actualPosition: Position,
    href: string,
    linkText: string,
    initialDropAtStartOfParagraph: boolean,
    isFirstLink: boolean
  ): Range {
    const isFirstDocumentPosition = ContentLinkClipboard.#isFirstPositionOfDocument(actualPosition);
    const text = writer.createText(linkText, {
      linkHref: href,
    });
    let textStartPosition;
    if (isFirstDocumentPosition || (initialDropAtStartOfParagraph && isFirstLink)) {
      textStartPosition = actualPosition;
      writer.insert(text, actualPosition);
    } else {
      const split = writer.split(actualPosition);
      textStartPosition = split.range.end;
      writer.insert(text, split.range.end);
    }
    const afterTextPosition = writer.createPositionAt(text, "after");
    return writer.createRange(textStartPosition, afterTextPosition);
  }

  static #setSelectionAttributes(
    writer: Writer,
    textRange: Array<Range>,
    attributes: Array<[string, string | number | boolean]>
  ): void {
    for (const attribute of attributes) {
      for (const range of textRange) {
        writer.setAttribute(attribute[0], attribute[1], range);
      }
    }
  }

  static #isFirstPositionOfDocument(position: Position): boolean {
    const path = position.getCommonPath(position);
    for (const pathElement of path) {
      if (pathElement !== 0) {
        return false;
      }
    }
    return true;
  }

  static #evaluateLinkContent(data: DragEvent): Array<LinkContent> | null {
    if (data === null || data.dataTransfer === null) {
      return null;
    }

    const cmUriList = data.dataTransfer.getData("cm/uri-list");

    if (cmUriList) {
      const contentUris = extractContentUriFromDragEventJsonData(cmUriList);
      return ContentLinkClipboard.#toLinkContent(contentUris);
    }

    const url = data.dataTransfer.getData("text/uri-list");
    if (url) {
      return [new LinkContent(false, url)];
    }

    return [];
  }

  static #evaluateLinkContentOnDragover(): Array<LinkContent> | null {
    const contentUriPaths: Array<string> | null = receiveUriPathFromDragData();
    if (!contentUriPaths) {
      //due to we have no data, just set it empty...
      return null;
    }
    return ContentLinkClipboard.#toLinkContent(contentUriPaths);
  }

  static #toLinkContent(contentUris: Array<string> | null): Array<LinkContent> {
    if (!contentUris) {
      return [];
    }
    const linkContents: Array<LinkContent> = [];
    for (const contentUri of contentUris) {
      linkContents.push(new LinkContent(true, contentUri));
    }
    return linkContents;
  }

  static #createDropCondition(editor: Editor, data: any, links: Array<LinkContent>): DropCondition {
    const multipleContentDrop = links.length > 1;
    const targetRange: Range | null = ContentLinkClipboard.#evaluateTargetRange(editor, data);
    const initialDropAtStartOfParagraph = targetRange ? targetRange.start.isAtStart : false;
    const initialDropAtEndOfParagraph = targetRange ? targetRange.end.isAtEnd : false;
    const attributes = editor.model.document.selection.getAttributes();
    return new DropCondition(
      multipleContentDrop,
      initialDropAtEndOfParagraph,
      initialDropAtStartOfParagraph,
      targetRange,
      Array.from(attributes)
    );
  }

  static #evaluateTargetRange(editor: Editor, data: any): Range | null {
    if (!data.targetRanges) {
      return null;
    }
    const targetRanges: Array<Range> = data.targetRanges.map((viewRange: Range) => {
      return editor.editing.mapper.toModelRange(viewRange);
    });
    if (targetRanges.length > 0) {
      return targetRanges[0];
    }
    return null;
  }

  destroy(): Promise<never> | null {
    if (this._contentSubscription) {
      this._contentSubscription.unsubscribe();
    }
    return null;
  }

  static #hasOnlyContentLinks(linkContents: Array<LinkContent>): boolean {
    for (const linkContent of linkContents) {
      if (!linkContent.isContentLink) {
        return false;
      }
    }
    return true;
  }
}

class LinkContent {
  isContentLink;
  href: string;

  constructor(isContentLink: boolean, href: string) {
    this.isContentLink = isContentLink;
    this.href = href;
  }
}

class DropCondition {
  initialDropAtEndOfParagraph: boolean;
  initialDropAtStartOfParagraph: boolean;
  multipleContentDrop: boolean;
  targetRange: Range | null;
  selectedAttributes: Array<[string, string | number | boolean]>;

  constructor(
    multipleContentDrop: boolean,
    initialDropAtEndOfParagraph: boolean,
    initialDropAtStartOfParagraph: boolean,
    targetRange: Range | null,
    selectedAttributes: Array<[string, string | number | boolean]>
  ) {
    this.multipleContentDrop = multipleContentDrop;
    this.initialDropAtEndOfParagraph = initialDropAtEndOfParagraph;
    this.initialDropAtStartOfParagraph = initialDropAtStartOfParagraph;
    this.targetRange = targetRange;
    this.selectedAttributes = selectedAttributes;
  }
}
