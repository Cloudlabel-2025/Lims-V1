"use client";

import { useEffect, useRef, useState } from "react";

export default function WysiwygEditor({ value, onChange, placeholder = "Enter details..." }) {
  const editorRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync value from props to editor content when value changes externally
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const handleCommand = (command, argument = null) => {
    if (typeof document !== "undefined") {
      document.execCommand(command, false, argument);
      handleInput();
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      // If content is just empty tags, normalize it to empty string
      if (html === "<br>" || html === "<div><br></div>" || html === "<p><br></p>" || html.trim() === "") {
        onChange("");
      } else {
        onChange(html);
      }
    }
  };

  if (!isMounted) {
    return <div className="wysiwyg-placeholder">Loading editor...</div>;
  }

  return (
    <div className="wysiwyg-container">
      <div className="wysiwyg-toolbar">
        <button
          type="button"
          onClick={() => handleCommand("bold")}
          title="Bold"
          className="wysiwyg-btn"
          style={{ fontWeight: "bold" }}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => handleCommand("italic")}
          title="Italic"
          className="wysiwyg-btn"
          style={{ fontStyle: "italic" }}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => handleCommand("underline")}
          title="Underline"
          className="wysiwyg-btn"
          style={{ textDecoration: "underline" }}
        >
          U
        </button>
        <span className="wysiwyg-divider" />
        <button
          type="button"
          onClick={() => handleCommand("insertUnorderedList")}
          title="Bullet List"
          className="wysiwyg-btn"
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => handleCommand("insertOrderedList")}
          title="Numbered List"
          className="wysiwyg-btn"
        >
          1. List
        </button>
        <span className="wysiwyg-divider" />
        <button
          type="button"
          onClick={() => handleCommand("removeFormat")}
          title="Clear Formatting"
          className="wysiwyg-btn text-danger"
        >
          Clear
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="wysiwyg-editor"
        data-placeholder={placeholder}
        style={{
          minHeight: "120px",
          maxHeight: "300px",
          overflowY: "auto",
          padding: "12px",
          outline: "none",
          background: "#fff",
        }}
      />

      <style jsx global>{`
        .wysiwyg-container {
          border: 1.5px solid var(--border, #edf2f7);
          border-radius: 8px;
          overflow: hidden;
          background: #fff;
          margin-top: 6px;
        }
        .wysiwyg-toolbar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: var(--surface-light, #f8fafc);
          border-bottom: 1.5px solid var(--border, #edf2f7);
        }
        .wysiwyg-btn {
          height: 28px;
          min-width: 28px;
          padding: 0 6px;
          border: 1px solid transparent;
          border-radius: 4px;
          background: transparent;
          color: var(--text-secondary, #475569);
          font-size: 13px;
          font-family: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 120ms ease;
        }
        .wysiwyg-btn:hover {
          background: var(--border, #edf2f7);
          color: var(--text-primary, #0f172a);
        }
        .wysiwyg-divider {
          width: 1px;
          height: 16px;
          background: var(--border, #edf2f7);
          margin: 0 4px;
        }
        .wysiwyg-editor {
          font-size: 14px;
          line-height: 1.5;
          color: var(--text-primary, #0f172a);
        }
        .wysiwyg-editor[contenteditable]:empty::before {
          content: attr(data-placeholder);
          color: var(--text-muted, #94a3b8);
          pointer-events: none;
        }
        .wysiwyg-editor ul, .wysiwyg-editor ol {
          margin: 0 0 10px 20px;
          padding: 0;
        }
        .wysiwyg-editor ul {
          list-style-type: disc;
        }
        .wysiwyg-editor ol {
          list-style-type: decimal;
        }
      `}</style>
    </div>
  );
}
