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

interface MarketDeepDiveEmailProps {
  location: string;
  medianPrice?: string;
  priceChange?: string;
  daysOnMarket?: string;
}

export const MarketDeepDiveEmail: React.FC<MarketDeepDiveEmailProps> = ({
  location = "Burlington County",
  medianPrice = "$385,000",
  priceChange = "+4.2%",
  daysOnMarket = "28",
}) => {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Header />

          <Section style={content}>
            <Heading style={heading}>
              What {location}'s Market Data Means for You
            </Heading>

            <Text style={paragraph}>
              A few days ago, I sent you a market report for {location}. Today,
              let me break down what those numbers actually mean for your
              selling timeline.
            </Text>

            <Heading as="h3" style={subheading}>
              The Key Metrics
            </Heading>

            <Section style={metricsGrid}>
              <Section style={metricBox}>
                <Text style={metricLabel}>Median Price</Text>
                <Text style={metricValue}>{medianPrice}</Text>
                <Text style={metricChange}>{priceChange} YoY</Text>
              </Section>

              <Section style={metricBox}>
                <Text style={metricLabel}>Days on Market</Text>
                <Text style={metricValue}>{daysOnMarket}</Text>
                <Text style={metricSubtext}>Average</Text>
              </Section>
            </Section>

            <Heading as="h3" style={subheading}>
              What This Means for Sellers
            </Heading>

            <Text style={paragraph}>
              <strong>Prices are up.</strong> Home values in {location} have
              increased {priceChange} compared to last year. If you've owned
              your home for a few years, you've likely built significant equity.
            </Text>

            <Text style={paragraph}>
              <strong>Homes are selling quickly.</strong> With an average of{" "}
              {daysOnMarket} days on market, well-priced homes are finding
              buyers fast. This reduces the carrying costs and stress of a
              prolonged sale.
            </Text>

            <Text style={paragraph}>
              <strong>Buyer demand remains strong.</strong> Even with changing
              interest rates, qualified buyers are actively looking in{" "}
              {location}. The key is connecting with serious, pre-approved
              buyers.
            </Text>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Let's Discuss Your Situation
              </Button>
            </Section>

            <Text style={paragraph}>
              In my next email, I'll share specific pricing strategies that help{" "}
              {location} sellers maximize their sale price without sitting on
              the market too long.
            </Text>

            <Text style={signature}>
              Talk soon,
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
  margin: "25px 0 15px",
};

const paragraph: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#333",
  margin: "0 0 15px",
};

const metricsGrid: React.CSSProperties = {
  display: "flex",
  gap: "15px",
  margin: "20px 0",
};

const metricBox: React.CSSProperties = {
  flex: "1",
  backgroundColor: "#f9f9f9",
  padding: "20px",
  borderRadius: "8px",
  textAlign: "center" as const,
  border: "1px solid #e0e0e0",
};

const metricLabel: React.CSSProperties = {
  fontSize: "12px",
  color: "#666",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 5px",
};

const metricValue: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: "bold",
  color: "#C99C33",
  margin: "0",
};

const metricChange: React.CSSProperties = {
  fontSize: "14px",
  color: "#4CAF50",
  margin: "5px 0 0",
};

const metricSubtext: React.CSSProperties = {
  fontSize: "12px",
  color: "#666",
  margin: "5px 0 0",
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

export default MarketDeepDiveEmail;
