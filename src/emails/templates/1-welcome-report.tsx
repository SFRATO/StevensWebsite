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

interface WelcomeReportEmailProps {
  location: string;
  propertyAddress: string;
  recipientName?: string;
}

export const WelcomeReportEmail: React.FC<WelcomeReportEmailProps> = ({
  location = "Burlington County",
  propertyAddress = "123 Main Street, City, NJ",
  recipientName,
}) => {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Header />

          <Section style={content}>
            <Heading style={heading}>
              Your {location} Market Report is Ready
            </Heading>

            <Text style={paragraph}>
              {recipientName ? `Hi ${recipientName},` : "Hello,"}
            </Text>

            <Text style={paragraph}>
              Thank you for your interest in the {location} real estate market.
              I've prepared a personalized market analysis based on your
              property at:
            </Text>

            <Section style={addressBox}>
              <Text style={addressText}>{propertyAddress}</Text>
            </Section>

            <Heading as="h3" style={subheading}>
              What's in Your Report:
            </Heading>

            <ul style={list}>
              <li style={listItem}>
                Current market conditions for {location}
              </li>
              <li style={listItem}>Recent comparable sales in your area</li>
              <li style={listItem}>
                Estimated value range for your property
              </li>
              <li style={listItem}>Personalized selling recommendations</li>
            </ul>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/market/">
                View Latest Market Data
              </Button>
            </Section>

            <Text style={paragraph}>
              I'll be sending you more insights about the {location} market over
              the coming weeks. In the meantime, feel free to reach out if you
              have any questions about your home's value or the selling process.
            </Text>

            <Text style={signature}>
              Best regards,
              <br />
              <strong>Steven Frato</strong>
              <br />
              Century 21
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

const addressBox: React.CSSProperties = {
  backgroundColor: "#f5f5f5",
  padding: "15px 20px",
  borderRadius: "8px",
  margin: "20px 0",
};

const addressText: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#1a1a1a",
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

export default WelcomeReportEmail;
