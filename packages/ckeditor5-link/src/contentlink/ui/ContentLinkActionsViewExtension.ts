import Plugin from "@ckeditor/ckeditor5-core/src/plugin";
import Editor from "@ckeditor/ckeditor5-core/src/editor/editor";
import LinkUI from "@ckeditor/ckeditor5-link/src/linkui";
import LinkActionsView from "@ckeditor/ckeditor5-link/src/ui/linkactionsview";
import { Logger, LoggerProvider } from "@coremedia/coremedia-utils/index";
import ContentLinkView from "./ContentLinkView";
import { CONTENT_CKE_MODEL_URI_REGEXP } from "@coremedia/coremedia-studio-integration/content/UriPath";
import { showContentLinkField } from "../ContentLinkViewUtils";

/**
 * Extends the action view for Content link display. This includes:
 *
 * * render name of linked content (or placeholder for unreadable content)
 * * provide `onClick` handler to open a content in a new Studio tab
 *     (rather than opening an external URL in a new browser tab).
 */
class ContentLinkActionsViewExtension extends Plugin {
  static readonly pluginName: string = "ContentLinkActionsViewExtension";
  static readonly #logger: Logger = LoggerProvider.getLogger(ContentLinkActionsViewExtension.pluginName);

  static get requires(): Array<new (editor: Editor) => Plugin> {
    return [LinkUI];
  }

  init(): Promise<void> | null {
    const startTimestamp = performance.now();

    ContentLinkActionsViewExtension.#logger.debug(`Initializing ${ContentLinkActionsViewExtension.pluginName}...`);

    const editor = this.editor;
    const linkUI: LinkUI = <LinkUI>editor.plugins.get(LinkUI);
    const linkCommand = editor.commands.get("link");

    linkUI.actionsView.set({
      contentUriPath: undefined,
    });

    linkUI.actionsView.bind("contentUriPath").to(linkCommand, "value", (value: string) => {
      return CONTENT_CKE_MODEL_URI_REGEXP.test(value) ? value : undefined;
    });

    /*
     * We need to update the visibility of the inputs when the value of the content link changes
     * If the value was removed: show external link field, otherwise show the content link field
     */
    linkUI.actionsView.on("change:contentUriPath", (evt) => {
      const value = evt.source.contentUriPath;
      // content link value has changed. set urlInputView accordingly
      // value is null if it was set by cancelling and reopening the dialog, resetting the dialog should not
      // re-trigger a set of utlInputView here
      if (value !== null) {
        linkUI.formView.urlInputView.fieldView.set({
          value: value || "",
        });
      }

      // set visibility of url and content field
      showContentLinkField(linkUI.formView, value);
      showContentLinkField(linkUI.actionsView, value);
    });

    this.#extendView(linkUI);

    ContentLinkActionsViewExtension.#logger.debug(
      `Initialized ${ContentLinkActionsViewExtension.pluginName} within ${performance.now() - startTimestamp} ms.`
    );

    return null;
  }

  #extendView(linkUI: LinkUI): void {
    const actionsView: LinkActionsView = linkUI.actionsView;
    const contentLinkView = new ContentLinkView(this.editor.locale, linkUI, {
      renderTypeIcon: true,
    });
    contentLinkView.set({
      underlined: true,
    });
    contentLinkView.bind("uriPath").to(linkUI.actionsView, "contentUriPath");
    //TODO
    contentLinkView.on("execute", (event) => {
      console.log("this should open the content in a new tab");
    });

    actionsView.once("render", () => ContentLinkActionsViewExtension.#render(actionsView, contentLinkView));
  }

  static #render(actionsView: LinkActionsView, simpleContentLinkView: ContentLinkView): void {
    actionsView.registerChild(simpleContentLinkView);
    if (!simpleContentLinkView.isRendered) {
      simpleContentLinkView.render();
    }
    actionsView.element.insertBefore(simpleContentLinkView.element, actionsView.editButtonView.element);
  }
}

export default ContentLinkActionsViewExtension;
