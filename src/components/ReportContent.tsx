import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  img: ({ src, alt }) => {
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

export function ReportContent({ markdown }: { markdown: string }) {
  return (
    <div className="prose prose-zinc max-w-none prose-headings:font-semibold prose-h2:mt-10 prose-h2:text-xl prose-h2:border-b prose-h2:border-zinc-200 prose-h2:pb-2 prose-img:rounded-lg">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
