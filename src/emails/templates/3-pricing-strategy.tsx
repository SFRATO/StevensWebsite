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

interface PricingStrategyEmailProps {
  location: string;
}

export const PricingStrategyEmail: React.FC<PricingStrategyEmailProps> = ({
  location = "Burlington County",
}) => {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Header />

          <Section style={content}>
            <Heading style={heading}>
              How to Price Your Home in Today's {location} Market
            </Heading>

            <Text style={paragraph}>
              Pricing is the single most important decision you'll make when
              selling your home. Price too high, and you'll watch your listing
              grow stale. Price too low, and you leave money on the table.
            </Text>

            <Text style={paragraph}>
              Here's the pricing framework I use with my {location} clients:
            </Text>

            <Heading as="h3" style={subheading}>
              1. Start with Comparable Sales
            </Heading>

            <Text style={paragraph}>
              I analyze homes that have <strong>actually sold</strong> in your
              neighborhood within the last 3-6 months. Not active listings, not
              pending sales—completed transactions with real closing prices.
            </Text>

            <Heading as="h3" style={subheading}>
              2. Adjust for Your Home's Features
            </Heading>

            <Text style={paragraph}>
              Every home is unique. I factor in upgrades, lot size, condition,
              and specific features that add or subtract value compared to
              recent sales.
            </Text>

            <Heading as="h3" style={subheading}>
              3. Consider Current Buyer Demand
            </Heading>

            <Text style={paragraph}>
              In {location}'s current market, buyer activity is strong. This
              affects how aggressively we can price—and whether we can expect
              multiple offers.
            </Text>

            <Section style={tipBox}>
              <Text style={tipTitle}>Pro Tip:</Text>
              <Text style={tipText}>
                In a seller's market like {location} right now, slightly
                underpricing can generate multiple offers and drive the final
                price above asking. But this strategy isn't right for every
                home—it depends on your property and goals.
              </Text>
            </Section>

            <Text style={paragraph}>
              Want to know exactly where your home should be priced? I can
              provide a detailed Comparative Market Analysis (CMA) specific to
              your property—no obligation.
            </Text>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Request Your Free CMA
              </Button>
            </Section>

            <Text style={signature}>
              Best,
              <br />
              <strong>Steven</strong>
            </Text>
          </Section>

          <Footer />
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
  margin: "25px 0 10px",
};

const paragraph: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#333",
  margin: "0 0 15px",
};

const tipBox: React.CSSProperties = {
  backgroundColor: "#FFF9E6",
  borderLeft: "4px solid #C99C33",
  padding: "15px 20px",
  margin: "25px 0",
};

const tipTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "bold",
  color: "#C99C33",
  margin: "0 0 5px",
};

const tipText: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.6",
  color: "#333",
  margin: "0",
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

export default PricingStrategyEmail;
