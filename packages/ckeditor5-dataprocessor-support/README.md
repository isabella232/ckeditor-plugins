# CKEditor 5: DataProcessor Support

[![API Documentation][badge:docs:api]][api:ckeditor-plugins]

In CKEditor 4 a central part of the mapping architecture were HTML filters and
data filters
(see
[Class HtmlDataProcessor (CKEDITOR.htmlDataProcessor)](https://ckeditor.com/docs/ckeditor4/latest/api/CKEDITOR_htmlDataProcessor.html)
and especially
[Class Filter (CKEDITOR.htmlParser.filter)](https://ckeditor.com/docs/ckeditor4/latest/api/CKEDITOR_htmlParser_filter.html)).

CKEditor 5 does not come with such filters.

This module re-introduces such filter approaches. It is not meant to be a
replacement but an alternative to the previous filtering mechanisms, which
should ease migration from CKEditor 4 based data processing approaches.

[badge:docs:api]: <https://img.shields.io/badge/docs-%F0%9F%93%83%20API-informational?style=for-the-badge>
[api:ckeditor-plugins]: <https://coremedia.github.io/ckeditor-plugins/docs/api/modules/ckeditor5_dataprocessor_support.html> "Module ckeditor5-dataprocessor-support"
