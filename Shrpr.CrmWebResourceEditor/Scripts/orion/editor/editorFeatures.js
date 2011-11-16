/*******************************************************************************
 * Copyright (c) 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*global define window orion:true */
/*jslint maxerr:150 browser:true devel:true */


/**
 * @namespace The container for Orion APIs.
 */ 
var orion = orion || {};
orion.editor = orion.editor || {};	

orion.editor.UndoFactory = (function() {
	function UndoFactory() {
	}
	UndoFactory.prototype = {
		createUndoStack: function(editor) {
			var textView = editor.getTextView();
			var undoStack =  new orion.textview.UndoStack(textView, 200);
			textView.setKeyBinding(new orion.textview.KeyBinding('z', true), "Undo");
			textView.setAction("Undo", function() {
				undoStack.undo();
				return true;
			});
			
			var isMac = navigator.platform.indexOf("Mac") !== -1;
			textView.setKeyBinding(isMac ? new orion.textview.KeyBinding('z', true, true) : new orion.textview.KeyBinding('y', true), "Redo");
			textView.setAction("Redo", function() {
				undoStack.redo();
				return true;
			});
			return undoStack;
		}
	};
	return UndoFactory;
}());

orion.editor.LineNumberRulerFactory = (function() {
	function LineNumberRulerFactory() {
	}
	LineNumberRulerFactory.prototype = {
		createLineNumberRuler: function(annotationModel) {
			return new orion.textview.LineNumberRuler(annotationModel, "left", {styleClass: "ruler lines"}, {styleClass: "rulerLines odd"}, {styleClass: "rulerLines even"});
		}
	};
	return LineNumberRulerFactory;
}());

orion.editor.FoldingRulerFactory = (function() {
	function FoldingRulerFactory() {
	}
	FoldingRulerFactory.prototype = {
		createFoldingRuler: function(annotationModel) {
			return new orion.textview.FoldingRuler(annotationModel, "left", {styleClass: "ruler folding"});
		}
	};
	return FoldingRulerFactory;
}());


orion.editor.AnnotationFactory = (function() {
	function AnnotationFactory() {
	}
	AnnotationFactory.prototype = {
		createAnnotationModel: function(model) {
			return new orion.textview.AnnotationModel(model);
		},
		createAnnotationStyler: function(annotationModel, view) {
			return new orion.textview.AnnotationStyler(annotationModel, view);
		},
		createAnnotationRulers: function(annotationModel) {
			var annotationRuler = new orion.textview.AnnotationRuler(annotationModel, "left", {styleClass: "ruler annotations"});
			var overviewRuler = new orion.textview.OverviewRuler(annotationModel, "right", {styleClass: "ruler overview"});
			return {annotationRuler: annotationRuler, overviewRuler: overviewRuler};
		}
	};
	return AnnotationFactory;
}());

/**
 * TextCommands connects common text editing keybindings onto an editor.
 */
