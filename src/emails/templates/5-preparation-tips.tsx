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

interface PreparationTipsEmailProps {
  location: string;
}

export const PreparationTipsEmail: React.FC<PreparationTipsEmailProps> = ({
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
              5 Things {location} Buyers Are Looking For Right Now
            </Heading>

            <Text style={paragraph}>
              After showing dozens of homes in {location} this year, I've
              noticed clear patterns in what buyers prioritize—and what causes
              them to pass. Here's what I've learned:
            </Text>

            <Section style={tipSection}>
              <Text style={tipNumber}>1</Text>
              <Section style={tipContent}>
                <Text style={tipTitle}>Updated Kitchens (But Not Always New)</Text>
                <Text style={tipText}>
                  Buyers want kitchens that feel current, but you don't need a
                  full renovation. Fresh paint, updated hardware, and modern
                  lighting can transform the space affordably.
                </Text>
              </Section>
            </Section>

            <Section style={tipSection}>
              <Text style={tipNumber}>2</Text>
              <Section style={tipContent}>
                <Text style={tipTitle}>Flexible Spaces for Remote Work</Text>
                <Text style={tipText}>
                  Since COVID, home offices have become essential. If you have
                  an extra bedroom or den, stage it as a workspace—even a
                  simple desk setup helps buyers visualize.
                </Text>
              </Section>
            </Section>

            <Section style={tipSection}>
              <Text style={tipNumber}>3</Text>
              <Section style={tipContent}>
                <Text style={tipTitle}>Clean, Neutral Presentation</Text>
                <Text style={tipText}>
                  Bold personal style can be polarizing. Neutral paint colors
                  and decluttered spaces allow buyers to imagine their own
                  belongings—which is key to forming an emotional connection.
                </Text>
              </Section>
            </Section>

            <Section style={tipSection}>
              <Text style={tipNumber}>4</Text>
              <Section style={tipContent}>
                <Text style={tipTitle}>Move-In Ready Condition</Text>
                <Text style={tipText}>
                  With rising renovation costs, buyers prioritize homes that
                  don't need immediate work. Addressing deferred maintenance now
                  can significantly increase buyer interest.
                </Text>
              </Section>
            </Section>

            <Section style={tipSection}>
              <Text style={tipNumber}>5</Text>
              <Section style={tipContent}>
                <Text style={tipTitle}>Outdoor Living Potential</Text>
                <Text style={tipText}>
                  Even small patios or decks matter. A clean, staged outdoor
                  space extends the perceived living area and appeals to buyers
                  looking for fresh air and entertainment options.
                </Text>
              </Section>
            </Section>

            <Section style={calloutBox}>
              <Text style={calloutText}>
                <strong>Not sure where to focus?</strong> I offer a
                complimentary pre-listing walkthrough where I'll identify the
                highest-impact improvements for your specific home and budget.
              </Text>
            </Section>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Schedule Your Walkthrough
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

const paragraph: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#333",
  margin: "0 0 25px",
};

const tipSection: React.CSSProperties = {
  display: "flex",
  gap: "15px",
  marginBottom: "20px",
};

const tipNumber: React.CSSProperties = {
  width: "36px",
  height: "36px",
  backgroundColor: "#C99C33",
  color: "#fff",
  borderRadius: "50%",
  fontSize: "16px",
  fontWeight: "bold",
  textAlign: "center" as const,
  lineHeight: "36px",
  flexShrink: 0,
  margin: "0",
};

const tipContent: React.CSSProperties = {
  flex: "1",
};

const tipTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 5px",
};

const tipText: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.5",
  color: "#666",
  margin: "0",
};

const calloutBox: React.CSSProperties = {
  backgroundColor: "#f0f7ff",
  border: "1px solid #d0e3ff",
  borderRadius: "8px",
  padding: "20px",
  margin: "30px 0",
};

const calloutText: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.6",
  color: "#333",
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

export default PreparationTipsEmail;
