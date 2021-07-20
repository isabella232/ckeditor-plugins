import Plugin from "@ckeditor/ckeditor5-core/src/plugin";
import Editor from "@ckeditor/ckeditor5-core/src/editor/editor";
import { Logger, LoggerProvider } from "@coremedia/coremedia-utils/index";
import LinkUI from "@ckeditor/ckeditor5-link/src/linkui";
import LinkEditing from "@ckeditor/ckeditor5-link/src/linkediting";
import LinkFormView from "@ckeditor/ckeditor5-link/src/ui/linkformview";
import { CONTENT_CKE_MODEL_URI_REGEXP } from "@coremedia/coremedia-studio-integration/content/UriPath";
import createContentLinkView from "./ui/ContentLinkViewFactory";
import LabeledFieldView from "@ckeditor/ckeditor5-ui/src/labeledfield/labeledfieldview";
import ContentView from "./ui/ContentView";
import {
  extractContentCkeModelUri,
  receiveUriPathFromDragData,
} from "@coremedia/coremedia-studio-integration/content/DragAndDropUtils";
import { serviceAgent } from "@coremedia/studio-apps-service-agent";
import RichtextConfigurationService from "@coremedia/coremedia-studio-integration/content/RichtextConfigurationService";
import { showContentLinkField } from "./ContentLinkViewUtils";

/**
 * This plugin allows content objects to be dropped into the link dialog.
 * Content Links will be displayed as a content item.
 *
 */
export default class ContentLinks extends Plugin {
  static readonly pluginName: string = "ContentLinks";
  private readonly logger: Logger = LoggerProvider.getLogger(ContentLinks.pluginName);

  static get requires(): Array<new (editor: Editor) => Plugin> {
    return [LinkUI, LinkEditing];
  }

  init(): Promise<void> | null {
    const startTimestamp = performance.now();

    this.logger.debug(`Initializing ${ContentLinks.pluginName}...`);

    const editor = this.editor;
    const linkUI: LinkUI = <LinkUI>editor.plugins.get(LinkUI);

    this._extendFormView(linkUI);

    this.logger.debug(`Initialized ${ContentLinks.pluginName} within ${performance.now() - startTimestamp} ms.`);
    return null;
  }

  private static _onDropOnLinkField(
    dragEvent: DragEvent,
    formView: LinkFormView,
    contentLinkView: LabeledFieldView<ContentView>
  ): void {
    const contentCkeModelUri = extractContentCkeModelUri(dragEvent);
    dragEvent.preventDefault();
    if (contentCkeModelUri !== null) {
      ContentLinks.setDataAndSwitchToContentLink(formView, contentLinkView, contentCkeModelUri);
      return;
    }
    if (dragEvent.dataTransfer === null) {
      return;
    }

    const data: string = dragEvent.dataTransfer.getData("text/plain");
    if (data) {
      ContentLinks.setDataAndSwitchToExternalLink(formView, contentLinkView, data);
    }
    return;
  }

  private static setDataAndSwitchToExternalLink(
    formView: LinkFormView,
    contentLinkView: LabeledFieldView<ContentView>,
    data: string
  ): void {
    formView.urlInputView.fieldView.set("value", data);
    contentLinkView.fieldView.set("value", null);
    showContentLinkField(formView, false);
  }

  private static setDataAndSwitchToContentLink(
    formView: LinkFormView,
    contentLinkView: LabeledFieldView<ContentView>,
    data: string
  ): void {
    formView.urlInputView.fieldView.set("value", null);
    contentLinkView.fieldView.set("value", data);
    showContentLinkField(formView, true);
  }

  private static _onDragOverLinkField(dragEvent: DragEvent): void {
    dragEvent.preventDefault();
    const contentUriPath: string | null = receiveUriPathFromDragData();
    if (!dragEvent.dataTransfer) {
      return;
    }

    if (!contentUriPath) {
      dragEvent.dataTransfer.dropEffect = "none";
      return;
    }

    const service = serviceAgent.getService<RichtextConfigurationService>("mockRichtextConfigurationService");
    if (!service || !contentUriPath) {
      return;
    }

    service.observe_hasLinkableType(contentUriPath).subscribe((isLinkable) => {
      if (dragEvent.dataTransfer === null) {
        return;
      }
      if (isLinkable) {
        dragEvent.dataTransfer.dropEffect = "copy";
        return;
      }
      dragEvent.dataTransfer.dropEffect = "none";
    });
  }

  private _extendFormView(linkUI: LinkUI): void {
    const editor = this.editor;
    const linkCommand = editor.commands.get("link");
    const formView = linkUI.formView;
    const contentLinkView = createContentLinkView(this.editor.locale, formView, linkCommand);

    formView.once("render", () => this._render(contentLinkView, formView));
    /*
     * Workaround to reset the values of linkBehavior and target fields if modal
     * is canceled and reopened after changes have been made. See related issues:
     * ckeditor/ckeditor5-link#78 (now: ckeditor/ckeditor5#4765) and
     * ckeditor/ckeditor5-link#123 (now: ckeditor/ckeditor5#4793)
     */

    if (!(linkUI as any)["_events"] || !(linkUI as any)["_events"].hasOwnProperty("_addFormView")) {
      //@ts-ignore
      linkUI.decorate("_addFormView");
    }

    this.listenTo(linkUI, "_addFormView", () => {
      const { value: href } = <HTMLInputElement>formView.urlInputView.fieldView.element;

      contentLinkView.fieldView.set({
        value: CONTENT_CKE_MODEL_URI_REGEXP.test(href) ? href : null,
      });
    });
  }

  private addDragAndDropListeners(contentLinkView: LabeledFieldView<ContentView>, formView: LinkFormView): void {
    contentLinkView.fieldView.element.addEventListener("drop", (dragEvent: DragEvent) => {
      ContentLinks._onDropOnLinkField(dragEvent, formView, contentLinkView);
    });
    contentLinkView.fieldView.element.addEventListener("dragover", ContentLinks._onDragOverLinkField);

    formView.urlInputView.fieldView.element.addEventListener("drop", (dragEvent: DragEvent) => {
      ContentLinks._onDropOnLinkField(dragEvent, formView, contentLinkView);
    });
    formView.urlInputView.fieldView.element.addEventListener("dragover", ContentLinks._onDragOverLinkField);
  }

  private _render(contentLinkView: LabeledFieldView<ContentView>, formView: LinkFormView): void {
    formView.registerChild(contentLinkView);
    if (!contentLinkView.isRendered) {
      contentLinkView.render();
    }
    formView.element.insertBefore(contentLinkView.element, formView.urlInputView.element.nextSibling);
    this.addDragAndDropListeners(contentLinkView, formView);
  }
}
