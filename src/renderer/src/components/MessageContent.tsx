import { useMemo, useState, useCallback, type ReactNode, type JSX } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageContentProps {
  content: string;
  query?: string;
}

export default function MessageContent({
  content,
  query,
}: MessageContentProps): JSX.Element {
  const trimmed = content.trim();

  // Standalone JSON gets its own dedicated renderer
  if (isJSON(trimmed)) {
    return (
      <div className="message-content">
        <JSONBlock content={trimmed} query={query} />
      </div>
    );
  }

  return (
    <div className="message-content">
      <MarkdownRenderer content={content} query={query} />
    </div>
  );
}

// ─── Markdown Renderer ───────────────────────────────────────────────

function MarkdownRenderer({
  content,
  query,
}: {
  content: string;
  query?: string;
}): JSX.Element {
  // Wrap children with query highlighting (pure React, no DOM mutation)
  const hl = useCallback(
    (children: ReactNode): ReactNode =>
      query ? highlightChildren(children, query) : children,
    [query],
  );

  const components = useMemo<Components>(
    () => ({
      // Code blocks & inline code
      code({ className, children }) {
        const langMatch = /language-(\w+)/.exec(className || "");
        const codeString = String(children).replace(/\n$/, "");

        if (langMatch) {
          return (
            <CodeBlock
              language={langMatch[1]}
              code={codeString}
              query={query}
            />
          );
        }

        if (codeString.includes("\n")) {
          return <CodeBlock language="text" code={codeString} query={query} />;
        }

        // Inline code
        return <code className="inline-code">{hl(children)}</code>;
      },

      pre({ children }) {
        return <>{children}</>;
      },

      // Tables
      table({ children }) {
        return (
          <div className="my-3 overflow-x-auto rounded-lg border border-neutral-700">
            <table className="md-table">{children}</table>
          </div>
        );
      },
      thead({ children }) {
        return <thead className="bg-neutral-800/80">{children}</thead>;
      },
      th({ children }) {
        return (
          <th className="border-b border-neutral-700 px-3 py-2 text-left text-xs font-semibold text-neutral-300">
            {hl(children)}
          </th>
        );
      },
      td({ children }) {
        return (
          <td className="border-b border-neutral-800 px-3 py-2 text-xs text-neutral-300">
            {hl(children)}
          </td>
        );
      },

      // Headings
      h1({ children }) {
        return (
          <h1 className="mt-4 mb-2 border-b border-neutral-700 pb-1 text-xl font-bold text-neutral-100">
            {hl(children)}
          </h1>
        );
      },
      h2({ children }) {
        return (
          <h2 className="mt-4 mb-2 text-lg font-semibold text-neutral-100">
            {hl(children)}
          </h2>
        );
      },
      h3({ children }) {
        return (
          <h3 className="mt-3 mb-1 text-base font-semibold text-neutral-200">
            {hl(children)}
          </h3>
        );
      },
      h4({ children }) {
        return (
          <h4 className="mt-2 mb-1 text-sm font-semibold text-neutral-200">
            {hl(children)}
          </h4>
        );
      },

      // Paragraphs
      p({ children }) {
        return <p className="my-1.5 leading-relaxed">{hl(children)}</p>;
      },

      // Lists
      ul({ children }) {
        return (
          <ul className="my-1.5 ml-5 list-disc space-y-0.5">{children}</ul>
        );
      },
      ol({ children }) {
        return (
          <ol className="my-1.5 ml-5 list-decimal space-y-0.5">{children}</ol>
        );
      },
      li({ children }) {
        return <li className="leading-relaxed">{hl(children)}</li>;
      },

      // Blockquotes
      blockquote({ children }) {
        return (
          <blockquote className="border-claude-orange/50 my-2 border-l-3 pl-3 text-neutral-400 italic">
            {hl(children)}
          </blockquote>
        );
      },

      // Links
      a({ href, children }) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
          >
            {hl(children)}
          </a>
        );
      },

      // Horizontal rule
      hr() {
        return <hr className="my-3 border-neutral-700" />;
      },

      // Strong / em
      strong({ children }) {
        return (
          <strong className="font-semibold text-neutral-100">
            {hl(children)}
          </strong>
        );
      },
      em({ children }) {
        return <em className="text-neutral-200 italic">{hl(children)}</em>;
      },
    }),
    [hl, query],
  );

  return (
    <div className="md-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ─── Search Highlighting (pure React) ────────────────────────────────

/**
 * Recursively walk React children. When a raw string is found, split it on
 * the query and wrap matches in <span class="highlight">.
 * Non-string children (elements) are returned as-is — their own component
 * overrides handle highlighting at their level.
 */
function highlightChildren(children: ReactNode, query: string): ReactNode {
  if (!query) return children;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");

  const walk = (node: ReactNode): ReactNode => {
    if (typeof node === "string") {
      const parts = node.split(regex);
      if (parts.length === 1) return node;
      return parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="highlight">
            {part}
          </span>
        ) : (
          part
        ),
      );
    }
    // Leave non-string children untouched (elements handle their own hl())
    return node;
  };

  if (Array.isArray(children)) {
    return children.map((child, i) => {
      const result = walk(child);
      // Only wrap in a keyed fragment if the walk produced an array
      return Array.isArray(result) ? <span key={i}>{result}</span> : result;
    });
  }
  return walk(children);
}

// ─── Code Block ──────────────────────────────────────────────────────

