import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import '../styles/latex_editor.css';

export default function LatexEditor({ value, onChange, onSubmit, placeholder }) {
  const textareaRef = useRef(null);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Smart text replacements
  const smartReplacements = {
    '->': '\\rightarrow',
    '=>': '\\Rightarrow',
    '>=': '\\ge',
    '<=': '\\le',
    '!=': '\\ne',
    '/\\': '\\wedge',
    '\\/': '\\vee',
    '~': '\\neg',
    '|-': '\\vdash',
  };

  // Toolbar buttons with LaTeX symbols
  const toolbarButtons = [
    { label: 'λ', insert: '\\lambda', title: 'Lambda', needsMath: true },
    { label: '→', insert: '\\rightarrow', title: 'Arrow', needsMath: true },
    { label: '⇒', insert: '\\Rightarrow', title: 'Implication', needsMath: true },
    { label: '⊢', insert: '\\vdash', title: 'Turnstile', needsMath: true },
    { label: 'α', insert: '\\alpha', title: 'Alpha', needsMath: true },
    { label: 'Γ', insert: '\\Gamma', title: 'Gamma (context)', needsMath: true },
    { label: '∧', insert: '\\wedge', title: 'AND', needsMath: true },
    { label: '∨', insert: '\\vee', title: 'OR', needsMath: true },
    { label: '¬', insert: '\\neg', title: 'NOT', needsMath: true },
    { label: '≤', insert: '\\le', title: 'Less than or equal', needsMath: true },
    { label: '≥', insert: '\\ge', title: 'Greater than or equal', needsMath: true },
    { label: '≠', insert: '\\ne', title: 'Not equal', needsMath: true },
    { label: '{ }', insert: '\\{ \\}', title: 'Braces (Hoare triples)', needsMath: true },
    { label: ':=', insert: ':=', title: 'Assignment', needsMath: false },
    { label: 'wp', insert: '\\text{wp}', title: 'Weakest precondition', needsMath: true },
    // ✅ NEW: Subscript and Superscript buttons
    { label: 'x₁', insert: '_{1}', title: 'Subscript (e.g., x₁)', needsMath: true, moveCursorBack: 1 },
    { label: 'x²', insert: '^{2}', title: 'Superscript (e.g., x²)', needsMath: true, moveCursorBack: 1 },
    { 
      label: 'Inference', 
      insert: '$$\\frac{\\text{premises}}{\\text{conclusion}}$$', 
      title: 'Inference rule template',
      isBlock: true,
      needsMath: false
    },
  ];

  // ✅ FIXED: Handle smart replacements as user types
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    
    // Check for smart replacements
    let replaced = false;
    for (const [pattern, replacement] of Object.entries(smartReplacements)) {
      if (newValue.endsWith(pattern)) {
        // ✅ FIX: Remove the pattern and add replacement
        const beforePattern = newValue.slice(0, -pattern.length);
        const afterCursor = newValue.slice(cursorPos); // Get text after cursor
        const replacedValue = beforePattern + replacement + afterCursor;
        
        onChange({ target: { value: replacedValue } });
        replaced = true;
        
        // ✅ FIX: Set cursor position correctly after replacement
        const newCursorPos = beforePattern.length + replacement.length;
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = newCursorPos;
        }, 0);
        break;
      }
    }
    
    if (!replaced) {
      onChange(e);
    }
  };

  // ✅ UPDATED: Insert text at cursor position with optional math mode wrapping and cursor positioning
  const insertAtCursor = (text, isBlock = false, needsMath = false, moveCursorBack = 0) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = value || '';
    
    let newValue;
    let newCursorPos;
    
    // Wrap in math mode if needed
    let textToInsert = text;
    if (needsMath && !isBlock) {
      // Check if we're already inside math mode
      const beforeCursor = currentValue.substring(0, start);
      
      // Simple check: count $ symbols before cursor
      const dollarsBeforeCursor = (beforeCursor.match(/\$/g) || []).length;
      const isInMathMode = dollarsBeforeCursor % 2 === 1;
      
      if (!isInMathMode) {
        textToInsert = `$${text}$ `;
      }
    }
    
    if (isBlock) {
      // For block elements, add newlines
      newValue = currentValue.substring(0, start) + '\n' + textToInsert + '\n' + currentValue.substring(end);
      newCursorPos = start + textToInsert.length + 1;
    } else {
      newValue = currentValue.substring(0, start) + textToInsert + currentValue.substring(end);
      newCursorPos = start + textToInsert.length - moveCursorBack;
    }
    
    onChange({ target: { value: newValue } });
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = newCursorPos;
    }, 0);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      onSubmit?.();
    }
    
    // Track cursor position
    setCursorPosition(e.target.selectionStart);
  };

  // Preprocess LaTeX for rendering
  const preprocessLatex = (text) => {
    if (!text) return text;
    
    return text
      .replace(/\\\[/g, '$$')
      .replace(/\\\]/g, '$$')
      .replace(/\\\(/g, '$')
      .replace(/\\\)/g, '$');
  };

  return (
    <div className="latex-editor">
      {/* Toolbar */}
      <div className="latex-toolbar">
        <div className="toolbar-section">
          <span className="toolbar-label">Quick Insert:</span>
          {toolbarButtons.map((btn, idx) => (
            <button
              key={idx}
              onClick={() => insertAtCursor(btn.insert, btn.isBlock, btn.needsMath, btn.moveCursorBack)}
              className="toolbar-button"
              title={btn.title}
              type="button"
            >
              {btn.label}
            </button>
          ))}
        </div>
        <div className="toolbar-hint">
          Tip: Type -&gt; for →, =&gt; for ⇒, &gt;= for ≥, &lt;= for ≤ | Use x₁ and x² for subscript/superscript | Auto-wrapped in math mode ($...$)
        </div>
      </div>

      {/* Split pane editor */}
      <div className="split-pane">
        {/* Left: Input area */}
        <div className="editor-pane">
          <div className="pane-header">
            <span className="pane-title">📝 Input (Markdown + LaTeX)</span>
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "Type your answer using Markdown and LaTeX...\n\nInline math: $x + y$\nBlock math: $$\\frac{a}{b}$$\nSubscript: $x_{1}$\nSuperscript: $x^{2}$\n\nPress Ctrl+Enter to submit"}
            className="latex-input"
          />
        </div>

        {/* Right: Live preview */}
        <div className="preview-pane">
          <div className="pane-header">
            <span className="pane-title">👁️ Live Preview</span>
          </div>
          <div className="latex-preview">
            {value ? (
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {preprocessLatex(value)}
              </ReactMarkdown>
            ) : (
              <div className="preview-placeholder">
                Preview will appear here as you type...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}