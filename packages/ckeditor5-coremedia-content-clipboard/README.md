# CoreMedia CKEditor 5 Content Clipboard Plugin

The CoreMedia Content Clipboard plugin extends the
[CKEditor 5 Clipboard Feature][cke5:docs:clipboard:feature].

It consists of two main plugins

* **ContentClipboard:**

  Integrates into CKEditor's Input Pipeline and evaluates input events for
  CoreMedia Content inputs. Inputs can be triggered by all kinds of user
  interaction, such as dropping or pasting.

  If an input is of the CoreMedia Content type, the default Input Pipeline is 
  stopped and the `ContentClipboard` takes over by adding loading spinners
  (and Markers) for the dropped contents.


* **ContentClipboardEditing:**

  The ContentClipboardEditing plugin listens to Content Input Markers, added by
  the `ContentClipboard` plugin. It then loads the linked content, removes the
  placeholder and renders the corresponding content.

## Installation

```text
pnpm install @coremedia/ckeditor5-coremedia-content-clipboard
```

```javascript
import ContentClipboard from "@coremedia/ckeditor5-coremedia-content-clipboard/ContentClipboard";

ClassicEditor.create(document.querySelector('#editor'), {
  plugins: [
    ContentClipboard,
    /* ... */
  ],
}).then((editor) => {
  /* ... */
});
```

[cke5:docs:clipboard:feature]: <https://ckeditor.com/docs/ckeditor5/latest/framework/guides/deep-dive/clipboard.html> "Clipboard - CKEditor 5 Documentation"
