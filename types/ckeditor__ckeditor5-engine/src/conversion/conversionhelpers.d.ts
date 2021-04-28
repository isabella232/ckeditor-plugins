import DowncastHelpers from "./downcasthelpers";
import UpcastHelpers from "./upcasthelpers";
import DowncastDispatcher from "./downcastdispatcher";
import UpcastDispatcher from "./upcastdispatcher";

/**
 * Base class for conversion helpers.
 * @see <a href="https://ckeditor.com/docs/ckeditor5/latest/api/module_engine_conversion_conversionhelpers-ConversionHelpers.html">Class ConversionHelpers (engine/conversion/conversionhelpers~ConversionHelpers) - CKEditor 5 API docs</a>
 */
export default class ConversionHelpers {
  constructor(dispatchers: (DowncastDispatcher | UpcastDispatcher)[]);

  add(conversionHelper: Function): DowncastHelpers | UpcastHelpers;
}
