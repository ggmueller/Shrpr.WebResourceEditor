#Project

Shrpr Web Resource Editor is an addon for Microsoft Dynamics CRM and acts as a replacement for the textbox that opens if you click
edit on a WebResource like a JavaScript library.

When opening a Webresource using Shrpr WRE you get:
* Syntax Highlighting
* Row Numbers
* Brace Matching
* and several other benefits (for details see the [webpage](http://www.shrpr.org/p/shrpr-web-resource-editor.html))

#License
The Shrpr Web Resource Editor is licensed under [Apache 2.0 License](http://www.apache.org/licenses/LICENSE-2.0)

#Changelog

##Version 0.3
* **New Feature**: Help now displays a short help describing the File Actions and the available shortcuts
* ** New Feature**: Shortcuts for Save And Publish, Save And Close and Save
* **Improvement**: The resources type is now identified by the resourcetype field of the webresource, closing #5
* Fixed issue where the documents title was the URL instead of the WebResource content name

##Version 0.2

* **New Feature**: Annotation on the sidebar, eg when having a TODO in a comment
* Fixed an issue when loading the editor from the ribbon loaded the wrong URL
* Fixed issue #1, where an error was thrown when hovering over the sidebar
* Fixed issue #2, that describes, that the WebResourceEditor only loads the published states of a Webresource. Now it loads the unpublished state
