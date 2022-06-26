import LabeledFieldView from "@ckeditor/ckeditor5-ui/src/labeledfield/labeledfieldview";
import Locale from "@ckeditor/ckeditor5-utils/src/locale";
import "../../../theme/contentlinkview.css";
import LinkUI from "@ckeditor/ckeditor5-link/src/linkui";
import ContentLinkView from "./ContentLinkView";
import { openInTab } from "../ContentLinkViewUtils";
import LinkFormView from "@ckeditor/ckeditor5-link/src/ui/linkformview";

/**
 * Creates an ContentLinkView that renders content links in the link form-view.
 * It is initially hidden and must be revealed by removing its hidden class manually.
 *
 * The ContentLinkView is a LabeledFieldView, which contains a ContentView.
 *
 * @param locale - the editor's locale
 * @param linkUI - the linkUI plugin
 */
const createContentLinkView = (locale: Locale, linkUI: LinkUI): LabeledFieldView => {
  const { t } = locale;
  // @ts-expect-error Bad Typing: DefinitelyTyped/DefinitelyTyped#60975
  const formView: LinkFormView = linkUI.formView;
  const contentLinkView: LabeledFieldView = new LabeledFieldView(
    locale,
    () =>
      new ContentLinkView(locale, linkUI, {
        renderTypeIcon: true,
        renderCancelButton: true,
      })
  );

  contentLinkView.set({
    label: t("Link"),
    isEmpty: false,
    class: "cm-ck-content-link-view-wrapper",
  });

  // Propagate URI-Path from formView (see FormViewExtension) to ContentLinkView
  // @ts-expect-error TODO Fix According to Typings
  contentLinkView.fieldView.bind("uriPath").to(formView, "contentUriPath");
  // Propagate Content Name from ContentLinkView to FormView, as we require to
  // know the name in some link insertion scenarios.
  formView.bind("contentName").to(contentLinkView.fieldView);

  contentLinkView.fieldView.on("doubleClick", () => {
    // @ts-expect-error TODO Fix Typings
    if (contentLinkView.fieldView.uriPath) {
      // @ts-expect-error TODO Fix Typings
      openInTab(contentLinkView.fieldView.uriPath);
    }
  });

  contentLinkView.fieldView.on("cancelClick", () => {
    formView.set({
      contentUriPath: undefined,
    });
    linkUI.actionsView.set({
      contentUriPath: undefined,
    });
  });

  return contentLinkView;
};

export default createContentLinkView;
