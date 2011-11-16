﻿/*
   Copyright 2011 Georg Müller

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

///<reference path="Shrpr.Common.js"/>
///<reference path="XrmPageTemplate.js"/>
///<reference path="jquery_1.7.js"/>
///<reference path="orion/editor/editor.js"/>
///<reference path="TextStyler.js"/>
///<reference path="base64/base64.js"/>

var Shrpr = shrpr_registerNS("Shrpr");

Shrpr.Editor = {
    __editor: { },

    getWrId: function() {
        return window.opener.Xrm.Page.context.getQueryStringParameters()['id'].replace("{", "").replace("}", "");
    },
    /// <param name="onResourceLoaded" type="function" >
    ///1: callback-a function that is called when the WebResource is loaded
    ///</param>
    loadWebResource:
        function(onResourceLoaded) {
            var context = GetGlobalContext();
            var wrId = Shrpr.Editor.getWrId();
            //Asynchronous AJAX function to Retrieve a CRM record using OData
            $.ajax({
                    type: "GET",
                    contentType: "application/json; charset=utf-8",
                    datatype: "json",
                    url: context.getServerUrl() + Shrpr.Editor.ODATA_ENDPOINT + "/WebResourceSet(guid'" + wrId + "')",
                    beforeSend: function(xmlHttpRequest) {
                        //Specifying this header ensures that the results will be returned as JSON.             
                        xmlHttpRequest.setRequestHeader("Accept", "application/json");
                    },
                    success: function(data, textStatus, xmlHttpRequest) {
                        onResourceLoaded(data.d);
                        Shrpr.Editor.createEditor(data.d);
                    },
                    error: function(xmlHttpRequest, textStatus, errorThrown) {
                        alert(textStatus + ": " + errorThrown);
                    }
                });

        },
    createEditor: function(webResource) {
        var editorDomNode = document.getElementById("editor");

        var textViewFactory = function() {
            return new orion.textview.TextView({
                    parent: editorDomNode,
                    stylesheet: ["orion/textview/textview.css",
                        "orion/textview/rulers.css",
                        "orion/textview/annotations.css",
                        "orion/textstyler.css",
                        "htmlStyles.css"],
                    tabSize: 4
                });
        };

        var contentAssistFactory = function(editor) {
            var contentAssist = new orion.editor.ContentAssist(editor, "contentassist");
            contentAssist.addProvider(new orion.editor.CssContentAssistProvider(), "css", "\\.css$");
            contentAssist.addProvider(new orion.editor.JavaScriptContentAssistProvider(), "js", "\\.js$");
            return contentAssist;
        };

        // Canned highlighters for js, java, and css. Grammar-based highlighter for html
        var syntaxHighlighter = {
            styler: null,

            highlight: function(fileName, editor) {
                if (this.styler) {
                    this.styler.destroy();
                    this.styler = null;
                }
                if (fileName) {
                    var splits = fileName.split(".");
                    var extension = splits.pop().toLowerCase();
                    var textView = editor.getTextView();
                    var annotationModel = editor.getAnnotationModel();
                    if (splits.length > 0) {
                        switch (extension) {
                        case "js":
                        case "css":
                            this.styler = new examples.textview.TextStyler(textView, extension, annotationModel);
                            break;
                        case "html":
                        case "htm":
                            this.styler = new orion.editor.TextMateStyler(textView, orion.editor.HtmlGrammar.grammar);
                            break;
                        }
                    }
                }
            }
        };

        var annotationFactory = new orion.editor.AnnotationFactory();


        var keyBindingFactory = function(editor, keyModeStack, undoStack, contentAssist) {

            // Create keybindings for generic editing
            var genericBindings = new orion.editor.TextActions(editor, undoStack);
            keyModeStack.push(genericBindings);

            // create keybindings for source editing
            var codeBindings = new orion.editor.SourceCodeActions(editor, undoStack, contentAssist);
            keyModeStack.push(codeBindings);

            // save binding
            editor.getTextView().setKeyBinding(new orion.textview.KeyBinding("s", true), "save");
            editor.getTextView().setAction("save", function() {
                Shrpr.Editor.save();
                return true;
            });

            // speaking of save...
            //document.getElementById("save").onclick = function () { save(editor); };

        };

        var dirtyIndicator = "";
        var status = "";

        var statusReporter = function(message, isError) {
            if (isError) {
                status = "ERROR: " + message;
            } else {
                status = message;
            }
            document.getElementById("status").innerHTML = dirtyIndicator + status;
        };

        Shrpr.Editor.__editor = new orion.editor.Editor({
                textViewFactory: textViewFactory,
                undoStackFactory: new orion.editor.UndoFactory(),
                annotationFactory: annotationFactory,
                lineNumberRulerFactory: new orion.editor.LineNumberRulerFactory(),
                contentAssistFactory: contentAssistFactory,
                keyBindingFactory: keyBindingFactory,
                statusReporter: statusReporter,
                domNode: editorDomNode
            });

        var editor = Shrpr.Editor.__editor;

        orion.editor.util.connect(editor, "onDirtyChange", this, function(dirty) {
            if (dirty) {
                dirtyIndicator = "*";
            } else {
                dirtyIndicator = "";
            }
            document.getElementById("status").innerHTML = dirtyIndicator + status;
        });

        editor.installTextView();
        // if there is a mechanism to change which file is being viewed, this code would be run each time it changed.
        var contentName = webResource.Name; // for example, a file name, something the user recognizes as the content.
        var extension = "";
        switch (webResource.WebResourceType.Value) {
        case 1:
            extension = "html";
            break;
        case 2:
            extension = "css";
            break;
        case 3:
            extension = "js";
            break;
        }

        var wrExtension = contentName.split('.').pop();

        if (wrExtension != extension) {
            contentName = contentName.replace(wrExtension, extension);
        }

        var initialContent = base64.decode(webResource.Content);
        editor.onInputChange(contentName, null, initialContent);
        syntaxHighlighter.highlight(contentName, editor);
        // end of code to run when content changes.
    },

    save: function() {
        Shrpr.Editor.onSaving();
        Shrpr.Editor.__save(Shrpr.Editor.onSaved);
    },

    saveAndPublish: function() {
        Shrpr.Editor.onSaveAndPublishing();
        Shrpr.Editor.__save(Shrpr.Editor.__publish);
    },

    saveAndClose: function() {
        Shrpr.Editor.onSaveAndClosing();
        Shrpr.Editor.__save(Shrpr.Editor.onSaveAndClosed);
    },

    __publish: function() {
        var wrId = Shrpr.Editor.getWrId();
        var publishRequest = "";
        publishRequest += "<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\">";
        publishRequest += "  <s:Body>";
        publishRequest += "    <Execute xmlns=\"http://schemas.microsoft.com/xrm/2011/Contracts/Services\" xmlns:i=\"http://www.w3.org/2001/XMLSchema-instance\">";
        publishRequest += "      <request i:type=\"b:PublishXmlRequest\" xmlns:a=\"http://schemas.microsoft.com/xrm/2011/Contracts\" xmlns:b=\"http://schemas.microsoft.com/crm/2011/Contracts\">";
        publishRequest += "        <a:Parameters xmlns:c=\"http://schemas.datacontract.org/2004/07/System.Collections.Generic\">";
        publishRequest += "          <a:KeyValuePairOfstringanyType>";
        publishRequest += "            <c:key>ParameterXml</c:key>";
        publishRequest += "            <c:value i:type=\"d:string\" xmlns:d=\"http://www.w3.org/2001/XMLSchema\">&lt;importexportxml&gt;&lt;webresources&gt;&lt;webresource&gt;{" + wrId + "}&lt;/webresource&gt;&lt;/webresources&gt;&lt;/importexportxml&gt;</c:value>";
        publishRequest += "          </a:KeyValuePairOfstringanyType>";
        publishRequest += "        </a:Parameters>";
        publishRequest += "        <a:RequestId i:nil=\"true\" />";
        publishRequest += "        <a:RequestName>PublishXml</a:RequestName>";
        publishRequest += "      </request>";
        publishRequest += "    </Execute>";
        publishRequest += "  </s:Body>";
        publishRequest += "</s:Envelope>";

        $.ajax({
                type: "POST",
                contentType: "text/xml; charset=utf-8",
                datatype: "xml",
                data: publishRequest,
                url: GetGlobalContext().getServerUrl() + "/XRMServices/2011/Organization.svc/web",
                beforeSend: function(xmlHttpRequest) {
                    xmlHttpRequest.setRequestHeader("Accept", "application/xml, text/xml, */*");
                    xmlHttpRequest.setRequestHeader("SOAPAction", "http://schemas.microsoft.com/xrm/2011/Contracts/Services/IOrganizationService/Execute");
                },
                success: function(data, textStatus, XmlHttpRequest) {
                    Shrpr.Editor.onSaveAndPublished();
                }
            });
    },

    __save: function(onSaved) {
        var editor = Shrpr.Editor.__editor;
        var context = GetGlobalContext();
        ///<summary>
        ///Uses jQuery's AJAX object to call the Microsoft Dynamics CRM OData endpoint to
        ///     update an existing record
        ///</summary>
        /// <param name="id" type="guid" required="true">
        ///1: id -     the guid (primarykey) of the record to be retrieved
        ///</param>
        /// <param name="entityObject" type="Object" required="true">
        ///1: entity - a loose-type object representing an OData entity. any fields
        ///                 on this object must be camel-cased and named exactly as they 
        ///                 appear in entity metadata
        ///</param>
        /// <param name="odataSetName" type="string" required="true">
        ///1: set -    a string representing an OData Set. OData provides uri access
        ///                 to any CRM entity collection. examples: AccountSet, ContactSet,
        ///                 OpportunitySet. 
        ///</param>
        /// <param name="successCallback" type="function" >
        ///1: callback-a function that can be supplied as a callback upon success
        ///                 of the ajax invocation.
        ///</param>
        /// <param name="errorCallback" type="function" >
        ///1: callback-a function that can be supplied as a callback upon error
        ///                 of the ajax invocation.
        ///</param>

        function updateRecord(id, entityObject, odataSetName, successCallback, errorCallback) {

            //id is required
            if (!id) {
                alert("record id is required.");
                return;
            }
            // entityObject is required.
            if (!entityObject) {
                alert("entityObject is required");
                return;
            }
            //odataSetName is required, i.e. "AccountSet"
            if (!odataSetName) {
                alert("odataSetName is required.");
                return;
            }

            //Parse the entity object into JSON
            var jsonEntity = window.JSON.stringify(entityObject);

            //Asynchronous AJAX function to Update a CRM record using OData
            $.ajax({
                    type: "POST",
                    contentType: "application/json; charset=utf-8",
                    datatype: "json",
                    data: jsonEntity,
                    url: context.getServerUrl() + Shrpr.Editor.ODATA_ENDPOINT + "/" + odataSetName + "(guid'" + id + "')",
                    beforeSend: function(XMLHttpRequest) {
                        //Specifying this header ensures that the results will be returned as JSON.             
                        XMLHttpRequest.setRequestHeader("Accept", "application/json");

                        //Specify the HTTP method MERGE to update just the changes you are submitting.             
                        XMLHttpRequest.setRequestHeader("X-HTTP-Method", "MERGE");
                    },
                    success: function(data, textStatus, XmlHttpRequest) {
                        //The MERGE does not return any data at all, so we'll add the id 
                        //onto the data object so it can be leveraged in a Callback. When data 
                        //is used in the callback function, the field will be named generically, "id"
                        data = new Object();
                        data.id = id;
                        if (successCallback) {
                            successCallback(data, textStatus, XmlHttpRequest);
                        }
                    },
                    error: function(XmlHttpRequest, textStatus, errorThrown) {
                        if (errorCallback)
                            errorCallback(XmlHttpRequest, textStatus, errorThrown);
                        else
                            alert("Error:" + textStatus + " Detail: " + errorThrown);
                    }
                });


        }

        var editorText = editor.getText();
        var content = base64.encode(editorText);

        updateRecord(Shrpr.Editor.getWrId(), { Content: content }, 'WebResourceSet',
            function(data, textStatus, xmlHttpRequest) {
                editor.onInputChange(null, null, null, true);
                onSaved();
            }
        );
    },
    onSaving: function() {
    },
    onSaved: function() {
    },
    onSaveAndClosing: function() {
    },
    onSaveAndClosed: function() {
    },
    onSaveAndPublishing: function() {
    },
    onSaveAndPublished: function() {
    },
    ODATA_ENDPOINT: "/XRMServices/2011/OrganizationData.svc",
    __namespace: true
};