import React, { useState, useRef, useEffect } from 'react';
import '../styles/latex_editor.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax';

export default function LatexEditor({ value, onChange, onSubmit, placeholder }) {
  const textareaRef = useRef(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [history, setHistory] = useState([value || '']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoRedoRef = useRef(false);
  const typingTimerRef = useRef(null);
  const lastSavedValueRef = useRef(value || '');

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, []);


  useEffect(() => {
    if (textareaRef.current && value) {
      const length = value.length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(length, length);
    }
  }, []);

  const saveToHistory = (newValue) => {
    if (newValue !== lastSavedValueRef.current) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newValue);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      lastSavedValueRef.current = newValue;
    }
  };
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    
    // Don't save to history during undo/redo
    if (!isUndoRedoRef.current) {
      // Clear existing timer
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      
      // Check if user pressed space
      const lastChar = newValue[newValue.length - 1];
      if (lastChar === ' ' || lastChar === '\n') {
        saveToHistory(newValue);
      } else {
        // Save after 500ms of no typing
        typingTimerRef.current = setTimeout(() => {
          saveToHistory(newValue);
        }, 500);
      }
    }
    isUndoRedoRef.current = false;
    
    onChange(e);
  };

  // ✅ ADD: Undo function
const handleUndo = () => {
   if (historyIndex > 0) {
    isUndoRedoRef.current = true;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    onChange({ target: { value: history[newIndex] } });
    lastSavedValueRef.current = history[newIndex];
  }
};

// ✅ ADD: Redo function
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true;
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onChange({ target: { value: history[newIndex] } });
      lastSavedValueRef.current = history[newIndex];
    }
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
    { label: '*', insert: '\\ast', title: 'Asterisk (multiplication/star)', needsMath: true },
    { label: 'x₁', insert: '_{1}', title: 'Subscript (e.g., x₁)', needsMath: true, moveCursorBack: 1 },
    { label: 'x²', insert: '^{2}', title: 'Superscript (e.g., x²)', needsMath: true, moveCursorBack: 1 }
  ];

 const inferenceTemplates = [
  // Type 1: Simple inference rule
  { 
    label: 'Simple Rule', 
    insert: '$$\\dfrac{\\text{premise}}{\\Gamma \\vdash \\text{conclusion}} \\quad (\\text{RULE-NAME})$$', 
    title: 'Simple inference rule with premise ⊢ conclusion',
    isBlock: true,
    needsMath: false
  },
  
  // Type 2: Inference with 2 premises (side by side)
  { 
    label: '2 Premises', 
    insert: '$$\\dfrac{\\Gamma \\vdash \\text{premise}_1 \\quad \\Gamma \\vdash \\text{premise}_2}{\\Gamma \\vdash \\text{conclusion}} \\quad (\\text{RULE})$$', 
    title: 'Inference with 2 premises side by side',
    isBlock: true,
    needsMath: false
  },
  
  // Type 3: Double nested (2 levels)
  { 
    label: 'Double Nested', 
    insert: '$$\\dfrac{\\dfrac{\\Gamma \\vdash \\text{premise}_1}{\\Gamma \\vdash \\text{premise}_2} \\quad (\\text{SUB-RULE}) \\quad \\Gamma \\vdash \\text{premise}_3}{\\Gamma \\vdash \\text{conclusion}} \\quad (\\text{MAIN-RULE})$$', 
    title: 'Double nested inference (2 levels deep) with rule labels',
    isBlock: true,
    needsMath: false
  },
  
  // Type 4: Triple nested (3 levels)
  { 
    label: 'Triple Nested', 
    insert: '$$\\dfrac{\\dfrac{\\dfrac{\\Gamma \\vdash \\text{premise}_1}{\\Gamma \\vdash \\text{premise}_2} \\quad (\\text{L2-RULE}) \\quad \\Gamma \\vdash \\text{premise}_3}{\\Gamma \\vdash \\text{premise}_4} \\quad (\\text{L1-RULE}) \\quad \\Gamma \\vdash \\text{premise}_5}{\\Gamma \\vdash \\text{conclusion}} \\quad (\\text{MAIN-RULE})$$', 
    title: 'Triple nested inference (3 levels deep) with rule labels at each level',
    isBlock: true,
    needsMath: false
  },
  
  // Type 5: Quad nested (4 levels)
  { 
    label: '4-Level Nested', 
    insert: '$$\\dfrac{\\dfrac{\\dfrac{\\dfrac{\\Gamma \\vdash \\text{premise}_1}{\\Gamma \\vdash \\text{premise}_2} \\quad (\\text{L3-RULE})}{\\Gamma \\vdash \\text{premise}_3} \\quad (\\text{L2-RULE})}{\\Gamma \\vdash \\text{premise}_4} \\quad (\\text{L1-RULE})}{\\Gamma \\vdash \\text{conclusion}} \\quad (\\text{MAIN-RULE})$$', 
    title: 'Four levels of nested inference with rule labels at each level',
    isBlock: true,
    needsMath: false
  },
  
  // Type 6: Five nested (5 levels)
  { 
    label: '5-Level Nested', 
    insert: '$$\\dfrac{\\dfrac{\\dfrac{\\dfrac{\\dfrac{\\Gamma \\vdash \\text{premise}_1}{\\Gamma \\vdash \\text{premise}_2} \\quad (\\text{L4-RULE})}{\\Gamma \\vdash \\text{premise}_3} \\quad (\\text{L3-RULE})}{\\Gamma \\vdash \\text{premise}_4} \\quad (\\text{L2-RULE})}{\\Gamma \\vdash \\text{premise}_5} \\quad (\\text{L1-RULE})}{\\Gamma \\vdash \\text{conclusion}} \\quad (\\text{MAIN-RULE})$$', 
    title: 'Five levels of nested inference with rule labels at each level',
    isBlock: true,
    needsMath: false
  },
];



