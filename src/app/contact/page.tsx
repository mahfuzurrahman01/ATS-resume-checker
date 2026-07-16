import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail, MessageSquare } from "lucide-react";
import { ContactForm } from "./ContactForm";

export const metadata = {
  title: "Contact",
  description: "Get in touch with the ATSBuddy team.",
};

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-xl text-muted-foreground">
            Get in touch with our team for support or feedback
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact Information */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Get in Touch</CardTitle>
                <CardDescription>
                  We&apos;re here to help with any questions about ATSBuddy
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">
                      support@atsbuddy.dev
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Response time</p>
                    <p className="text-sm text-muted-foreground">
                      We typically reply within 1-2 business days
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <Card>
            <CardHeader>
              <CardTitle>Send us a Message</CardTitle>
              <CardDescription>
                Fill out the form below and we&apos;ll get back to you as soon
                as possible
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContactForm />
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
            <CardDescription>
              Common questions about ATSBuddy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">
                  How does the ATS analysis work?
                </h4>
                <p className="text-sm text-muted-foreground">
                  Our AI analyzes your resume for ATS compatibility by checking
                  formatting, keyword optimization, and structure. We provide a
                  detailed score and specific recommendations for improvement.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">
                  Is my resume data secure?
                </h4>
                <p className="text-sm text-muted-foreground">
                  Your resume is stored privately in your account so you can
                  revisit your results, and it&apos;s never shared beyond what&apos;s
                  needed to run the analysis. You can delete it anytime from
                  Settings — see our{" "}
                  <a href="/privacy" className="underline">
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">
                  What file formats are supported?
                </h4>
                <p className="text-sm text-muted-foreground">
                  We support PDF, DOC, and DOCX formats. For best results, we
                  recommend using PDF format as it maintains formatting
                  consistency.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
