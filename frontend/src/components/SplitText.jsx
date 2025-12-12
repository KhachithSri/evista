import { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const SplitText = ({
  text,
  className = '',
  delay = 100,
  duration = 0.6,
  ease = 'power3.out',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = '-100px',
  textAlign = 'center',
  tag = 'p',
  onLetterAnimationComplete
}) => {
  const ref = useRef(null);
  const animationCompletedRef = useRef(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    if (document.fonts.status === 'loaded') {
      setFontsLoaded(true);
    } else {
      document.fonts.ready.then(() => {
        setFontsLoaded(true);
      });
    }
  }, []);

  // Simple split function without GSAP SplitText plugin
  const splitTextIntoChars = (element) => {
    const textContent = element.textContent;
    element.innerHTML = '';
    
    if (splitType === 'chars') {
      textContent.split('').forEach((char) => {
        const span = document.createElement('span');
        span.className = 'split-char';
        span.style.display = 'inline-block';
        span.textContent = char === ' ' ? '\u00A0' : char;
        element.appendChild(span);
      });
    } else if (splitType === 'words') {
      textContent.split(' ').forEach((word, index) => {
        const span = document.createElement('span');
        span.className = 'split-word';
        span.style.display = 'inline-block';
        span.textContent = word;
        element.appendChild(span);
        if (index < textContent.split(' ').length - 1) {
          element.appendChild(document.createTextNode(' '));
        }
      });
    }
    
    return element.querySelectorAll(splitType === 'chars' ? '.split-char' : '.split-word');
  };

  useGSAP(
    () => {
      if (!ref.current || !text || !fontsLoaded) return;
      const el = ref.current;

      const startPct = (1 - threshold) * 100;
      const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin);
      const marginValue = marginMatch ? parseFloat(marginMatch[1]) : 0;
      const marginUnit = marginMatch ? marginMatch[2] || 'px' : 'px';
      const sign =
        marginValue === 0
          ? ''
          : marginValue < 0
            ? `-=${Math.abs(marginValue)}${marginUnit}`
            : `+=${marginValue}${marginUnit}`;
      const start = `top ${startPct}%${sign}`;

      const targets = splitTextIntoChars(el);

      const tween = gsap.fromTo(
        targets,
        { ...from },
        {
          ...to,
          duration,
          ease,
          stagger: delay / 1000,
          scrollTrigger: {
            trigger: el,
            start,
            once: true,
            fastScrollEnd: true,
            anticipatePin: 0.4
          },
          onComplete: () => {
            animationCompletedRef.current = true;
            onLetterAnimationComplete?.();
          },
          willChange: 'transform, opacity',
          force3D: true
        }
      );

      return () => {
        ScrollTrigger.getAll().forEach(st => {
          if (st.trigger === el) st.kill();
        });
        if (tween) tween.kill();
      };
    },
    {
      dependencies: [
        text,
        delay,
        duration,
        ease,
        splitType,
        JSON.stringify(from),
        JSON.stringify(to),
        threshold,
        rootMargin,
        fontsLoaded,
        onLetterAnimationComplete
      ],
      scope: ref
    }
  );

  const renderTag = () => {
    const style = {
      textAlign,
      overflow: 'hidden',
      display: 'inline-block',
      whiteSpace: 'normal',
      wordWrap: 'break-word',
      willChange: 'transform, opacity'
    };
    const classes = `split-parent ${className}`;
    
    const props = {
      ref,
      style,
      className: classes,
      children: text
    };

    switch (tag) {
      case 'h1':
        return <h1 {...props} />;
      case 'h2':
        return <h2 {...props} />;
      case 'h3':
        return <h3 {...props} />;
      case 'h4':
        return <h4 {...props} />;
      case 'h5':
        return <h5 {...props} />;
      case 'h6':
        return <h6 {...props} />;
      default:
        return <p {...props} />;
    }
  };
  
  return renderTag();
};

export default SplitText;