function CodeBlock({
  language,
  code,
  query,
}: {
  language: string;
  code: string;
  query?: string;
}): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy errors
    }
  }, [code]);

  const highlighted = useMemo(() => {
    const html = highlightCode(code, language);
    return query ? addSearchHighlightToHtml(html, query) : html;
  }, [code, language, query]);

  return (
    <div className="code-block-wrapper group relative my-3">
      <div className="flex items-center justify-between rounded-t-lg border-x border-t border-neutral-700 bg-neutral-900 px-3 py-2">
        <span className="font-mono text-xs text-neutral-500">{language}</span>
        <button
          onClick={handleCopy}
          className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-xs text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-neutral-700 hover:text-neutral-200"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-b-lg border border-neutral-700 bg-neutral-950 p-4">
        <code
          className={`language-${language} text-sm`}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  );
}

// ─── JSON Block ──────────────────────────────────────────────────────

function JSONBlock({
  content,
  query,
}: {
  content: string;
  query?: string;
}): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const formatted = useMemo(() => {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }, [content]);

  const highlighted = useMemo(() => {
    const html = highlightJSON(formatted);
    return query ? addSearchHighlightToHtml(html, query) : html;
  }, [formatted, query]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  }, [formatted]);

  return (
    <div className="json-block-wrapper group relative my-3">
      <div className="flex items-center justify-between rounded-t-lg border-x border-t border-purple-700/50 bg-gradient-to-r from-purple-900/20 to-blue-900/20 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-purple-400">JSON</span>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            {collapsed ? "▶ Expand" : "▼ Collapse"}
          </button>
        </div>
        <button
          onClick={handleCopy}
          className="rounded border border-purple-700/50 bg-purple-900/30 px-2 py-1 text-xs text-purple-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-purple-800/40 hover:text-purple-200"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      {!collapsed && (
        <pre className="max-h-96 overflow-auto rounded-b-lg border border-purple-700/50 bg-neutral-950 p-4">
          <code
            className="language-json text-sm"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function isJSON(str: string): boolean {
  if (!str.startsWith("{") && !str.startsWith("[")) return false;
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Apply search highlighting to an already-rendered HTML string.
 * Only highlights text content between HTML tags, leaving tags intact.
 */
function addSearchHighlightToHtml(html: string, query: string): string {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const searchRegex = new RegExp(escaped, "gi");
  // Split into HTML tags vs text content; only highlight text parts
  return html.replace(
    /(<[^>]*>)|([^<]+)/g,
    (_match, tag: string, text: string) => {
      if (tag) return tag;
      return text.replace(searchRegex, '<span class="highlight">$&</span>');
    },
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function highlightJSON(json: string): string {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
    .replace(/:\s*"([^"]*)"/g, ': <span class="json-string">"$1"</span>')
    .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
    .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>')
    .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="json-number">$1</span>');
}

function highlightCode(code: string, language: string): string {
  const escaped = escapeHtml(code);

  if (
    language === "javascript" ||
    language === "typescript" ||
    language === "jsx" ||
    language === "tsx"
  ) {
    return escaped
      .replace(
        /\b(const|let|var|function|class|if|else|return|import|export|from|default|async|await|interface|type|extends|implements|new|this|throw|try|catch|finally|for|while|do|switch|case|break|continue|of|in|yield)\b/g,
        '<span class="syntax-keyword">$1</span>',
      )
      .replace(
        /\b(true|false|null|undefined)\b/g,
        '<span class="syntax-boolean">$1</span>',
      )
      .replace(/'([^']*)'/g, "<span class=\"syntax-string\">'$1'</span>")
      .replace(/"([^"]*)"/g, '<span class="syntax-string">"$1"</span>')
      .replace(/`([^`]*)`/g, '<span class="syntax-string">`$1`</span>')
      .replace(/\/\/(.*?)$/gm, '<span class="syntax-comment">//$1</span>');
  }

  if (language === "python") {
    return escaped
      .replace(
        /\b(def|class|import|from|return|if|elif|else|for|while|try|except|finally|with|as|yield|lambda|pass|break|continue|raise|and|or|not|in|is|None|True|False|self|async|await)\b/g,
        '<span class="syntax-keyword">$1</span>',
      )
      .replace(/'([^']*)'/g, "<span class=\"syntax-string\">'$1'</span>")
      .replace(/"([^"]*)"/g, '<span class="syntax-string">"$1"</span>')
      .replace(/#(.*?)$/gm, '<span class="syntax-comment">#$1</span>');
  }

  if (language === "go") {
    return escaped
      .replace(
        /\b(func|package|import|var|const|type|struct|interface|map|chan|go|defer|return|if|else|for|range|switch|case|default|break|continue|select|fallthrough)\b/g,
        '<span class="syntax-keyword">$1</span>',
      )
      .replace(
        /\b(true|false|nil)\b/g,
        '<span class="syntax-boolean">$1</span>',
      )
      .replace(/"([^"]*)"/g, '<span class="syntax-string">"$1"</span>')
      .replace(/`([^`]*)`/g, '<span class="syntax-string">`$1`</span>')
      .replace(/\/\/(.*?)$/gm, '<span class="syntax-comment">//$1</span>');
  }

  if (
    language === "bash" ||
    language === "sh" ||
    language === "shell" ||
    language === "zsh"
  ) {
    return escaped
      .replace(
        /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|export|local|readonly|declare|typeset|unset|shift|source)\b/g,
        '<span class="syntax-keyword">$1</span>',
      )
      .replace(/"([^"]*)"/g, '<span class="syntax-string">"$1"</span>')
      .replace(/'([^']*)'/g, "<span class=\"syntax-string\">'$1'</span>")
      .replace(/#(.*?)$/gm, '<span class="syntax-comment">#$1</span>');
  }

  if (language === "json") {
    return highlightJSON(escaped);
  }

  return escaped;
}
