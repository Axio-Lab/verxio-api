import { Navbar } from "./home/_components/navbar";
import { Hero } from "./home/_components/hero";
import { Features } from "./home/_components/features";
import { HowItWorks } from "./home/_components/how-it-works";
import { Pricing } from "./home/_components/pricing";
import { CTA } from "./home/_components/cta";
import { Footer } from "./home/_components/footer";

export const metadata = {
  title: "Verxio — AI coworker platform for every team",
  description:
    "Turn any chat channel into an automation hub. Spin up AI agents, add custom skills, and deploy to Slack, Discord, Telegram, and WhatsApp.",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}
