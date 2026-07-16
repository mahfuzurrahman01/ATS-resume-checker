import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { BLOG_POSTS } from "@/lib/blog-posts";

export const metadata = {
  title: "Resume & ATS Guides",
  description:
    "Practical guides on ATS resume formatting, keyword matching, and what actually makes a resume pass Applicant Tracking Systems.",
};

export default function BlogIndexPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="text-3xl font-bold text-white mb-2">Resume &amp; ATS Guides</h1>
      <p className="text-gray-400 mb-10">
        Practical, no-fluff guides on getting your resume through ATS screening.
      </p>

      <div className="space-y-4">
        {BLOG_POSTS.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`}>
            <Card className="bg-gray-900/20 border border-gray-700/30 hover:border-gray-600/50 transition-colors">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-white mb-1">
                  {post.title}
                </h2>
                <p className="text-sm text-gray-300">{post.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
