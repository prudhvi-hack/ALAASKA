import React, { useState, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import api from '../api/axios';

export default function ChatView({ activeChatId, onNewChat }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (activeChatId) {
      loadConversation(activeChatId);
    } else {
      setMessages([]);
    }
  }, [activeChatId]);

  const loadConversation = async (chatId) => {
    try {
      const res = await api.get(`/conversation/${chatId}`);
      
      //  Handle new response format with messages and metadata
      const conversationMessages = res.data.messages || res.data || [];
      
      // Filter out system messages for display
      const filteredMessages = conversationMessages.filter(msg => msg.role !== 'system');
      setMessages(filteredMessages);
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    // Add loading indicator
    setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);
    setIsLoading(true);

    try {
      const res = await api.post('/chat', {
        message: userMessage,
        chat_id: activeChatId || undefined,
      });

      // Remove loading indicator and add actual response
      setMessages(prev => {
        const withoutLoader = prev.slice(0, -1);
        return [...withoutLoader, { role: 'assistant', content: res.data.response }];
      });

      // If new chat was created, notify parent
      if (res.data.chat_id && res.data.chat_id !== activeChatId) {
        onNewChat?.(res.data.chat_id);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      
      // Remove loading indicator and show error
      setMessages(prev => {
        const withoutLoader = prev.slice(0, -1);
        return [...withoutLoader, { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error. Please try again.' 
        }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ChatInterface
      chatId={activeChatId}
      messages={messages}
      input={input}
      setInput={setInput}
      sendMessage={sendMessage}
    />
  );
}