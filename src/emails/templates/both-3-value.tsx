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

interface BothValueEmailProps {
  name: string;
  town: string;
  medianPrice?: string;
  priceChange?: string;
  marketType?: "seller" | "buyer" | "balanced";
  unsubscribeUrl?: string;
}

export const BothValueEmail: React.FC<BothValueEmailProps> = ({
  name = "Homeowner",
  town = "Burlington",
  medianPrice = "$385,000",
  priceChange = "+4.2%",
  marketType = "balanced",
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
              What's Your {town} Home Worth Today?
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              When you're buying and selling, understanding your current home's
              value is essential. It determines how much you have to put toward
              your next home and what financing you might need.
            </Text>

            <Section style={valueBox}>
              <Text style={valueLabel}>{town} Median Sale Price</Text>
              <Text style={valueAmount}>{medianPrice}</Text>
              <Text
                style={{
                  ...valueChange,
                  color: isPositive ? "#4CAF50" : "#f44336",
                }}
              >
                {priceChange} vs. last year
              </Text>
            </Section>

            <Heading as="h3" style={subheading}>
              What Affects Your Home's Value
            </Heading>

            <Section style={factorGrid}>
              <Section style={factorBox}>
                <Text style={factorTitle}>Location & Lot</Text>
                <Text style={factorText}>
                  Street, neighborhood, school district, lot size
                </Text>
              </Section>
              <Section style={factorBox}>
                <Text style={factorTitle}>Size & Layout</Text>
                <Text style={factorText}>
                  Square footage, bedrooms, bathrooms, floor plan
                </Text>
              </Section>
              <Section style={factorBox}>
                <Text style={factorTitle}>Condition</Text>
                <Text style={factorText}>
                  Age, updates, maintenance, cosmetic appeal
                </Text>
              </Section>
              <Section style={factorBox}>
                <Text style={factorTitle}>Recent Sales</Text>
                <Text style={factorText}>
                  What similar homes nearby have sold for
                </Text>
              </Section>
            </Section>

            <Text style={paragraph}>
              Online estimates (Zillow, Redfin) can be a starting point, but
              they often miss important details. They don't know about your
              renovated kitchen, finished basement, or the flood-prone lot next
              door.
            </Text>

            <Section style={highlightBox}>
              <Text style={highlightTitle}>Get an Accurate Picture</Text>
              <Text style={highlightText}>
                I can provide a detailed comparative market analysis (CMA) of your
                home - looking at actual recent sales of similar properties, not
                algorithms. This gives you real numbers to plan with, whether
                you're listing in two weeks or two months.
              </Text>
            </Section>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Request Your Free Home Valuation
              </Button>
            </Section>

            <Heading as="h3" style={subheading}>
              Why This Matters for Your Purchase
            </Heading>

            <Text style={paragraph}>
              Your current home's equity is likely your biggest asset for the next
              purchase. Knowing its value helps you:
            </Text>

            <ul style={list}>
              <li style={listItem}>
                Set a realistic budget for your next home
              </li>
              <li style={listItem}>
                Determine if you need bridge financing
              </li>
              <li style={listItem}>
                Negotiate confidently on both sides
              </li>
              <li style={listItem}>
                Plan for any gap between sale and purchase
              </li>
            </ul>

            <Text style={paragraph}>
              Next up, I'll share how to find your next home while managing your
              current home sale - the search strategy that works best for people
              in your situation.
            </Text>

            <Text style={signature}>
              Here to help you understand your options,
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

const valueBox: React.CSSProperties = {
  backgroundColor: "#1a1a1a",
  padding: "30px",
  borderRadius: "8px",
  textAlign: "center" as const,
  margin: "25px 0",
};

const valueLabel: React.CSSProperties = {
  fontSize: "12px",
  color: "#999",
  textTransform: "uppercase" as const,
  letterSpacing: "1px",
  margin: "0 0 10px",
};

const valueAmount: React.CSSProperties = {
  fontSize: "42px",
  fontWeight: "bold",
  color: "#C99C33",
  margin: "0",
};

const valueChange: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  margin: "10px 0 0",
};

const factorGrid: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "15px",
  margin: "20px 0",
};

const factorBox: React.CSSProperties = {
  flex: "1 1 calc(50% - 15px)",
  minWidth: "200px",
  backgroundColor: "#f9f9f9",
  padding: "15px",
  borderRadius: "8px",
};

const factorTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 5px",
};

const factorText: React.CSSProperties = {
  fontSize: "13px",
  color: "#666",
  margin: "0",
  lineHeight: "1.4",
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

const signature: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#333",
  margin: "30px 0 0",
};

export default BothValueEmail;
