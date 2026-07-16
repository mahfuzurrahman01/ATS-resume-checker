import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Refund Policy",
  description: "ATSBuddy's refund policy for credit pack purchases.",
};

export default function RefundsPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <h1 className="text-3xl font-bold text-white mb-2">Refund Policy</h1>
      <p className="text-sm text-gray-400 mb-8">
        Last updated {new Date().toLocaleDateString()}
      </p>

      <Card className="bg-gray-900/20 border border-gray-700/30">
        <CardContent className="p-6 space-y-6 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              Who processes your payment
            </h2>
            <p>
              All credit pack purchases are sold by Paddle.com Market Limited
              (&quot;Paddle&quot;), our authorized reseller and Merchant of
              Record. Paddle handles payment collection, sales tax/VAT, and
              billing support for every purchase. Your bank or card statement
              will show a charge from Paddle, not from us directly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              Digital goods and instant delivery
            </h2>
            <p>
              Credits are a digital product delivered to your account
              immediately after payment is confirmed. Because delivery is
              instant and the credits become usable right away, purchases are
              generally final and non-refundable once credits have been added
              to your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              EU/UK right of withdrawal
            </h2>
            <p>
              If you&apos;re a consumer in the EU or UK, you normally have a
              14-day right to withdraw from an online purchase. By completing
              checkout for a credit pack, you request immediate access to
              digital content and expressly acknowledge that you lose this
              withdrawal right once the credits are delivered to your
              account, in accordance with applicable consumer protection law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              When we do issue a refund
            </h2>
            <p>We&apos;ll refund or re-credit your account if:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>You were charged but credits never reached your account.</li>
              <li>
                You were charged more than once for the same purchase (a
                duplicate transaction).
              </li>
              <li>
                A scan or job match failed on our end after charging you
                (this shouldn&apos;t happen — our system only deducts credits
                after a result is successfully produced, but if it does, we
                fix it).
              </li>
              <li>
                Required by applicable law in your jurisdiction, regardless
                of the terms above.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              What we don&apos;t refund
            </h2>
            <p>
              Change of mind after a successful scan or match, dissatisfaction
              with AI-generated suggestions, or credits left unused in your
              account (credits don&apos;t expire, so there&apos;s no need — see
              our{" "}
              <Link href="/terms" className="underline">
                Terms of Service
              </Link>
              ).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              How to request a refund
            </h2>
            <p>
              Contact us via the{" "}
              <Link href="/contact" className="underline">
                contact page
              </Link>{" "}
              with your account email and, if you have it, the Paddle order
              or transaction ID from your receipt email. We aim to respond
              within 2 business days. Approved refunds are processed by
              Paddle back to your original payment method and may take
              several business days to appear, depending on your bank.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              Questions
            </h2>
            <p>
              See Paddle&apos;s own{" "}
              <a
                href="https://www.paddle.com/legal/checkout-buyer-terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                buyer terms
              </a>{" "}
              for how they handle payments on our behalf, or reach out via
              our{" "}
              <Link href="/contact" className="underline">
                contact page
              </Link>{" "}
              for anything specific to your purchase.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
