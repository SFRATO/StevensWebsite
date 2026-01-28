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

interface BuyerNeighborhoodsEmailProps {
  name: string;
  town: string;
  county: string;
  unsubscribeUrl?: string;
}

export const BuyerNeighborhoodsEmail: React.FC<BuyerNeighborhoodsEmailProps> = ({
  name = "Homebuyer",
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
              Discovering {town}'s Best Neighborhoods
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              One of the most important decisions when buying a home isn't just
              the house itself - it's the neighborhood. Today I want to share
              what makes {town} and surrounding areas in {county} special.
            </Text>

            <Heading as="h3" style={subheading}>
              What to Consider When Choosing a Neighborhood
            </Heading>

            <Section style={tipBox}>
              <div style={tipNumber}>1</div>
              <div style={tipContent}>
                <Text style={tipTitle}>School Districts</Text>
                <Text style={tipText}>
                  Even if you don't have school-age children, school quality
                  significantly impacts home values and resale potential.
                </Text>
              </div>
            </Section>

            <Section style={tipBox}>
              <div style={tipNumber}>2</div>
              <div style={tipContent}>
                <Text style={tipTitle}>Commute & Transportation</Text>
                <Text style={tipText}>
                  Consider your daily commute, access to major highways, and
                  proximity to NJ Transit options if you work in Philadelphia or NYC.
                </Text>
              </div>
            </Section>

            <Section style={tipBox}>
              <div style={tipNumber}>3</div>
              <div style={tipContent}>
                <Text style={tipTitle}>Future Development</Text>
                <Text style={tipText}>
                  Ask about planned developments. New shopping centers or
                  infrastructure can increase property values, while some changes
                  might not align with your preferences.
                </Text>
              </div>
            </Section>

            <Section style={tipBox}>
              <div style={tipNumber}>4</div>
              <div style={tipContent}>
                <Text style={tipTitle}>Community & Lifestyle</Text>
                <Text style={tipText}>
                  Visit at different times of day. Talk to neighbors if you can.
                  Each community has its own character and pace.
                </Text>
              </div>
            </Section>

            <Section style={highlightBox}>
              <Text style={highlightTitle}>Local Insight</Text>
              <Text style={highlightText}>
                {county} offers diverse options - from quiet suburban streets to
                communities with walkable downtown areas. Each has its own
                personality and price points. I can help you find the one that
                fits your lifestyle.
              </Text>
            </Section>

            <Text style={paragraph}>
              The best way to get to know a neighborhood is to spend time there.
              I'm happy to show you around different areas and share what I know
              about each community.
            </Text>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Schedule a Neighborhood Tour
              </Button>
            </Section>

            <Text style={paragraph}>
              In my next email, I'll share smart buying strategies for {town}'s
              current market - how to make competitive offers without overextending.
            </Text>

            <Text style={signature}>
              Here to help you find your place,
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

const tipBox: React.CSSProperties = {
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

const highlightBox: React.CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%)",
  padding: "20px",
  borderRadius: "8px",
  borderLeft: "4px solid #C99C33",
  margin: "25px 0",
};

const highlightTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#C99C33",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
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

export default BuyerNeighborhoodsEmail;
