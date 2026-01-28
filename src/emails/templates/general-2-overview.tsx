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

interface GeneralOverviewEmailProps {
  name: string;
  town: string;
  county: string;
  medianPrice?: string;
  priceChange?: string;
  marketType?: "seller" | "buyer" | "balanced";
  unsubscribeUrl?: string;
}

export const GeneralOverviewEmail: React.FC<GeneralOverviewEmailProps> = ({
  name = "Friend",
  town = "Burlington",
  county = "Burlington County",
  medianPrice = "$385,000",
  priceChange = "+4.2%",
  marketType = "balanced",
  unsubscribeUrl,
}) => {
  const isPositive = priceChange.startsWith("+");
  const marketTypeLabel =
    marketType === "seller"
      ? "Seller's Market"
      : marketType === "buyer"
      ? "Buyer's Market"
      : "Balanced Market";

  const marketDescription =
    marketType === "seller"
      ? "Demand exceeds supply, giving sellers an advantage in negotiations and often resulting in multiple offers."
      : marketType === "buyer"
      ? "More homes are available than buyers, giving purchasers more options and negotiating power."
      : "Supply and demand are relatively equal, creating fair conditions for both buyers and sellers.";

  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Header />

          <Section style={content}>
            <Heading style={heading}>
              {county} Market Overview: What You Should Know
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              Whether you're thinking about buying, selling, or just curious
              about real estate values, here's a snapshot of what's happening in
              the {county} market right now.
            </Text>

            <Section style={metricsBox}>
              <Section style={metricRow}>
                <Section style={metric}>
                  <Text style={metricLabel}>Median Price</Text>
                  <Text style={metricValue}>{medianPrice}</Text>
                </Section>
                <Section style={metric}>
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
              </Section>
              <Section style={marketTypeBox}>
                <Text style={marketTypeLabel}>Current Conditions</Text>
                <Text style={marketTypeValue}>{marketTypeLabel}</Text>
                <Text style={marketTypeDesc}>{marketDescription}</Text>
              </Section>
            </Section>

            <Heading as="h3" style={subheading}>
              What This Means
            </Heading>

            <Section style={insightCard}>
              <Text style={insightTitle}>For Potential Sellers</Text>
              <Text style={insightText}>
                {isPositive
                  ? `Home values in ${county} have increased ${priceChange} over the past year. If you've owned your home for a while, you may have built more equity than you realize.`
                  : `While values have adjusted slightly, ${county} remains a strong market. The key is pricing accurately and presenting your home well.`}
              </Text>
            </Section>

            <Section style={insightCard}>
              <Text style={insightTitle}>For Potential Buyers</Text>
              <Text style={insightText}>
                {marketType === "seller"
                  ? "Competition is strong, so being pre-approved and ready to act quickly is important. I can help you navigate competitive situations."
                  : marketType === "buyer"
                  ? "You have more options and negotiating room than sellers have seen in recent years. It's a good time to explore what's available."
                  : "Conditions are fair for both sides. Focus on finding the right home rather than trying to time the market perfectly."}
              </Text>
            </Section>

            <Section style={insightCard}>
              <Text style={insightTitle}>For the Curious</Text>
              <Text style={insightText}>
                Even if you're not buying or selling soon, it's wise to understand
                what your home might be worth. I'm happy to provide a no-obligation
                market analysis whenever you'd like.
              </Text>
            </Section>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/market/">
                Explore Local Market Data
              </Button>
            </Section>

            <Text style={paragraph}>
              Next time, I'll share more about how I can help with whatever real
              estate needs you might have - now or in the future.
            </Text>

            <Text style={signature}>
              Here to keep you informed,
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

const metricsBox: React.CSSProperties = {
  backgroundColor: "#1a1a1a",
  borderRadius: "8px",
  padding: "25px",
  margin: "25px 0",
};

const metricRow: React.CSSProperties = {
  display: "flex",
  gap: "20px",
  marginBottom: "20px",
};

const metric: React.CSSProperties = {
  flex: 1,
  textAlign: "center" as const,
};

const metricLabel: React.CSSProperties = {
  fontSize: "12px",
  color: "#999",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 8px",
};

const metricValue: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: "bold",
  color: "#C99C33",
  margin: "0",
};

const marketTypeBox: React.CSSProperties = {
  borderTop: "1px solid #333",
  paddingTop: "20px",
  textAlign: "center" as const,
};

const marketTypeLabel: React.CSSProperties = {
  fontSize: "12px",
  color: "#999",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 8px",
};

const marketTypeValue: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "600",
  color: "#ffffff",
  margin: "0 0 10px",
};

const marketTypeDesc: React.CSSProperties = {
  fontSize: "13px",
  color: "#999",
  margin: "0",
  lineHeight: "1.5",
};

const insightCard: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  padding: "20px",
  borderRadius: "8px",
  marginBottom: "15px",
};

const insightTitle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: "600",
  color: "#C99C33",
  margin: "0 0 8px",
};

const insightText: React.CSSProperties = {
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

export default GeneralOverviewEmail;