orion.editor.TextActions = (function() {
	function TextActions(editor, undoStack, searcher) {
		this.editor = editor;
		this.textView = editor.getTextView();
		this.undoStack = undoStack;
		this._incrementalFindActive = false;
		this._incrementalFindSuccess = true;
		this._incrementalFindIgnoreSelection = false;
		this._incrementalFindPrefix = "";
		this._searcher =  searcher;
		if(this._searcher) {
			this._searcher.getAdaptor().setEditor(this.editor);
		}
		this.init();
	}
	TextActions.prototype = {
		init: function() {
			this._incrementalFindListener = {
				onVerify: function(e){
					/** @returns {String} with regex special characters escaped. */
					function regexpEscape(/**String*/ str) {
						return str.replace(/([\\$\^*\/+?\.\(\)|{}\[\]])/g, "\\$&");
					}
					var editor = this.editor;
					var model = editor.getModel();
					var start = editor.mapOffset(e.start), end = editor.mapOffset(e.end);
					var txt = model.getText(start, end);
					var prefix = this._incrementalFindPrefix;
					var match = prefix.match(new RegExp("^"+regexpEscape(txt), "i"));
					if (match && match.length > 0) {
						prefix = this._incrementalFindPrefix += e.text;
						this.editor.reportStatus("Incremental find: " + prefix);
						var ignoreCase = prefix.toLowerCase() === prefix;
						var searchStart = editor.getSelection().start;
						var result = editor.doFind(prefix, searchStart, ignoreCase);
						if (result) {
							this._incrementalFindSuccess = true;
							this._incrementalFindIgnoreSelection = true;
							editor.moveSelection(result.index, result.index+result.length);
							this._incrementalFindIgnoreSelection = false;
						} else {
							editor.reportStatus("Incremental find: " + prefix + " (not found)", true);
							this._incrementalFindSuccess = false;
						}
						e.text = null;
					} else {
					}
				}.bind(this),
				onSelection: function() {
					if (!this._incrementalFindIgnoreSelection) {
						this.toggleIncrementalFind();
					}
				}.bind(this)
			};
			// Find actions
			// These variables are used among the various find actions:
			this.textView.setKeyBinding(new orion.textview.KeyBinding("f", true), "Find...");
			this.textView.setAction("Find...", function() {
				if (this._searcher) {
					var editor = this.editor;
					var selection = editor.getSelection();
					var searchString = "";
					if (selection.end > selection.start) {
						var model = editor.getModel();
						searchString = model.getText(selection.start, selection.end);
					}
					this._searcher.buildToolBar(searchString);
					return true;
				}
				return false;
			}.bind(this));
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding("k", true), "Find Next Occurrence");
			this.textView.setAction("Find Next Occurrence", function() {
				if (this._searcher){
					this._searcher.findNext(true);
					return true;
				}
				return false;
			}.bind(this));
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding("k", true, true), "Find Previous Occurrence");
			this.textView.setAction("Find Previous Occurrence", function() {
				if (this._searcher){
					this._searcher.findNext(false);
					return true;
				}
				return false;
			}.bind(this));

			this.textView.setKeyBinding(new orion.textview.KeyBinding("j", true), "Incremental Find");
			this.textView.setAction("Incremental Find", function() {
				if (this._searcher && this._searcher.visible()) {
					return true;
				}
				var editor = this.editor;
				if (!this._incrementalFindActive) {
					editor.setCaretOffset(editor.getCaretOffset());
					this.toggleIncrementalFind();
				} else {
					var prefix = this._incrementalFindPrefix;
					if (prefix.length !== 0) {
						var result;
						if (this._searcher) {
							result = this._searcher.findNext(true, prefix);
						} else {
							var searchStart = 0;
							if (this._incrementalFindSuccess) {
								searchStart = editor.getSelection().start + 1;
							}
							var caseInsensitive = prefix.toLowerCase() === prefix;
							result = editor.doFind(prefix, searchStart, caseInsensitive);
						}
						if (result) {
							this._incrementalFindSuccess = true;
							this._incrementalFindIgnoreSelection = true;
							editor.moveSelection(result.index, result.index + result.length);
							this._incrementalFindIgnoreSelection = false;
							editor.reportStatus("Incremental find: " + prefix);
						} else {
							editor.reportStatus("Incremental find: " + prefix + " (not found)", true);
							this._incrementalFindSuccess = false;
						}
					}
				}
				return true;
			}.bind(this));
			this.textView.setAction("deletePrevious", function() {
				if (this._incrementalFindActive) {
					var editor = this.editor;
					var prefix = this._incrementalFindPrefix;
					prefix = this._incrementalFindPrefix = prefix.substring(0, prefix.length-1);
					if (prefix.length===0) {
						this._incrementalFindSuccess = true;
						this._incrementalFindIgnoreSelection = true;
						editor.setCaretOffset(editor.getSelection().start);
						this._incrementalFindIgnoreSelection = false;
						this.toggleIncrementalFind();
						return true;
					}
					editor.reportStatus("Incremental find: " + prefix);
					var caretOffset = editor.getCaretOffset();
					var model = editor.getModel();
					var index = model.getText().lastIndexOf(prefix, caretOffset - prefix.length - 1);
					if (index !== -1) {
						this._incrementalFindSuccess = true;
						this._incrementalFindIgnoreSelection = true;
						editor.moveSelection(index,index+prefix.length);
						this._incrementalFindIgnoreSelection = false;
					} else {
						editor.reportStatus("Incremental find: " + prefix + " (not found)", true);
					}
					return true;
				}
				return false;
			}.bind(this));
			
			this.textView.setAction("tab", function() {
				var editor = this.editor;
				var model = editor.getModel();
				var selection = editor.getSelection();
				var firstLine = model.getLineAtOffset(selection.start);
				var lastLine = model.getLineAtOffset(selection.end > selection.start ? selection.end - 1 : selection.end);
				if (firstLine !== lastLine) {
					var lines = [];
					lines.push("");
					for (var i = firstLine; i <= lastLine; i++) {
						lines.push(model.getLine(i, true));
					}
					var lineStart = model.getLineStart(firstLine);
					var lineEnd = model.getLineEnd(lastLine, true);
					editor.setText(lines.join("\t"), lineStart, lineEnd);
					editor.setSelection(lineStart === selection.start ? selection.start : selection.start + 1, selection.end + (lastLine - firstLine + 1));
					return true;
				}
				return false;
			}.bind(this));

			this.textView.setKeyBinding(new orion.textview.KeyBinding(9, false, true), "Unindent Lines");
			this.textView.setAction("Unindent Lines", function() {
				var editor = this.editor;
				var model = editor.getModel();
				var selection = editor.getSelection();
				var firstLine = model.getLineAtOffset(selection.start);
				var lastLine = model.getLineAtOffset(selection.end > selection.start ? selection.end - 1 : selection.end);
				var lines = [], removeCount = 0;
				for (var i = firstLine; i <= lastLine; i++) {
					var line = model.getLine(i, true);
					if (model.getLineStart(i) !== model.getLineEnd(i)) {
						if (line.indexOf("\t") !== 0) { return false; }
						line = line.substring(1);
						removeCount++;
					}
					lines.push(line);
				}
				var lineStart = model.getLineStart(firstLine);
				var lineEnd = model.getLineEnd(lastLine, true);
				var lastLineStart = model.getLineStart(lastLine);
				editor.setText(lines.join(""), lineStart, lineEnd);
				editor.setSelection(lineStart === selection.start ? selection.start : selection.start - 1, selection.end - removeCount + (selection.end === lastLineStart+1 ? 1 : 0));
				return true;
			}.bind(this));
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding(38, false, false, true), "Move Lines Up");
			this.textView.setAction("Move Lines Up", function() {
				var editor = this.editor;
				var model = editor.getModel();
				var selection = editor.getSelection();
				var firstLine = model.getLineAtOffset(selection.start);
				if (firstLine === 0) {
					return true;
				}
				var lastLine = model.getLineAtOffset(selection.end > selection.start ? selection.end - 1 : selection.end);
				var lineCount = model.getLineCount();
				var insertOffset = model.getLineStart(firstLine - 1);
				var lineStart = model.getLineStart(firstLine);
				var lineEnd = model.getLineEnd(lastLine, true);
				var text = model.getText(lineStart, lineEnd);
				var delimiterLength = 0;
				if (lastLine === lineCount-1) {
					// Move delimiter preceding selection to end of text
					var delimiterStart = model.getLineEnd(firstLine - 1);
					var delimiterEnd = model.getLineEnd(firstLine - 1, true);
					text += model.getText(delimiterStart, delimiterEnd);
					lineStart = delimiterStart;
					delimiterLength = delimiterEnd - delimiterStart;
				}
				this.startUndo();
				editor.setText("", lineStart, lineEnd);
				editor.setText(text, insertOffset, insertOffset);
				editor.setSelection(insertOffset, insertOffset + text.length - delimiterLength);
				this.endUndo();
				return true;
			}.bind(this));
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding(40, false, false, true), "Move Lines Down");
			this.textView.setAction("Move Lines Down", function() {
				var editor = this.editor;
				var model = editor.getModel();
				var selection = editor.getSelection();
				var firstLine = model.getLineAtOffset(selection.start);
				var lastLine = model.getLineAtOffset(selection.end > selection.start ? selection.end - 1 : selection.end);
				var lineCount = model.getLineCount();
				if (lastLine === lineCount-1) {
					return true;
				}
				var lineStart = model.getLineStart(firstLine);
				var lineEnd = model.getLineEnd(lastLine, true);
				var insertOffset = model.getLineEnd(lastLine+1, true) - (lineEnd - lineStart);
				var text, delimiterLength = 0;
				if (lastLine !== lineCount-2) {
					text = model.getText(lineStart, lineEnd);
				} else {
					// Move delimiter following selection to front of the text
					var lineEndNoDelimiter = model.getLineEnd(lastLine);
					text = model.getText(lineEndNoDelimiter, lineEnd) + model.getText(lineStart, lineEndNoDelimiter);
					delimiterLength += lineEnd - lineEndNoDelimiter;
				}
				this.startUndo();
				editor.setText("", lineStart, lineEnd);
				editor.setText(text, insertOffset, insertOffset);
				editor.setSelection(insertOffset + delimiterLength, insertOffset + delimiterLength + text.length);
				this.endUndo();
				return true;
			}.bind(this));
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding(38, true, false, true), "Copy Lines Up");
			this.textView.setAction("Copy Lines Up", function() {
				var editor = this.editor;
				var model = editor.getModel();
				var selection = editor.getSelection();
				var firstLine = model.getLineAtOffset(selection.start);
				var lastLine = model.getLineAtOffset(selection.end > selection.start ? selection.end - 1 : selection.end);
				var lineStart = model.getLineStart(firstLine);
				var lineEnd = model.getLineEnd(lastLine, true);
				var lineCount = model.getLineCount();
				var delimiter = "";
				var text = model.getText(lineStart, lineEnd);
				if (lastLine === lineCount-1) {
					text += (delimiter = model.getLineDelimiter());
				}
				var insertOffset = lineStart;
				editor.setText(text, insertOffset, insertOffset);
				editor.setSelection(insertOffset, insertOffset + text.length - delimiter.length);
				return true;
			}.bind(this));
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding(40, true, false, true), "Copy Lines Down");
			this.textView.setAction("Copy Lines Down", function() {
				var editor = this.editor;
				var model = editor.getModel();
				var selection = editor.getSelection();
				var firstLine = model.getLineAtOffset(selection.start);
				var lastLine = model.getLineAtOffset(selection.end > selection.start ? selection.end - 1 : selection.end);
				var lineStart = model.getLineStart(firstLine);
				var lineEnd = model.getLineEnd(lastLine, true);
				var lineCount = model.getLineCount();
				var delimiter = "";
				var text = model.getText(lineStart, lineEnd);
				if (lastLine === lineCount-1) {
					text = (delimiter = model.getLineDelimiter()) + text;
				}
				var insertOffset = lineEnd;
				editor.setText(text, insertOffset, insertOffset);
				editor.setSelection(insertOffset + delimiter.length, insertOffset + text.length);
				return true;
			}.bind(this));
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding('d', true, false, false), "Delete Selected Lines");
			this.textView.setAction("Delete Selected Lines", function() {
				var editor = this.editor;
				var selection = editor.getSelection();
				var model = editor.getModel();
				var firstLine = model.getLineAtOffset(selection.start);
				var lastLine = model.getLineAtOffset(selection.end > selection.start ? selection.end - 1 : selection.end);
				var lineStart = model.getLineStart(firstLine);
				var lineEnd = model.getLineEnd(lastLine, true);
				editor.setText("", lineStart, lineEnd);
				return true;
			}.bind(this));
			
			// Go To Line action
			this.textView.setKeyBinding(new orion.textview.KeyBinding("l", true), "Goto Line...");
			this.textView.setAction("Goto Line...", function() {
				var editor = this.editor;
				var model = editor.getModel();
				var line = model.getLineAtOffset(editor.getCaretOffset());
				line = prompt("Go to line:", line + 1);
				if (line) {
					line = parseInt(line, 10);
					editor.onGotoLine(line - 1, 0);
				}
				return true;
			}.bind(this));
			
		},
			
		toggleIncrementalFind: function() {
			this._incrementalFindActive = !this._incrementalFindActive;
			if (this._incrementalFindActive) {
				this.editor.reportStatus("Incremental find: " + this._incrementalFindPrefix);
				this.textView.addEventListener("Verify", this, this._incrementalFindListener.onVerify);
				this.textView.addEventListener("Selection", this, this._incrementalFindListener.onSelection);
			} else {
				this._incrementalFindPrefix = "";
				this.editor.reportStatus("");
				this.textView.removeEventListener("Verify", this, this._incrementalFindListener.onVerify);
				this.textView.removeEventListener("Selection", this, this._incrementalFindListener.onSelection);
				this.textView.setCaretOffset(this.textView.getCaretOffset());
			}
		},
		
		startUndo: function() {
			if (this.undoStack) {
				this.undoStack.startCompoundChange();
			}
		}, 
		
		endUndo: function() {
			if (this.undoStack) {
				this.undoStack.endCompoundChange();
			}
		}, 
	
		cancel: function() {
			this.toggleIncrementalFind();
		},
		
		isActive: function() {
			return this._incrementalFindActive;
		},
		
		isStatusActive: function() {
			return this._incrementalFindActive;
		},
		
		lineUp: function() {
			if (this._incrementalFindActive) {
				var prefix = this._incrementalFindPrefix;
				if (prefix.length === 0) {
					return false;
				}
				var editor = this.editor;
				var model = editor.getModel();
				var start;
				if (this._incrementalFindSuccess) {
					start = editor.getCaretOffset() - prefix.length - 1;
				} else {
					start = model.getCharCount() - 1;
				}
				var index = model.getText().lastIndexOf(prefix, start);
				if (index !== -1) {
					this._incrementalFindSuccess = true;
					this._incrementalFindIgnoreSelection = true;
					editor.moveSelection(index, index + prefix.length);
					this._incrementalFindIgnoreSelection = false;
				} else {
					editor.reportStatus("Incremental find: " + prefix + " (not found)", true);	
					this._incrementalFindSuccess = false;
				}
				return true;
			}
			return false;
		},
		lineDown: function() {	
			if (this._incrementalFindActive) {
				var prefix = this._incrementalFindPrefix;
				if (prefix.length === 0) {
					return false;
				}
				var editor = this.editor;
				var model = editor.getModel();
				var start = 0;
				if (this._incrementalFindSuccess) {
					start = editor.getSelection().start + 1;
				}
				var index = model.getText().indexOf(prefix, start);
				if (index !== -1) {
					this._incrementalFindSuccess = true;
					this._incrementalFindIgnoreSelection = true;
					editor.moveSelection(index, index+prefix.length);
					this._incrementalFindIgnoreSelection = false;
					this.editor.reportStatus("Incremental find: " + prefix);
				} else {
					editor.reportStatus("Incremental find: " + prefix + " (not found)", true);
					this._incrementalFindSuccess = false;
				}
				return true;
			}
			return false;
		},
		enter: function() {
			return false;
		}
	};
	return TextActions;
}());