const insertAtCursor = (text, isBlock = false, needsMath = false, moveCursorBack = 0) => {
  const textarea = textareaRef.current;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const currentValue = value || '';
  
  let newValue;
  let newCursorPos;
  
  // ✅ UPDATED: Auto-detect math mode for ALL insertions (including blocks)
  const beforeCursor = currentValue.substring(0, start);
  const afterCursor = currentValue.substring(start);
  
  // Count $$ pairs before cursor
  const doubleDollarsBeforeCursor = (beforeCursor.match(/\$\$/g) || []).length;
  
  // Count single $ (but not $$) before cursor
  const beforeWithoutDouble = beforeCursor.replace(/\$\$/g, '');
  const singleDollarsBeforeCursor = (beforeWithoutDouble.match(/\$/g) || []).length;
  
  // Check if we're inside $$...$$ block (display math)
  const inDisplayMath = doubleDollarsBeforeCursor % 2 === 1;
  
  // Check if we're inside $...$ block (inline math)
  const inInlineMath = !inDisplayMath && (singleDollarsBeforeCursor % 2 === 1);
  
  const inAnyMathMode = inDisplayMath || inInlineMath;
  
  let textToInsert = text;
  
  // ✅ NEW: Handle block templates
  if (isBlock) {
    // Strip $$ from block templates if we're already in math mode
    if (inAnyMathMode && text.startsWith('$$') && text.endsWith('$$')) {
      // Remove outer $$...$$ wrapper
      textToInsert = text.slice(2, -2);
      // Insert inline without newlines
      newValue = currentValue.substring(0, start) + textToInsert + currentValue.substring(end);
      newCursorPos = start + textToInsert.length;
    } else {
      // Normal block insertion with newlines
      newValue = currentValue.substring(0, start) + '\n' + textToInsert + '\n' + currentValue.substring(end);
      newCursorPos = start + textToInsert.length + 1;
    }
  } else {
    // ✅ Handle inline symbols
    if (needsMath && !inAnyMathMode) {
      textToInsert = `$${text}$ `;
    }
    newValue = currentValue.substring(0, start) + textToInsert + currentValue.substring(end);
    newCursorPos = start + textToInsert.length - moveCursorBack;
  }
  
  onChange({ target: { value: newValue } });
  
  // Save to history after template insertion
  saveToHistory(newValue);
  
  // Restore cursor position
  setTimeout(() => {
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = newCursorPos;
  }, 0);
};

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
  // ✅ ADD: Ctrl+Z for undo
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
      return;
    }
    
    // ✅ ADD: Ctrl+Shift+Z or Ctrl+Y for redo
    if ((e.ctrlKey && e.shiftKey && e.key === 'Z') || (e.ctrlKey && e.key === 'y')) {
      e.preventDefault();
      handleRedo();
      return;
    }
    
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
        <div className="toolbar-section inference-section">
          <span className="toolbar-label">Inference Rules:</span>
          {inferenceTemplates.map((btn, idx) => (
            <button
              key={`inf-${idx}`}
              onClick={() => insertAtCursor(btn.insert, btn.isBlock, btn.needsMath, btn.moveCursorBack)}
              className="toolbar-button inference-button"
              title={btn.title}
              type="button"
            >
              {btn.label}
            </button>
          ))}
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
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeMathjax]}
                components={{
                  code({node, inline, className, children, ...props}) {
                    return inline ? (
                      <code className="inline-code" {...props}>
                        {children}
                      </code>
                    ) : (
                      <pre className="code-block">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    );
                  }
                }}
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