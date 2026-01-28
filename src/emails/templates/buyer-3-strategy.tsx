import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
} from "@react-email/components";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { Button } from "../components/Button";

interface BuyerStrategyEmailProps {
  name: string;
  town: string;
  marketType?: "seller" | "buyer" | "balanced";
  soldAboveListPct?: number;
  unsubscribeUrl?: string;
}

export const BuyerStrategyEmail: React.FC<BuyerStrategyEmailProps> = ({
  name = "Homebuyer",
  town = "Burlington",
  marketType = "balanced",
  soldAboveListPct = 42,
  unsubscribeUrl,
}) => {
  const marketTypeLabel =
    marketType === "seller"
      ? "seller's market"
      : marketType === "buyer"
      ? "buyer's market"
      : "balanced market";

  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Header />

          <Section style={content}>
            <Heading style={heading}>
              Smart Buying Strategies for {town}'s Market
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              In today's {marketTypeLabel} in {town}, knowing how to structure your
              offer can make the difference between getting your dream home and
              missing out. Here's what I've learned helps buyers succeed.
            </Text>

            {soldAboveListPct > 0 && (
              <Section style={statBox}>
                <Text style={statNumber}>{soldAboveListPct.toFixed(0)}%</Text>
                <Text style={statLabel}>
                  of {town} homes sold at or above list price
                </Text>
              </Section>
            )}

            <Heading as="h3" style={subheading}>
              {marketType === "seller"
                ? "Competing in a Seller's Market"
                : marketType === "buyer"
                ? "Leveraging a Buyer's Market"
                : "Navigating a Balanced Market"}
            </Heading>

            {marketType === "seller" ? (
              <>
                <Text style={paragraph}>
                  <strong>Be pre-approved, not just pre-qualified.</strong> In a
                  competitive market, sellers favor buyers who have done their
                  homework. A pre-approval letter shows you're serious and ready.
                </Text>
                <Text style={paragraph}>
                  <strong>Consider your contingencies carefully.</strong> While you
                  should never waive the inspection, being flexible on timing or
                  other terms can make your offer more attractive.
                </Text>
                <Text style={paragraph}>
                  <strong>Write a personal letter.</strong> In multiple-offer
                  situations, helping sellers see you as people - not just a number
                  - can tip the scales in your favor.
                </Text>
                <Text style={paragraph}>
                  <strong>Be ready to move quickly.</strong> Hot homes don't last
                  long. Having your documents organized and being available for
                  showings gives you an edge.
                </Text>
              </>
            ) : marketType === "buyer" ? (
              <>
                <Text style={paragraph}>
                  <strong>Take your time.</strong> With more inventory available,
                  you have the luxury of being selective. Don't rush into a
                  decision you'll regret.
                </Text>
                <Text style={paragraph}>
                  <strong>Negotiate confidently.</strong> Sellers are more motivated,
                  which means there's often room to negotiate on price, closing
                  costs, or repairs.
                </Text>
                <Text style={paragraph}>
                  <strong>Look for motivated sellers.</strong> Homes that have been
                  on the market longer may have sellers ready to make a deal.
                </Text>
                <Text style={paragraph}>
                  <strong>Request extras.</strong> This is a good time to ask for
                  appliances, closing cost assistance, or home warranties.
                </Text>
              </>
            ) : (
              <>
                <Text style={paragraph}>
                  <strong>Be competitive but reasonable.</strong> You may not need
                  to offer over asking, but lowball offers likely won't work either.
                </Text>
                <Text style={paragraph}>
                  <strong>Get your timing right.</strong> Neither party has all the
                  leverage, so being ready to close when the seller prefers can
                  help your offer stand out.
                </Text>
                <Text style={paragraph}>
                  <strong>Focus on the whole package.</strong> A clean offer with
                  reasonable terms can be more appealing than a higher price with
                  complications.
                </Text>
                <Text style={paragraph}>
                  <strong>Don't skip the inspection.</strong> Even in a balanced
                  market, protecting yourself with a thorough inspection is worth
                  any minor negotiating ground it might cost.
                </Text>
              </>
            )}

            <Section style={highlightBox}>
              <Text style={highlightTitle}>Pro Tip</Text>
              <Text style={highlightText}>
                Every negotiation is different. What works in one situation may
                not work in another. That's where having an experienced agent on
                your side makes a real difference - I can help you read each
                situation and adjust your approach accordingly.
              </Text>
            </Section>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Let's Discuss Your Strategy
              </Button>
            </Section>

            <Text style={paragraph}>
              Next up: I'll share how to maximize your buying power with today's
              financing options - information that can help you afford more home
              than you might think.
            </Text>

            <Text style={signature}>
              Here to help you win,
              <br />
              <strong>Steven</strong>
            </Text>
          </Section>

          <Footer unsubscribeUrl={unsubscribeUrl} />
        </Container>
      </Body>
    </Html>
  );
};

const body: React.CSSProperties = {
  backgroundColor: "#f6f6f6",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container: React.CSSProperties = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "20px",
  backgroundColor: "#ffffff",
};

const content: React.CSSProperties = {
  padding: "30px 0",
};

const heading: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "bold",
  color: "#1a1a1a",
  margin: "0 0 20px",
};

const subheading: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "25px 0 15px",
};

const paragraph: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#333",
  margin: "0 0 15px",
};

const statBox: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  padding: "25px",
  borderRadius: "8px",
  textAlign: "center" as const,
  margin: "25px 0",
  border: "1px solid #e0e0e0",
};

const statNumber: React.CSSProperties = {
  fontSize: "48px",
  fontWeight: "bold",
  color: "#C99C33",
  margin: "0",
  lineHeight: "1",
};

const statLabel: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  margin: "10px 0 0",
};

const highlightBox: React.CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%)",
  padding: "20px",
  borderRadius: "8px",
  borderLeft: "4px solid #C99C33",
  margin: "25px 0",
};

const highlightTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#C99C33",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 10px",
};

const highlightText: React.CSSProperties = {
  fontSize: "15px",
  color: "#333",
  margin: "0",
  lineHeight: "1.6",
};

const ctaSection: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "30px 0",
};

const signature: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#333",
  margin: "30px 0 0",
};

export default BuyerStrategyEmail;
