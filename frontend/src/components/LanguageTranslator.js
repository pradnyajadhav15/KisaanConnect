import React, { useState, useCallback, useEffect, useRef } from 'react';
import '../styles/LanguageTranslator.css';

const INCLUDED_LANGUAGES = 'en,hi,bn,te,ta,mr,gu,kn,ml,pa,ur';

const LanguageTranslator = () => {
  const [isVisible, setIsVisible]   = useState(false);
  const scriptLoaded                = useRef(false);

  // Close on Escape
  useEffect(() => {
    if (!isVisible) return;
    const handler = (e) => { if (e.key === 'Escape') setIsVisible(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isVisible]);

  const loadGoogleTranslate = useCallback(() => {
    if (scriptLoaded.current) return;
    scriptLoaded.current = true;

    window.googleTranslateElementInit = () => {
      try {
        new window.google.translate.TranslateElement(
          {
            pageLanguage:      'en',
            includedLanguages: INCLUDED_LANGUAGES,
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false,
          },
          'google_translate_element'
        );
      } catch {
        // silently fail
      }
    };

    const script = document.createElement('script');
    script.type    = 'text/javascript';
    script.charset = 'UTF-8';
    script.src     = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async   = true;
    document.head.appendChild(script);
  }, []);

  const toggleTranslator = useCallback(() => {
    setIsVisible(prev => !prev);
    loadGoogleTranslate();
  }, [loadGoogleTranslate]);

  return (
    <div className="language-translator">
      <button
        className="translator-toggle-btn"
        onClick={toggleTranslator}
        aria-expanded={isVisible}
        aria-controls="google_translate_element"
        title="Translate Page"
      >
        🌐 Translate
      </button>

      <div
        id="google_translate_element"
        className={`translator-dropdown ${isVisible ? 'visible' : ''}`}
        aria-hidden={!isVisible}
      />
    </div>
  );
};

export default LanguageTranslator;