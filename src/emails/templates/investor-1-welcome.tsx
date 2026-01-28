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

interface InvestorWelcomeEmailProps {
  name: string;
  town: string;
  county: string;
  medianPrice?: string;
  priceChange?: string;
  inventory?: number;
  unsubscribeUrl?: string;
}

export const InvestorWelcomeEmail: React.FC<InvestorWelcomeEmailProps> = ({
  name = "Investor",
  town = "Burlington",
  county = "Burlington County",
  medianPrice = "$385,000",
  priceChange = "+4.2%",
  inventory = 45,
  unsubscribeUrl,
}) => {
  const isPositive = priceChange.startsWith("+");

  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Header />

          <Section style={content}>
            <Heading style={heading}>
              {county} Investment Property Overview
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              Thank you for your interest in {county} investment properties. This
              area offers solid opportunities for investors who understand the
              local market dynamics. Let me share what the data shows.
            </Text>

            <Section style={metricsRow}>
              <Section style={metricBox}>
                <Text style={metricLabel}>Median Price</Text>
                <Text style={metricValue}>{medianPrice}</Text>
              </Section>
              <Section style={metricBox}>
                <Text style={metricLabel}>YoY Change</Text>
                <Text
                  style={{
                    ...metricValue,
                    color: isPositive ? "#4CAF50" : "#f44336",
                  }}
                >
                  {priceChange}
                </Text>
              </Section>
              <Section style={metricBox}>
                <Text style={metricLabel}>Inventory</Text>
                <Text style={metricValue}>{inventory}</Text>
              </Section>
            </Section>

            <Heading as="h3" style={subheading}>
              Why {county} for Investment?
            </Heading>

            <ul style={list}>
              <li style={listItem}>
                <strong>Strong rental demand:</strong> Proximity to Philadelphia
                and major employers creates consistent tenant interest
              </li>
              <li style={listItem}>
                <strong>Appreciation potential:</strong> Year-over-year price
                growth indicates a healthy market trajectory
              </li>
              <li style={listItem}>
                <strong>Diverse property types:</strong> From single-family
                rentals to multi-unit opportunities
              </li>
              <li style={listItem}>
                <strong>Lower entry points:</strong> More accessible than
                Philadelphia metro while maintaining strong fundamentals
              </li>
            </ul>

            <Section style={highlightBox}>
              <Text style={highlightTitle}>Over the Coming Weeks</Text>
              <Text style={highlightText}>
                I'll share more detailed analysis including ROI frameworks, local
                hotspots, and tax considerations for New Jersey investors. This
                isn't generic advice - it's specific to {county}'s investment
                landscape.
              </Text>
            </Section>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Discuss Investment Opportunities
              </Button>
            </Section>

            <Text style={paragraph}>
              Whether you're looking for your first rental property or adding to
              an existing portfolio, I can help you identify opportunities that
              match your investment criteria.
            </Text>

            <Text style={signature}>
              Looking forward to helping you invest wisely,
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

const metricsRow: React.CSSProperties = {
  display: "flex",
  gap: "15px",
  margin: "25px 0",
};

const metricBox: React.CSSProperties = {
  flex: 1,
  backgroundColor: "#1a1a1a",
  padding: "20px 15px",
  borderRadius: "8px",
  textAlign: "center" as const,
};

const metricLabel: React.CSSProperties = {
  fontSize: "11px",
  color: "#999",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 8px",
};

const metricValue: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: "bold",
  color: "#C99C33",
  margin: "0",
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

export default InvestorWelcomeEmail;
