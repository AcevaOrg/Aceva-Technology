import type { Metadata } from "next";
import ReviewCard, { type Review } from "@/components/features/ReviewCard";
import Reveal from "@/components/ui/Reveal";
import reviewsData from "@/data/reviews.json";
import { ROUTES } from "@/lib/nav";
import { pageMetadata } from "@/lib/seo";

const reviews = reviewsData as Review[];

export const metadata: Metadata = pageMetadata({
  title: "Client Reviews",
  description: "Demo testimonials illustrating how client feedback will appear on the Aceva Technology website.",
  path: ROUTES.testimonials,
  noIndex: true,
});

export default function TestimonialsPage() {
  return (
    <div>
      <section>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "calc(var(--nav-offset) + clamp(16px,3vw,32px)) clamp(20px,4vw,48px) clamp(40px,6vw,64px)" }}>
          <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5, letterSpacing: ".2em", color: "var(--ice)", margin: "0 0 20px", animation: "acFadeUp 700ms cubic-bezier(.16,1,.3,1) both" }}>
            CLIENT REVIEWS
          </p>
          <h1 style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 600, fontSize: "clamp(36px,5.2vw,62px)", lineHeight: 1.05, letterSpacing: "-.03em", margin: 0, maxWidth: "17ch", animation: "acFadeUp 800ms cubic-bezier(.16,1,.3,1) 60ms both" }}>
            Feedback, presented with context.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--muted)", margin: "24px 0 0", maxWidth: "58ch", animation: "acFadeUp 800ms cubic-bezier(.16,1,.3,1) 140ms both" }}>
            A preview of how client experiences across our services and regions will be shared.
          </p>
        </div>
      </section>

      <section>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(44px,6vw,80px) clamp(20px,4vw,48px) clamp(72px,9vw,116px)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 16 }}>
            {reviews.map((review, index) => (
              <Reveal key={`${review.name}-${review.business}`} delay={index * 60}>
                <ReviewCard review={review} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
