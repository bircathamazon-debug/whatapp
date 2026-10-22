import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Documento HTML raíz de la versión web. Antes no existía este archivo
 * (Expo Router usaba su plantilla por defecto), así que la página nunca
 * tenía ícono/manifest — el "agregar a pantalla de inicio" usaba el
 * ícono genérico del framework. Esto define el ícono/manifest propios.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Citas Peluquería</title>
        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#00b4d8" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Citas Peluquería" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
