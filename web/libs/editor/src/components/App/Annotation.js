import Tree from "../../core/Tree";
import { isAlive } from "mobx-state-tree";
import { useLayoutEffect } from "react";

export function Annotation({ annotation, root }) {
  const addedScripts = [];

  useLayoutEffect(() => {
    if (!root) return undefined;

    const platforms = {
      Twitter: { regex: /twitter\.com/, script: "https://platform.twitter.com/widgets.js" },
      TikTok: { regex: /tiktok-embed/, script: "https://www.tiktok.com/embed.js" },
      // Telegram: { regex: /telegram-post/, script: 'https://telegram.org/js/telegram-widget.js?' },
      Instagram: {
        regex: /instagram\.com/,
        script: "https://www.instagram.com/embed.js",
        postLoad: () => window.instgrm?.Embeds?.process(),
      },
      Facebook: {
        regex: /facebook\.com/,
        script: "https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v18.0",
        postLoad: () => window.FB?.XFBML?.parse(),
      },
    };

    const addScript = (src, charset = "utf-8", postLoad) => {
      const script = document.createElement("script");
      script.async = true;
      script.src = src;
      script.charset = charset;
      if (postLoad) script.onload = postLoad;
      document.body.appendChild(script);
      addedScripts.push(script);
    };

    const isPlatformPresentDeep = (node, regex) => {
      if (!node) return false;
      const valueMatch = typeof node._value === "string" && regex.test(node._value);
      const childrenMatch =
        Array.isArray(node.children) && node.children.some((child) => isPlatformPresentDeep(child, regex));
      return valueMatch || childrenMatch;
    };

    Object.values(platforms).forEach(({ regex, script, postLoad }) => {
      if (isPlatformPresentDeep(root, regex)) addScript(script, "utf-8", postLoad);
    });

    return () => {
      if (annotation && isAlive(annotation)) {
        annotation.resetReady();
      }
      addedScripts.forEach((script) => document.body.removeChild(script));
      addedScripts.length = 0;
    };
  }, [annotation, root]);

  return root ? Tree.renderItem(root, annotation) : null;
}
