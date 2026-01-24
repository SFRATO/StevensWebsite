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

interface CaseStudyEmailProps {
  location: string;
}

export const CaseStudyEmail: React.FC<CaseStudyEmailProps> = ({
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
              How I Helped a {location} Seller Get Top Dollar
            </Heading>

            <Text style={paragraph}>
              I want to share a recent success story that shows what's possible
              in today's {location} market—and the approach that makes it
              happen.
            </Text>

            <Section style={caseStudyBox}>
              <Text style={caseLabel}>RECENT SALE</Text>
              <Heading as="h3" style={caseTitle}>
                Single Family Home in {location}
              </Heading>

              <Section style={resultsGrid}>
                <Section style={resultItem}>
                  <Text style={resultLabel}>List Price</Text>
                  <Text style={resultValue}>$425,000</Text>
                </Section>
                <Section style={resultItem}>
                  <Text style={resultLabel}>Sale Price</Text>
                  <Text style={resultValueHighlight}>$445,000</Text>
                </Section>
                <Section style={resultItem}>
                  <Text style={resultLabel}>Days on Market</Text>
                  <Text style={resultValue}>8</Text>
                </Section>
              </Section>
            </Section>

            <Heading as="h3" style={subheading}>
              What Made the Difference
            </Heading>

            <Text style={paragraph}>
              <strong>Strategic pricing:</strong> We priced just under a key
              threshold to maximize buyer interest and trigger competitive
              bidding.
            </Text>

            <Text style={paragraph}>
              <strong>Professional preparation:</strong> Minor updates and
              staging helped buyers see the home's full potential—without major
              renovation costs.
            </Text>

            <Text style={paragraph}>
              <strong>Targeted marketing:</strong> Rather than just posting on
              the MLS, I used data-driven targeting to reach the most likely
              buyer demographics.
            </Text>

            <Text style={paragraph}>
              <strong>Skilled negotiation:</strong> When multiple offers came
              in, I positioned my clients to select the strongest overall offer,
              not just the highest number.
            </Text>

            <Section style={quoteBox}>
              <Text style={quoteText}>
                "Steven's data-driven approach gave us confidence in our pricing
                decision, and his negotiation skills helped us close above
                asking. The whole process was smoother than we expected."
              </Text>
              <Text style={quoteAuthor}>— Recent {location} Seller</Text>
            </Section>

            <Text style={paragraph}>
              Every home and seller has unique circumstances. I'd be happy to
              discuss how a similar approach could work for your situation.
            </Text>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Let's Talk About Your Home
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
  margin: "25px 0 15px",
};

const paragraph: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#333",
  margin: "0 0 15px",
};

const caseStudyBox: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  border: "1px solid #e0e0e0",
  borderRadius: "8px",
  padding: "25px",
  margin: "20px 0",
};

const caseLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: "bold",
  color: "#C99C33",
  letterSpacing: "1px",
  margin: "0 0 5px",
};

const caseTitle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 20px",
};

const resultsGrid: React.CSSProperties = {
  display: "flex",
  gap: "15px",
};

const resultItem: React.CSSProperties = {
  flex: "1",
  textAlign: "center" as const,
};

const resultLabel: React.CSSProperties = {
  fontSize: "12px",
  color: "#666",
  margin: "0 0 5px",
};

const resultValue: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "bold",
  color: "#1a1a1a",
  margin: "0",
};

const resultValueHighlight: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "bold",
  color: "#4CAF50",
  margin: "0",
};

const quoteBox: React.CSSProperties = {
  borderLeft: "3px solid #C99C33",
  paddingLeft: "20px",
  margin: "25px 0",
};

const quoteText: React.CSSProperties = {
  fontSize: "16px",
  fontStyle: "italic",
  lineHeight: "1.6",
  color: "#333",
  margin: "0 0 10px",
};

const quoteAuthor: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
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

export default CaseStudyEmail;
