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
  name: string;
  address: string;
  town: string;
  zipcode: string;
}

export const WelcomeReportEmail: React.FC<WelcomeReportEmailProps> = ({
  name = "Homeowner",
  address = "123 Main Street",
  town = "Burlington",
  zipcode = "08016",
}) => {
  // Generate the PDF download URL
  const pdfParams = new URLSearchParams({
    zipcode,
    name,
    address,
    town,
  });
  const pdfUrl = `https://stevenfrato.com/.netlify/functions/generate-pdf?${pdfParams.toString()}`;

  const fullAddress = `${address}, ${town}, NJ ${zipcode}`;

  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Header />

          <Section style={content}>
            <Heading style={heading}>
              Your {town} Market Report is Ready
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              Thank you for your interest in the {town}, NJ real estate market.
              I've prepared a personalized market analysis based on your
              property at:
            </Text>

            <Section style={addressBox}>
              <Text style={addressText}>{fullAddress}</Text>
            </Section>

            <Section style={ctaSection}>
              <Button href={pdfUrl}>Download Your Market Report (PDF)</Button>
            </Section>

            <Heading as="h3" style={subheading}>
              What's in Your Report:
            </Heading>

            <ul style={list}>
              <li style={listItem}>
                Current market conditions for {town} ({zipcode})
              </li>
              <li style={listItem}>
                Median sale price and year-over-year trends
              </li>
              <li style={listItem}>Days on market and inventory levels</li>
              <li style={listItem}>
                Whether it's a buyer's or seller's market
              </li>
            </ul>

            <Section style={consultationBox}>
              <Text style={consultationTitle}>
                Want to discuss your options?
              </Text>
              <Text style={consultationText}>
                I'm happy to provide a complimentary home value consultation.
                Just reply to this email or call me directly.
              </Text>
            </Section>

            <Text style={paragraph}>
              I'll be sending you more insights about the {town} market over the
              coming weeks. In the meantime, feel free to reach out if you have
              any questions about your home's value or the selling process.
            </Text>

            <Text style={signature}>
              Best regards,
              <br />
              <strong>Steven Frato</strong>
              <br />
              Century 21
              <br />
              (609) 789-0126
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

const consultationBox: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%)",
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

export default WelcomeReportEmail;
