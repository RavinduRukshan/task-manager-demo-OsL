'use client';
import * as React from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { CacheProvider } from '@emotion/react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import createCache from '@emotion/cache';
import theme from '../theme/theme';

/**
 * ThemeRegistry sets up MUI's Emotion CSS-in-JS for Next.js App Router.
 * It collects styles during SSR and injects them into the <head> before
 * hydration, preventing the flash of unstyled content.
 */
export default function ThemeRegistry({ children }) {
  const [{ cache, flush }] = React.useState(() => {
    const emotionCache = createCache({ key: 'mui' });
    emotionCache.compat = true;
    const prevInsert = emotionCache.insert;
    let inserted = [];
    emotionCache.insert = (...args) => {
      const serialized = args[1];
      if (emotionCache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }
      return prevInsert(...args);
    };
    const flush = () => {
      const prevInserted = inserted;
      inserted = [];
      return prevInserted;
    };
    return { cache: emotionCache, flush };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) return null;
    let styles = '';
    for (const name of names) {
      styles += cache.inserted[name];
    }
    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
