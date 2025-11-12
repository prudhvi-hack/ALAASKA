import React from 'react';
import ReactMarkdown from 'react-markdown';

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write in Markdown...',
  height = 300
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Editor</label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%',
            height,
            resize: 'vertical',
            padding: '0.75rem',
            borderRadius: 8,
            border: '1px solid #ccc',
            fontFamily: 'inherit'
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Preview</label>
        <div
          style={{
            width: '100%',
            height,
            overflowY: 'auto',
            padding: '0.75rem',
            borderRadius: 8,
            border: '1px solid #eee',
            background: '#fafafa'
          }}
        >
          <ReactMarkdown>{value || '_Nothing to preview_'}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}