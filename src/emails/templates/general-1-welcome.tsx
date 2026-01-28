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

interface GeneralWelcomeEmailProps {
  name: string;
  town: string;
  county: string;
  unsubscribeUrl?: string;
}

export const GeneralWelcomeEmail: React.FC<GeneralWelcomeEmailProps> = ({
  name = "Friend",
  town = "Burlington",
  county = "Burlington County",
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
              Thank You for Your Interest in {town} Real Estate
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              Thank you for reaching out about real estate in {town}. Whether
              you're just starting to explore your options or have specific
              questions, I'm here to help.
            </Text>

            <Section style={introBox}>
              <Text style={introTitle}>A Bit About Me</Text>
              <Text style={introText}>
                I'm a local real estate agent with Century 21, serving {county}{" "}
                and the surrounding areas. I believe in providing honest,
                straightforward advice - no pressure, just helpful information
                to guide your decisions.
              </Text>
            </Section>

            <Heading as="h3" style={subheading}>
              How I Can Help
            </Heading>

            <Section style={serviceGrid}>
              <Section style={serviceCard}>
                <Text style={serviceTitle}>Selling Your Home</Text>
                <Text style={serviceText}>
                  From pricing strategy to closing day, I'll guide you through
                  the entire selling process with local market expertise.
                </Text>
              </Section>

              <Section style={serviceCard}>
                <Text style={serviceTitle}>Buying a Home</Text>
                <Text style={serviceText}>
                  Whether you're a first-time buyer or experienced, I'll help
                  you find the right home at the right price.
                </Text>
              </Section>

              <Section style={serviceCard}>
                <Text style={serviceTitle}>Market Information</Text>
                <Text style={serviceText}>
                  Curious about values, trends, or what's happening in your
                  neighborhood? I'm happy to share insights.
                </Text>
              </Section>

              <Section style={serviceCard}>
                <Text style={serviceTitle}>Just Questions</Text>
                <Text style={serviceText}>
                  Not sure where to start? I'm glad to answer questions with no
                  obligation - that's what I'm here for.
                </Text>
              </Section>
            </Section>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Let's Connect
              </Button>
            </Section>

            <Text style={paragraph}>
              Over the next couple of weeks, I'll share some helpful information
              about the {county} real estate market. If you have specific
              questions before then, don't hesitate to reach out.
            </Text>

            <Text style={signature}>
              Looking forward to helping you,
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

const introBox: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  padding: "20px",
  borderRadius: "8px",
  margin: "25px 0",
  borderLeft: "3px solid #C99C33",
};

const introTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#C99C33",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 10px",
};

const introText: React.CSSProperties = {
  fontSize: "15px",
  color: "#666",
  margin: "0",
  lineHeight: "1.6",
};

const serviceGrid: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "15px",
  margin: "20px 0",
};

const serviceCard: React.CSSProperties = {
  flex: "1 1 calc(50% - 15px)",
  minWidth: "200px",
  backgroundColor: "#f9f9f9",
  padding: "20px",
  borderRadius: "8px",
};

const serviceTitle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 8px",
};

const serviceText: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  margin: "0",
  lineHeight: "1.5",
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

export default GeneralWelcomeEmail;
