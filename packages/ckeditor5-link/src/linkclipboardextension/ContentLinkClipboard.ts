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

export default class ContentLinkClipboard extends Plugin {
  private _contentSubscription: Subscription | undefined = undefined;

  static get pluginName(): string {
    return "ContentLinkClipboard";
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

      const linkContent: LinkContent | null = ContentLinkClipboard.#evaluateLinkContent(data);
      if (!linkContent) {
        return;
      }

      //If it is a content link we have to handle the event asynchronously to fetch data like the content name from a remote service.
      //Therefore we have to stop the event, otherwise we would have to treat the event synchronously.
      evt.stop();
      if (linkContent.isContentLink) {
        serviceAgent
          .fetchService<ContentDisplayService>(new ContentDisplayServiceDescriptor())
          .then((contentDisplayService: ContentDisplayService): void => {
            for (const link of linkContent.links) {
              contentDisplayService.name(link).then((contentName) => {
                ContentLinkClipboard.#handleContentNameResponse(editor, data, link, contentName);
              });
            }
          });
      } else {
        for (const link of linkContent.links) {
          ContentLinkClipboard.#writeLink(editor, data, link, link);
        }
      }
    });

    this.listenTo(viewDocument, "dragover", (evt: EventInfo, data) => {
      // The clipboard content was already processed by the listener on the higher priority
      // (for example while pasting into the code block).
      if (data.content) {
        return;
      }

      const linkContent: LinkContent | null = ContentLinkClipboard.#evaluateLinkContentOnDragover();
      if (!linkContent) {
        return;
      }
      if (linkContent.isContentLink) {
        const isLinkable = DragDropAsyncSupport.hasAtLeastOneLinkable(linkContent.links);
        if (isLinkable) {
          data.dataTransfer.dropEffect = "copy";
        } else {
          data.dataTransfer.dropEffect = "none";
          evt.stop();
        }
      }
    });
  }

  static #handleContentNameResponse(editor: Editor, data: unknown, uriPath: string, contentName: string): void {
    const isLinkableContent = DragDropAsyncSupport.isLinkable(uriPath);
    if (!isLinkableContent) {
      DragDropAsyncSupport.resetIsLinkableContent(uriPath);
      return;
    }
    ContentLinkClipboard.#writeLink(editor, data, requireContentCkeModelUri(uriPath), contentName);
  }

  static #writeLink(editor: Editor, data: any, href: string, linkText: string): void {
    editor.model.change((writer) => {
      if (data.targetRanges) {
        writer.setSelection(data.targetRanges.map((viewRange: Range) => editor.editing.mapper.toModelRange(viewRange)));
      }

      editor.model.enqueueChange("default", () => {
        const link = writer.createText(`${linkText}`, {
          linkHref: `${href}`,
        });

        editor.model.insertContent(link, editor.model.document.selection);
      });
    });
  }

  static #evaluateLinkContent(data: DragEvent): LinkContent | null {
    if (data === null || data.dataTransfer === null) {
      return null;
    }

    const cmUriList = data.dataTransfer.getData("cm/uri-list");
    if (cmUriList) {
      const contentUris = extractContentUriFromDragEventJsonData(cmUriList);
      if (!contentUris) {
        return null;
      }
      return new LinkContent(true, contentUris);
    }

    const url = data.dataTransfer.getData("text/uri-list");
    if (url) {
      return new LinkContent(false, [url]);
    }

    return null;
  }

  static #evaluateLinkContentOnDragover(): LinkContent | null {
    const contentUriPaths: Array<string> | null = receiveUriPathFromDragData();
    if (!contentUriPaths) {
      //due to we have no data, just set it empty...
      return new LinkContent(false, [""]);
    }
    return new LinkContent(true, contentUriPaths);
  }

  destroy(): Promise<never> | null {
    if (this._contentSubscription) {
      this._contentSubscription.unsubscribe();
    }
    return null;
  }
}

class LinkContent {
  isContentLink;
  links: Array<string>;

  constructor(isContentLink: boolean, links: Array<string>) {
    this.isContentLink = isContentLink;
    this.links = links;
  }
}