orion.editor.SourceCodeActions = (function() {
	/**
	 * @param {orion.editor.Editor} editor
	 * @param {orion.textView.UndoStack} undoStack
	 * @param {orion.editor.ContentAssist} [contentAssist]
	 * @param {orion.editor.LinkedMode} [linkedMode]
	 */
	function SourceCodeActions(editor, undoStack, contentAssist, linkedMode) {
		this.editor = editor;
		this.textView = editor.getTextView();
		this.undoStack = undoStack;
		this.contentAssist = contentAssist;
		this.linkedMode = linkedMode;
		if (this.contentAssist) {
			this.contentAssist.addEventListener("accept", this.contentAssistProposalAccepted.bind(this));
		}
		
		this.init();
	}
	SourceCodeActions.prototype = {
		startUndo: function() {
			if (this.undoStack) {
				this.undoStack.startCompoundChange();
			}
		}, 
		
		endUndo: function() {
			if (this.undoStack) {
				this.undoStack.endCompoundChange();
			}
		}, 
		init: function() {
		
			// Block comment operations
			this.textView.setKeyBinding(new orion.textview.KeyBinding(191, true), "Toggle Line Comment");
			this.textView.setAction("Toggle Line Comment", function() {
				var editor = this.editor;
				var model = editor.getModel();
				var selection = editor.getSelection();
				var firstLine = model.getLineAtOffset(selection.start);
				var lastLine = model.getLineAtOffset(selection.end > selection.start ? selection.end - 1 : selection.end);
				var uncomment = true, lines = [], lineText, index;
				for (var i = firstLine; i <= lastLine; i++) {
					lineText = model.getLine(i, true);
					lines.push(lineText);
					if (!uncomment || (index = lineText.indexOf("//")) === -1) {
						uncomment = false;
					} else {
						if (index !== 0) {
							var j;
							for (j=0; j<index; j++) {
								var c = lineText.charCodeAt(j);
								if (!(c === 32 || c === 9)) {
									break;
								}
							}
							uncomment = j === index;
						}
					}
				}
				var text, selStart, selEnd;
				var lineStart = model.getLineStart(firstLine);
				var lineEnd = model.getLineEnd(lastLine, true);
				if (uncomment) {
					for (var k = 0; k < lines.length; k++) {
						lineText = lines[k];
						index = lineText.indexOf("//");
						lines[k] = lineText.substring(0, index) + lineText.substring(index + 2);
					}
					text = lines.join("");
					var lastLineStart = model.getLineStart(lastLine);
					selStart = lineStart === selection.start ? selection.start : selection.start - 2;
					selEnd = selection.end - (2 * (lastLine - firstLine + 1)) + (selection.end === lastLineStart+1 ? 2 : 0);
				} else {
					lines.splice(0, 0, "");
					text = lines.join("//");
					selStart = lineStart === selection.start ? selection.start : selection.start + 2;
					selEnd = selection.end + (2 * (lastLine - firstLine + 1));
				}
				editor.setText(text, lineStart, lineEnd);
				editor.setSelection(selStart, selEnd);
				return true;
			}.bind(this));
			
			function findEnclosingComment(model, start, end) {
				var open = "/*", close = "*/";
				var firstLine = model.getLineAtOffset(start);
				var lastLine = model.getLineAtOffset(end);
				var i, line, extent, openPos, closePos;
				var commentStart, commentEnd;
				for (i=firstLine; i >= 0; i--) {
					line = model.getLine(i);
					extent = (i === firstLine) ? start - model.getLineStart(firstLine) : line.length;
					openPos = line.lastIndexOf(open, extent);
					closePos = line.lastIndexOf(close, extent);
					if (closePos > openPos) {
						break; // not inside a comment
					} else if (openPos !== -1) {
						commentStart = model.getLineStart(i) + openPos;
						break;
					}
				}
				for (i=lastLine; i < model.getLineCount(); i++) {
					line = model.getLine(i);
					extent = (i === lastLine) ? end - model.getLineStart(lastLine) : 0;
					openPos = line.indexOf(open, extent);
					closePos = line.indexOf(close, extent);
					if (openPos !== -1 && openPos < closePos) {
						break;
					} else if (closePos !== -1) {
						commentEnd = model.getLineStart(i) + closePos;
						break;
					}
				}
				return {commentStart: commentStart, commentEnd: commentEnd};
			}
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding(191, true, true), "Add Block Comment");
			this.textView.setAction("Add Block Comment", function() {
				var editor = this.editor;
				var model = editor.getModel();
				var selection = editor.getSelection();
				var open = "/*", close = "*/", commentTags = new RegExp("/\\*" + "|" + "\\*/", "g");
				var firstLine = model.getLineAtOffset(selection.start);
				var lastLine = model.getLineAtOffset(selection.end);
				
				var result = findEnclosingComment(model, selection.start, selection.end);
				if (result.commentStart !== undefined && result.commentEnd !== undefined) {
					return true; // Already in a comment
				}
				
				var text = model.getText(selection.start, selection.end);
				if (text.length === 0) { return true; }
				
				var oldLength = text.length;
				text = text.replace(commentTags, "");
				var newLength = text.length;
				
				editor.setText(open + text + close, selection.start, selection.end);
				editor.setSelection(selection.start + open.length, selection.end + open.length + (newLength-oldLength));
				return true;
			}.bind(this));
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding(220, true, true), "Remove Block Comment");
			this.textView.setAction("Remove Block Comment", function() {
				var editor = this.editor;
				var model = editor.getModel();
				var selection = editor.getSelection();
				var open = "/*", close = "*/";
				var firstLine = model.getLineAtOffset(selection.start);
				var lastLine = model.getLineAtOffset(selection.end);
				
				// Try to shrink selection to a comment block
				var selectedText = model.getText(selection.start, selection.end);
				var newStart, newEnd;
				var i;
				for(i=0; i < selectedText.length; i++) {
					if (selectedText.substring(i, i + open.length) === open) {
						newStart = selection.start + i;
						break;
					}
				}
				for (; i < selectedText.length; i++) {
					if (selectedText.substring(i, i + close.length) === close) {
						newEnd = selection.start + i;
						break;
					}
				}
				
				if (newStart !== undefined && newEnd !== undefined) {
					editor.setText(model.getText(newStart + open.length, newEnd), newStart, newEnd + close.length);
					editor.setSelection(newStart, newEnd);
				} else {
					// Otherwise find enclosing comment block
					var result = findEnclosingComment(model, selection.start, selection.end);
					if (result.commentStart === undefined || result.commentEnd === undefined) {
						return true;
					}
					
					var text = model.getText(result.commentStart + open.length, result.commentEnd);
					editor.setText(text, result.commentStart, result.commentEnd + close.length);
					editor.setSelection(selection.start - open.length, selection.end - close.length);
				}
				return true;
			}.bind(this));
		},
		/**
		 * Called when a content assist proposal has been accepted. Inserts the proposal into the
		 * document. Activates Linked Mode if applicable for the selected proposal.
		 */
		contentAssistProposalAccepted: function(event) {
			/**
			 * The event.proposal may be either a simple string or an object with this shape:
			 * {   proposal: "[proposal string]", // Actual text of the proposal
			 *     positions: [{
			 *         offset: 10, // Offset of start position of parameter i
			 *         length: 3  // Length of parameter string for parameter i
			 *     }], // One object for each parameter; can be null
			 *     escapePosition: 19 // Offset that caret will be placed at after exiting Linked Mode; can be null
			 * }
			 * Offsets are relative to the text buffer.
			 */
			var proposalInfo = event.data.proposal;
			var proposal;
			if (typeof proposalInfo === "string") {
				proposal = proposalInfo;
			} else if (typeof proposalInfo.proposal === "string") {
				proposal = proposalInfo.proposal;
			}
			this.textView.setText(proposal, event.data.start, event.data.end);
			
			if (proposalInfo.positions && this.linkedMode) {
				var positionGroups = [];
				for (var i = 0; i < proposalInfo.positions.length; ++i) {
					positionGroups[i] = {
						positions: [{
							offset: proposalInfo.positions[i].offset,
							length: proposalInfo.positions[i].length
						}]
					};
				}

				var linkedModeModel = {
					groups: positionGroups,
					escapePosition: proposalInfo.escapePosition
				};
				this.linkedMode.enterLinkedMode(linkedModeModel);
			}
			return true;
		},
		cancel: function() {
			return false;
		},
		isActive: function() {
			return true;
		},
		isStatusActive: function() {
			// SourceCodeActions never reports status
			return false;
		},
		lineUp: function() {
			return false;
		},
		lineDown: function() {
			return false;
		},
		enter: function() {
			// Auto indent
			var editor = this.editor;
			var selection = editor.getSelection();
			if (selection.start === selection.end) {
				var model = editor.getModel();
				var lineIndex = model.getLineAtOffset(selection.start);
				var lineText = model.getLine(lineIndex, true);
				var lineStart = model.getLineStart(lineIndex);
				var index = 0, end = selection.start - lineStart, c;
				while (index < end && ((c = lineText.charCodeAt(index)) === 32 || c === 9)) { index++; }
				if (index > 0) {
					//TODO still wrong when typing inside folding
					var prefix = lineText.substring(0, index);
					index = end;
					while (index < lineText.length && ((c = lineText.charCodeAt(index++)) === 32 || c === 9)) { selection.end++; }
					editor.setText(model.getLineDelimiter() + prefix, selection.start, selection.end);
					return true;
				}
			}
			return false;
		}
	};
	return SourceCodeActions;
}());

