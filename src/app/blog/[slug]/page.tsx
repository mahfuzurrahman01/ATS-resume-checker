import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BLOG_POSTS, getBlogPost } from "@/lib/blog-posts";

const siteUrl = "https://www.atsbuddy.dev";

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const articleStructuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    author: { "@type": "Organization", name: "ATSBuddy" },
    publisher: { "@type": "Organization", name: "ATSBuddy" },
    mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleStructuredData) }}
      />
      <Link href="/blog" className="text-sm text-gray-400 hover:text-gray-200">
        &larr; All guides
      </Link>
      <h1 className="text-3xl font-bold text-white mt-4 mb-2">{post.title}</h1>
      <p className="text-sm text-gray-500 mb-8">
        {new Date(post.publishedAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>

      <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
        {post.content.map((block, i) => {
          if (block.type === "h2") {
            return (
              <h2 key={i} className="text-lg font-semibold text-white pt-4">
                {block.text}
              </h2>
            );
          }
          if (block.type === "ul") {
            return (
              <ul key={i} className="list-disc list-inside space-y-1">
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          }
          return <p key={i}>{block.text}</p>;
        })}
      </div>

      <Card className="bg-gray-900/20 border border-gray-700/30 mt-10">
        <CardContent className="p-6 text-center space-y-3">
          <p className="text-white font-medium">
            See exactly where your resume stands
          </p>
          <p className="text-sm text-gray-400">
            10 free credits, no card required.
          </p>
          <Link href="/scan">
            <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              Scan a resume
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
