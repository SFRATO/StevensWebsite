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

interface BothWelcomeEmailProps {
  name: string;
  town: string;
  zipcode: string;
  county: string;
  medianPrice?: string;
  marketType?: "seller" | "buyer" | "balanced";
  unsubscribeUrl?: string;
}

export const BothWelcomeEmail: React.FC<BothWelcomeEmailProps> = ({
  name = "Homeowner",
  town = "Burlington",
  zipcode = "08016",
  county = "Burlington County",
  medianPrice = "$385,000",
  marketType = "balanced",
  unsubscribeUrl,
}) => {
  const marketTypeLabel =
    marketType === "seller"
      ? "Seller's Market"
      : marketType === "buyer"
      ? "Buyer's Market"
      : "Balanced Market";

  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Header />

          <Section style={content}>
            <Heading style={heading}>
              Your {town} Buy & Sell Strategy Starts Here
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              Buying and selling at the same time is one of the more complex real
              estate situations - but with the right strategy, it can go smoothly.
              I'm here to help you navigate both transactions successfully.
            </Text>

            <Section style={dualBox}>
              <div style={dualColumn}>
                <Text style={dualTitle}>Selling</Text>
                <Text style={dualSubtitle}>Your Current Home</Text>
                <Text style={dualStat}>{medianPrice}</Text>
                <Text style={dualLabel}>Median in {town}</Text>
              </div>
              <div style={dualDivider}></div>
              <div style={dualColumn}>
                <Text style={dualTitle}>Buying</Text>
                <Text style={dualSubtitle}>Your Next Home</Text>
                <Text style={dualStat}>{marketTypeLabel}</Text>
                <Text style={dualLabel}>Current Conditions</Text>
              </div>
            </Section>

            <Heading as="h3" style={subheading}>
              The Key Questions We'll Answer Together
            </Heading>

            <ul style={list}>
              <li style={listItem}>
                Should you sell first, buy first, or try to do both simultaneously?
              </li>
              <li style={listItem}>
                What's your current home worth in today's market?
              </li>
              <li style={listItem}>
                How can you avoid being homeless between transactions?
              </li>
              <li style={listItem}>
                What financing options make sense for your situation?
              </li>
              <li style={listItem}>
                How do you make a competitive offer when your purchase depends on
                your sale?
              </li>
            </ul>

            <Text style={paragraph}>
              Over the next two weeks, I'll share strategies specifically designed
              for people in your situation - buying and selling in today's market.
            </Text>

            <Section style={consultationBox}>
              <Text style={consultationTitle}>
                Every situation is different
              </Text>
              <Text style={consultationText}>
                The best strategy depends on your specific circumstances - your
                timeline, your finances, and your priorities. I'd love to learn
                more about your situation and help you create a plan that works.
              </Text>
            </Section>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Let's Discuss Your Plan
              </Button>
            </Section>

            <Text style={signature}>
              Looking forward to helping you make your move,
              <br />
              <strong>Steven Frato</strong>
              <br />
              Century 21
              <br />
              (609) 789-0126
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

const dualBox: React.CSSProperties = {
  display: "flex",
  backgroundColor: "#f9f9f9",
  borderRadius: "8px",
  margin: "25px 0",
  border: "1px solid #e0e0e0",
  overflow: "hidden",
};

const dualColumn: React.CSSProperties = {
  flex: 1,
  padding: "20px",
  textAlign: "center" as const,
};

const dualDivider: React.CSSProperties = {
  width: "1px",
  backgroundColor: "#e0e0e0",
};

const dualTitle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: "600",
  color: "#C99C33",
  textTransform: "uppercase" as const,
  letterSpacing: "1px",
  margin: "0 0 5px",
};

const dualSubtitle: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  margin: "0 0 15px",
};

const dualStat: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "bold",
  color: "#1a1a1a",
  margin: "0",
};

const dualLabel: React.CSSProperties = {
  fontSize: "12px",
  color: "#999",
  margin: "5px 0 0",
};

const list: React.CSSProperties = {
  paddingLeft: "20px",
  margin: "0 0 20px",
};

const listItem: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "1.8",
  color: "#333",
};

const consultationBox: React.CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%)",
  padding: "20px",
  borderRadius: "8px",
  borderLeft: "4px solid #C99C33",
  margin: "25px 0",
};

const consultationTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 10px",
};

const consultationText: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
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

export default BothWelcomeEmail;