orion.editor.LinkedMode = (function() {
	function LinkedMode(editor) {
		this.editor = editor;
		this.textView = editor.getTextView();
		
		/**
		 * The variables used by the Linked Mode. The elements of linkedModePositions have following structure:
		 * {
		 *     offset: 10, // The offset of the position counted from the beginning of the text buffer
		 *     length: 3 // The length of the position (selection)
		 * }
		 *
		 * The linkedModeEscapePosition contains an offset (counted from the beginning of the text buffer) of a
		 * position where the caret will be placed after exiting from the Linked Mode.
		 */
		this.linkedModeActive = false;
		this.linkedModePositions = [];
		this.linkedModeCurrentPositionIndex = 0;
		this.linkedModeEscapePosition = 0;
		
		/**
		 * Listener called when Linked Mode is active. Updates position's offsets and length
		 * on user change. Also escapes the Linked Mode if the text buffer was modified outside of the Linked Mode positions.
		 */
		this.linkedModeListener = {
			onVerify: function(event) {
				var changeInsideGroup = false;
				var offsetDifference = 0;
				for (var i = 0; i < this.linkedModePositions.length; ++i) {
					var position = this.linkedModePositions[i];
					if (changeInsideGroup) {
						// The change has already been noticed, update the offsets of all positions next to the changed one
						position.offset += offsetDifference;
					} else if (event.start >= position.offset && event.end <= position.offset + position.length) {
						// The change was done in the current position, update its length
						var oldLength = position.length;
						position.length = (event.start - position.offset) + event.text.length + (position.offset + position.length - event.end);
						offsetDifference = position.length - oldLength;
						changeInsideGroup = true;
					}
				}

				if (changeInsideGroup) {
					// Update escape position too
					this.linkedModeEscapePosition += offsetDifference;
				} else {
					// The change has been done outside of the positions, exit the Linked Mode
					this.cancel();
				}
			}.bind(this)
		};
	}
	LinkedMode.prototype = {
		/**
		 * Starts Linked Mode, selects the first position and registers the listeners.
		 * @parma {Object} linkedModeModel An object describing the model to be used by linked mode.
		 * Contains one or more position groups. If one positions in a group is edited, the other positions in the
		 * group are edited the same way. The structure is as follows:<pre>
		 * {
		 *     groups: [{
		 *         positions: [{
		 *             offset: 10, // Relative to the text buffer
		 *             length: 3
		 *         }]
		 *     }],
		 *     escapePosition: 19, // Relative to the text buffer
		 * }</pre>
		 */
		enterLinkedMode: function(linkedModeModel) {
			if (this.linkedModeActive) {
				return;
			}
			this.linkedModeActive = true;

			// NOTE: only the first position from each group is supported for now
			this.linkedModePositions = [];
			for (var i = 0; i < linkedModeModel.groups.length; ++i) {
				var group = linkedModeModel.groups[i];
				this.linkedModePositions[i] = {
					offset: group.positions[0].offset,
					length: group.positions[0].length
				};
			}

			this.linkedModeEscapePosition = linkedModeModel.escapePosition;
			this.linkedModeCurrentPositionIndex = 0;
			this.selectTextForLinkedModePosition(this.linkedModePositions[this.linkedModeCurrentPositionIndex]);

			this.textView.addEventListener("Verify", this, this.linkedModeListener.onVerify);

			this.textView.setKeyBinding(new orion.textview.KeyBinding(9), "nextLinkedModePosition");
			this.textView.setAction("nextLinkedModePosition", function() {
				// Switch to the next group on TAB key
				this.linkedModeCurrentPositionIndex = ++this.linkedModeCurrentPositionIndex % this.linkedModePositions.length;
				this.selectTextForLinkedModePosition(this.linkedModePositions[this.linkedModeCurrentPositionIndex]);
				return true;
			}.bind(this));
			
			this.textView.setKeyBinding(new orion.textview.KeyBinding(9, false, true), "previousLinkedModePosition");
			this.textView.setAction("previousLinkedModePosition", function() {
				this.linkedModeCurrentPositionIndex = this.linkedModeCurrentPositionIndex > 0 ? this.linkedModeCurrentPositionIndex-1 : this.linkedModePositions.length-1;
				this.selectTextForLinkedModePosition(this.linkedModePositions[this.linkedModeCurrentPositionIndex]);
				return true;
			}.bind(this));

			this.editor.reportStatus("Linked Mode entered");
		},
		isActive: function() {
			return this.linkedModeActive;
		},
		isStatusActive: function() {
			return this.linkedModeActive;
		},
		enter: function() {
			this.cancel();
			return true;
		},
		/** Exits Linked Mode. Places the caret at linkedModeEscapePosition. */
		cancel: function() {
			if (!this.linkedModeActive) {
				return;
			}
			this.linkedModeActive = false;
			this.textView.removeEventListener("Verify", this, this.linkedModeListener.onVerify);
			this.textView.setKeyBinding(new orion.textview.KeyBinding(9), "tab");
			this.textView.setKeyBinding(new orion.textview.KeyBinding(9, false, true), null);
			
			this.textView.setCaretOffset(this.linkedModeEscapePosition, false);

			this.editor.reportStatus("Linked Mode exited");
		},
		/**
		 * Updates the selection in the textView for given Linked Mode position.
		 */
		selectTextForLinkedModePosition: function(position) {
			this.textView.setSelection(position.offset, position.offset + position.length);
		}
	};
	return LinkedMode;
}());

if (typeof window !== "undefined" && typeof window.define !== "undefined") {
	define(['orion/textview/undoStack', 'orion/textview/keyBinding', 'orion/textview/rulers', 'orion/textview/annotations'], function() {
		return orion.editor;
	});
}
