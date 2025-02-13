import Plugin from "@ckeditor/ckeditor5-core/src/plugin";
import Writer from "@ckeditor/ckeditor5-engine/src/model/writer";
import Node from "@ckeditor/ckeditor5-engine/src/model/node";
import { createRichtextConfigurationServiceDescriptor } from "@coremedia/ckeditor5-coremedia-studio-integration/content/RichtextConfigurationServiceDescriptor";
import { serviceAgent } from "@coremedia/service-agent";
import Logger from "@coremedia/ckeditor5-logging/logging/Logger";
import LoggerProvider from "@coremedia/ckeditor5-logging/logging/LoggerProvider";
import {
  CreateModelFunction,
  CreateModelFunctionCreator,
} from "@coremedia/ckeditor5-coremedia-content-clipboard/ContentToModelRegistry";
import ContentClipboardEditing from "@coremedia/ckeditor5-coremedia-content-clipboard/ContentClipboardEditing";
import { ifPlugin, recommendPlugin, reportInitEnd, reportInitStart } from "@coremedia/ckeditor5-core-common/Plugins";

type CreateImageModelFunction = (blobUriPath: string) => CreateModelFunction;

const createImageModelFunctionCreator: CreateModelFunctionCreator = async (
  contentUri: string
): Promise<CreateModelFunction> => {
  const configurationService = await serviceAgent.fetchService(createRichtextConfigurationServiceDescriptor());
  const blobUriPath = await configurationService.resolveBlobPropertyReference(contentUri);
  return createImageModelFunction(blobUriPath);
};

const createImageModelFunction: CreateImageModelFunction =
  (blobUriPath: string): CreateModelFunction =>
  (writer: Writer): Node =>
    writer.createElement("imageInline", {
      "xlink-href": blobUriPath,
    });

/**
 * This plugin registers a `toModel` function for the `ContentClipboardEditing`
 * plugin.
 *
 * Initially, the `ContentClipboardEditing` plugin does not know how to handle
 * insertions (e.g., via drag and drop) of contents into the editor. Therefore,
 * each feature has to provide this information to the plugin manually.
 *
 * This particular plugin provides a strategy on how to insert contents that
 * should be displayed as a preview image.
 */
export default class ContentImageClipboardPlugin extends Plugin {
  static readonly pluginName: string = "ContentImageClipboardPlugin";
  static readonly #logger: Logger = LoggerProvider.getLogger(ContentImageClipboardPlugin.pluginName);

  async init(): Promise<void> {
    const logger = ContentImageClipboardPlugin.#logger;
    const { editor } = this;

    const initInformation = reportInitStart(this);

    await ifPlugin(editor, ContentClipboardEditing)
      .then((plugin) => {
        plugin.registerToModelFunction("image", createImageModelFunctionCreator);
      })
      .catch(recommendPlugin("Creating Content Images from Clipboard not activated.", logger));

    reportInitEnd(initInformation);
  }
}
