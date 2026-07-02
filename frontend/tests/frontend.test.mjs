import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let vite;
let api;
let WelcomeScreen;
let MessageText;

before(async () => {
  vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });

  api = await vite.ssrLoadModule('/src/services/api.ts');
  ({ WelcomeScreen } = await vite.ssrLoadModule('/src/components/chat/WelcomeScreen.tsx'));
  ({ MessageText } = await vite.ssrLoadModule('/src/components/chat/MessageText.tsx'));
});

after(async () => {
  await vite.close();
});

test('formats generation durations and storage sizes', () => {
  assert.equal(api.formatDuration(9), '9s');
  assert.equal(api.formatDuration(65), '1m05s');
  assert.equal(api.formatBytes(0), '0 B');
  assert.equal(api.formatBytes(1024), '1 KB');
});

test('renders the localized welcome screen', () => {
  const french = renderToStaticMarkup(React.createElement(WelcomeScreen, { lang: 'fr' }));
  const english = renderToStaticMarkup(React.createElement(WelcomeScreen, { lang: 'en' }));

  assert.match(french, /Que souhaitez-vous créer/);
  assert.match(english, /What would you like to create/);
});

test('truncates long message text while keeping short text intact', () => {
  const shortText = 'Portrait cinématique';
  const longText = 'a'.repeat(180);
  const shortMarkup = renderToStaticMarkup(React.createElement(MessageText, { text: shortText, lang: 'fr' }));
  const longMarkup = renderToStaticMarkup(React.createElement(MessageText, { text: longText, lang: 'fr' }));

  assert.match(shortMarkup, /Portrait cinématique/);
  assert.doesNotMatch(shortMarkup, /read-more-btn/);
  assert.match(longMarkup, /class="message-text truncated"/);
  assert.match(longMarkup, /Voir plus/);
  assert.doesNotMatch(longMarkup, new RegExp('a{180}'));
});
