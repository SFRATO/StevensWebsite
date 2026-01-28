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

interface BothSearchEmailProps {
  name: string;
  town: string;
  county: string;
  inventory?: number;
  unsubscribeUrl?: string;
}

export const BothSearchEmail: React.FC<BothSearchEmailProps> = ({
  name = "Homeowner",
  town = "Burlington",
  county = "Burlington County",
  inventory = 45,
  unsubscribeUrl,
}) => {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Header />

          <Section style={content}>
            <Heading style={heading}>
              Finding Your Next Home in {county}
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              Now that we've covered timing and your current home's value, let's
              talk about finding your next home. When you're buying and selling
              simultaneously, your search strategy matters.
            </Text>

            <Section style={inventoryBox}>
              <Text style={inventoryNumber}>{inventory}</Text>
              <Text style={inventoryLabel}>
                Active listings in {town} area
              </Text>
            </Section>

            <Heading as="h3" style={subheading}>
              Search Strategy for Buy-Sell Situations
            </Heading>

            <Section style={tipCard}>
              <Text style={tipNumber}>1</Text>
              <div style={tipContent}>
                <Text style={tipTitle}>Start Early, But Be Strategic</Text>
                <Text style={tipText}>
                  Begin looking before you list your home to understand what's
                  available at your price point. This helps set realistic
                  expectations and identifies opportunities.
                </Text>
              </div>
            </Section>

            <Section style={tipCard}>
              <Text style={tipNumber}>2</Text>
              <div style={tipContent}>
                <Text style={tipTitle}>Get Financing in Order First</Text>
                <Text style={tipText}>
                  Talk to a lender about your specific situation. They can advise
                  on bridge loans, HELOCs, or whether you can qualify for a new
                  mortgage before selling. This knowledge shapes your options.
                </Text>
              </div>
            </Section>

            <Section style={tipCard}>
              <Text style={tipNumber}>3</Text>
              <div style={tipContent}>
                <Text style={tipTitle}>Consider Timing-Flexible Options</Text>
                <Text style={tipText}>
                  Homes that have been on the market a bit longer may have sellers
                  willing to accommodate your timeline. New construction can also
                  offer predictable closing dates to align with your sale.
                </Text>
              </div>
            </Section>

            <Section style={tipCard}>
              <Text style={tipNumber}>4</Text>
              <div style={tipContent}>
                <Text style={tipTitle}>Prepare for Contingent Offers</Text>
                <Text style={tipText}>
                  If your purchase depends on selling your current home, we'll
                  need to make your offer as strong as possible in other ways -
                  earnest money, inspection flexibility, and quick response times.
                </Text>
              </div>
            </Section>

            <Heading as="h3" style={subheading}>
              What I Can Do For You
            </Heading>

            <Text style={paragraph}>
              As your agent for both transactions, I can:
            </Text>

            <ul style={list}>
              <li style={listItem}>
                Set up instant alerts for homes matching your criteria
              </li>
              <li style={listItem}>
                Preview homes before scheduling showings to save your time
              </li>
              <li style={listItem}>
                Coordinate timing between your sale and purchase
              </li>
              <li style={listItem}>
                Negotiate with both sellers and your buyers to align closings
              </li>
              <li style={listItem}>
                Manage the complexity so you can focus on your move
              </li>
            </ul>

            <Section style={highlightBox}>
              <Text style={highlightTitle}>Define Your Must-Haves</Text>
              <Text style={highlightText}>
                When you're buying and selling on a timeline, clarity is crucial.
                Make a list of your non-negotiables vs. nice-to-haves. This helps
                us move quickly when the right opportunity appears - and avoid
                wasting time on homes that won't work.
              </Text>
            </Section>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Share Your Wishlist
              </Button>
            </Section>

            <Text style={paragraph}>
              Coming next: How to coordinate both transactions to minimize stress
              and avoid costly gaps between homes.
            </Text>

            <Text style={signature}>
              Helping you find your next home,
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

const inventoryBox: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  padding: "25px",
  borderRadius: "8px",
  textAlign: "center" as const,
  margin: "25px 0",
  border: "1px solid #e0e0e0",
};

const inventoryNumber: React.CSSProperties = {
  fontSize: "48px",
  fontWeight: "bold",
  color: "#C99C33",
  margin: "0",
  lineHeight: "1",
};

const inventoryLabel: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  margin: "10px 0 0",
};

const tipCard: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "15px",
  marginBottom: "20px",
  padding: "15px",
  backgroundColor: "#f9f9f9",
  borderRadius: "8px",
};

const tipNumber: React.CSSProperties = {
  backgroundColor: "#C99C33",
  color: "white",
  width: "30px",
  height: "30px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  flexShrink: 0,
  fontSize: "14px",
  lineHeight: "30px",
  textAlign: "center" as const,
};

const tipContent: React.CSSProperties = {
  flex: 1,
};

const tipTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 5px",
};

const tipText: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  margin: "0",
  lineHeight: "1.5",
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

const highlightBox: React.CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%)",
  padding: "20px",
  borderRadius: "8px",
  borderLeft: "4px solid #C99C33",
  margin: "25px 0",
};

const highlightTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#1a1a1a",
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

export default BothSearchEmail;
