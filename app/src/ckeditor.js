import Alignment from '@ckeditor/ckeditor5-alignment/src/alignment';
import Autosave from '@ckeditor/ckeditor5-autosave/src/autosave';
import BlockQuote from '@ckeditor/ckeditor5-block-quote/src/blockquote';
import Bold from '@ckeditor/ckeditor5-basic-styles/src/bold';
import CKEditorInspector from '@ckeditor/ckeditor5-inspector';
import ClassicEditor from '@ckeditor/ckeditor5-editor-classic/src/classiceditor';
import Essentials from '@ckeditor/ckeditor5-essentials/src/essentials';
import Heading from '@ckeditor/ckeditor5-heading/src/heading';
import Indent from '@ckeditor/ckeditor5-indent/src/indent';
import Italic from '@ckeditor/ckeditor5-basic-styles/src/italic';
import Link from '@ckeditor/ckeditor5-link/src/link';
import List from '@ckeditor/ckeditor5-list/src/list';
import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import PasteFromOffice from '@ckeditor/ckeditor5-paste-from-office/src/pastefromoffice';
import RemoveFormat from '@ckeditor/ckeditor5-remove-format/src/removeformat';
import Strikethrough from '@ckeditor/ckeditor5-basic-styles/src/strikethrough';
import Subscript from '@ckeditor/ckeditor5-basic-styles/src/subscript';
import Superscript from '@ckeditor/ckeditor5-basic-styles/src/superscript';
import Table from '@ckeditor/ckeditor5-table/src/table';
import TableToolbar from '@ckeditor/ckeditor5-table/src/tabletoolbar';
import Underline from '@ckeditor/ckeditor5-basic-styles/src/underline';
import Highlight from '@ckeditor/ckeditor5-highlight/src/highlight';

import CoreMediaSymbolOnPasteMapper from '@coremedia/ckeditor5-symbol-on-paste-mapper/SymbolOnPasteMapper';
import CoreMediaRichText from '@coremedia/ckeditor5-coremedia-richtext/CoreMediaRichText';
import CoreMediaRichTextConfig, {COREMEDIA_RICHTEXT_CONFIG_KEY} from '@coremedia/ckeditor5-coremedia-richtext/CoreMediaRichTextConfig';
import {Strictness} from "@coremedia/ckeditor5-coremedia-richtext/RichTextSchema";

import {setupPreview, updatePreview} from './preview'

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const inspectorFlag = 'inspector';
const wantsInspector = urlParams.has(inspectorFlag) ? 'false' !== urlParams.get(inspectorFlag) : false;
const inspectorToggle = document.getElementById(inspectorFlag);

setupPreview();

if (wantsInspector) {
  inspectorToggle.setAttribute('href', '?inspector=false');
  inspectorToggle.textContent = 'Close Inspector';
}

ClassicEditor.create(document.querySelector('.editor'), {
  licenseKey: '',
  placeholder: 'Type your text here...',
  plugins: [
    Alignment,
    Autosave,
    BlockQuote,
    Bold,
    Essentials,
    Heading,
    Highlight,
    Indent,
    Italic,
    Link,
    List,
    Paragraph,
    PasteFromOffice,
    RemoveFormat,
    Strikethrough,
    Subscript,
    Superscript,
    Table,
    TableToolbar,
    Underline,
    CoreMediaSymbolOnPasteMapper,
    CoreMediaRichText
  ],
  toolbar: {
    items: [
      'undo',
      'redo',
      '|',
      'heading',
      '|',
      'bold',
      'italic',
      'blockQuote',
      'underline',
      'strikethrough',
      'superscript',
      'subscript',
      'removeFormat',
      '|',
      'link',
      '|',
      'alignment',
      '|',
      'insertTable',
      '|',
      'numberedList',
      'bulletedList',
      '|',
      'indent',
      'outdent',
      '|',
      'highlight',
    ]
  },
  language: 'en',
  autosave: {
    waitingTime: 5000, // in ms
    save(editor) {
      console.log("Save triggered...");
      const start = performance.now();
      const data = editor.getData({
        // set to none, to trigger data-processing for empty text, too
        // possible values: empty, none (default: empty)
        trim: 'empty',
      });
      saveData("autosave", data);
      console.log(`Saved data within ${performance.now() - start} ms.`);
    }
  },
  [COREMEDIA_RICHTEXT_CONFIG_KEY]: {
    strictness: Strictness.STRICT,
    rules: {
      elements: {
        // Highlight Plugin Support
        mark: {
          toData: (params) => {
            const originalClass = params.el.attributes["class"];
            params.el.attributes["class"] = `mark--${originalClass}`;
            params.el.name = "span";
          },
          toView: {
            span: (params) => {
              const originalClass = params.el.attributes["class"] || "";
              // TODO[cke] Would be really nice having "class list" access instead here, so that an element
              //    can be italics, but also marked.
              const pattern = /^mark--(\S*)$/;
              const match = pattern.exec(originalClass);
              if (match) {
                params.el.name = "mark";
                params.el.attributes["class"] = match[1];
              }
            },
          },
        },
      },
    },
  },
}).then(editor => {
  if (wantsInspector) {
    CKEditorInspector.attach(editor);
  }
}).catch(error => {
  console.error(error);
});

function saveData(source, data) {
  console.log("Saving data triggered by " + source, {data: data});
  updatePreview(data)
}
