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

interface BuyerWelcomeEmailProps {
  name: string;
  town: string;
  zipcode: string;
  county: string;
  medianPrice?: string;
  inventory?: number;
  marketType?: "seller" | "buyer" | "balanced";
  unsubscribeUrl?: string;
}

export const BuyerWelcomeEmail: React.FC<BuyerWelcomeEmailProps> = ({
  name = "Homebuyer",
  town = "Burlington",
  zipcode = "08016",
  county = "Burlington County",
  medianPrice = "$385,000",
  inventory = 45,
  marketType = "balanced",
  unsubscribeUrl,
}) => {
  const marketTypeLabel =
    marketType === "seller"
      ? "Seller's Market"
      : marketType === "buyer"
      ? "Buyer's Market"
      : "Balanced Market";

  const marketAdvice =
    marketType === "seller"
      ? "Homes are selling quickly, so being prepared to act fast is essential."
      : marketType === "buyer"
      ? "You have more options and negotiating power in the current market."
      : "Supply and demand are balanced, giving you good options without excessive pressure.";

  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Header />

          <Section style={content}>
            <Heading style={heading}>
              Your Guide to Buying in {town}
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              Thank you for your interest in finding a home in {town}, NJ. I'm
              excited to help you navigate this journey and find the perfect
              place to call home.
            </Text>

            <Section style={marketSnapshot}>
              <Text style={snapshotTitle}>Current Market Snapshot</Text>
              <table style={snapshotTable}>
                <tbody>
                  <tr>
                    <td style={snapshotLabel}>Median Price:</td>
                    <td style={snapshotValue}>{medianPrice}</td>
                  </tr>
                  <tr>
                    <td style={snapshotLabel}>Active Listings:</td>
                    <td style={snapshotValue}>{inventory} homes</td>
                  </tr>
                  <tr>
                    <td style={snapshotLabel}>Market Conditions:</td>
                    <td style={snapshotValue}>{marketTypeLabel}</td>
                  </tr>
                </tbody>
              </table>
            </Section>

            <Heading as="h3" style={subheading}>
              What This Means for You
            </Heading>

            <Text style={paragraph}>
              {marketAdvice}
            </Text>

            <Text style={paragraph}>
              Over the next two weeks, I'll send you valuable information about:
            </Text>

            <ul style={list}>
              <li style={listItem}>
                {town}'s best neighborhoods and what makes each unique
              </li>
              <li style={listItem}>
                Smart buying strategies for the current market
              </li>
              <li style={listItem}>
                How to maximize your buying power with today's financing options
              </li>
              <li style={listItem}>
                The home buying process from start to finish
              </li>
            </ul>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Let's Start Your Home Search
              </Button>
            </Section>

            <Section style={consultationBox}>
              <Text style={consultationTitle}>
                Ready to start looking?
              </Text>
              <Text style={consultationText}>
                I'd love to learn about what you're looking for in your next home.
                Reply to this email or give me a call - I'm here to help, no pressure.
              </Text>
            </Section>

            <Text style={signature}>
              Looking forward to helping you find home,
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

const marketSnapshot: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  padding: "20px",
  borderRadius: "8px",
  margin: "20px 0",
  border: "1px solid #e0e0e0",
};

const snapshotTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#C99C33",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 15px",
};

const snapshotTable: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse" as const,
};

const snapshotLabel: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  padding: "8px 0",
};

const snapshotValue: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#1a1a1a",
  textAlign: "right" as const,
  padding: "8px 0",
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

const ctaSection: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "30px 0",
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

const signature: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#333",
  margin: "30px 0 0",
};

export default BuyerWelcomeEmail;
