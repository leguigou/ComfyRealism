import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

export const MarkdownLoader = ({ url }: { url: string }) => {
  const [content, setContent] = useState('');
  useEffect(() => {
    fetch(url).then(res => res.text()).then(setContent).catch(err => console.error('Error loading markdown:', err));
  }, [url]);
  return <ReactMarkdown>{content}</ReactMarkdown>;
};
