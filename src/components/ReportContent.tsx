import { Children, isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

// react-markdown wraps `![alt](src)` in a <p>, but this renders a <figure>
// with a <figcaption> — and HTML forbids block elements like <figure>
// inside <p>, which causes a hydration mismatch. Named so the `p` override
// below can detect it by reference and unwrap the <p> in that case.
function MarkdownImage({ src, alt }: { src?: string | Blob; alt?: string }) {
  if (typeof src !== "string") return null;
  return (
    <figure className="my-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        className="w-full rounded-lg border border-zinc-200"
      />
      {alt && (
        <figcaption className="mt-2 text-center text-sm text-zinc-500">
          {alt}
        </figcaption>
      )}
    </figure>
  );
}

const components: Components = {
  img: MarkdownImage,
  p: ({ children }) => {
    const containsBlockImage = Children.toArray(children).some(
      (child) => isValidElement(child) && child.type === MarkdownImage
    );
    // Render without the <p> wrapper so the <figure>/<figcaption> below
    // isn't nested inside one — an image-only line becomes its own block.
    if (containsBlockImage) return <>{children}</>;
    return <p>{children}</p>;
  },
  blockquote: ({ children }) => (
    <blockquote className="my-6 rounded-r-md border-l-4 border-blue-500 bg-blue-50 px-4 py-3 text-blue-900 not-italic [&_p]:m-0">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-lg border border-zinc-200">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-left font-semibold text-zinc-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-zinc-100 px-3 py-2">{children}</td>
  ),
};

// Visitor-submitted Markdown: no remote images (tracking pixels, hotlinked
// junk) and links marked as user-generated so they pass no SEO credit.
const communityComponents: Components = {
  ...components,
  img: () => null,
  p: ({ children }) => <p>{children}</p>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="nofollow ugc noopener noreferrer">
      {children}
    </a>
  ),
};

export function ReportContent({
  markdown,
  untrusted = false,
}: {
  markdown: string;
  untrusted?: boolean;
}) {
  return (
    <div className="prose prose-zinc max-w-none prose-headings:font-semibold prose-h2:mt-10 prose-h2:text-xl prose-h2:border-b prose-h2:border-zinc-200 prose-h2:pb-2 prose-img:rounded-lg">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={untrusted ? communityComponents : components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
