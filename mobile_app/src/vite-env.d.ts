/// <reference types="vite/client" />
import React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        poster?: string;
        alt?: string;
        autoplay?: boolean;
        'animation-name'?: string;
        'camera-controls'?: boolean;
        'camera-orbit'?: string;
        'field-of-view'?: string;
        'shadow-intensity'?: string;
        'shadow-softness'?: string;
        'disable-zoom'?: boolean;
        'disable-pan'?: boolean;
        'disable-tap'?: boolean;
        bounds?: string;
        exposure?: string;
        loading?: 'auto' | 'lazy' | 'eager';
      };
    }
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        poster?: string;
        alt?: string;
        autoplay?: boolean;
        'animation-name'?: string;
        'camera-controls'?: boolean;
        'camera-orbit'?: string;
        'field-of-view'?: string;
        'shadow-intensity'?: string;
        'shadow-softness'?: string;
        'disable-zoom'?: boolean;
        'disable-pan'?: boolean;
        'disable-tap'?: boolean;
        bounds?: string;
        exposure?: string;
        loading?: 'auto' | 'lazy' | 'eager';
      };
    }
  }
}

