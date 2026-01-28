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

interface GeneralServicesEmailProps {
  name: string;
  town: string;
  county: string;
  unsubscribeUrl?: string;
}

export const GeneralServicesEmail: React.FC<GeneralServicesEmailProps> = ({
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
              How I Can Help With Your Real Estate Goals
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              Real estate decisions are significant - whether you're buying your
              first home, selling a property you've lived in for years, or
              exploring investment opportunities. Here's how I work with clients
              at every stage.
            </Text>

            <Heading as="h3" style={subheading}>
              For Sellers
            </Heading>

            <Section style={serviceBox}>
              <ul style={serviceList}>
                <li style={serviceItem}>
                  <strong>Accurate Pricing:</strong> I analyze recent sales, current
                  competition, and your home's unique features to price it right
                  from the start
                </li>
                <li style={serviceItem}>
                  <strong>Strategic Marketing:</strong> Professional photography,
                  compelling descriptions, and exposure on major platforms
                </li>
                <li style={serviceItem}>
                  <strong>Preparation Guidance:</strong> Advice on what improvements
                  make sense and what to skip
                </li>
                <li style={serviceItem}>
                  <strong>Negotiation:</strong> Protecting your interests while
                  keeping deals together
                </li>
                <li style={serviceItem}>
                  <strong>Transaction Management:</strong> Coordinating inspections,
                  appraisals, and closing details
                </li>
              </ul>
            </Section>

            <Heading as="h3" style={subheading}>
              For Buyers
            </Heading>

            <Section style={serviceBox}>
              <ul style={serviceList}>
                <li style={serviceItem}>
                  <strong>Needs Assessment:</strong> Understanding what you want
                  and what you need - they're not always the same
                </li>
                <li style={serviceItem}>
                  <strong>Market Education:</strong> Helping you understand values
                  so you can recognize good opportunities
                </li>
                <li style={serviceItem}>
                  <strong>Home Search:</strong> Finding properties that match your
                  criteria, including some you might not find on your own
                </li>
                <li style={serviceItem}>
                  <strong>Offer Strategy:</strong> Crafting competitive offers that
                  protect your interests
                </li>
                <li style={serviceItem}>
                  <strong>Due Diligence:</strong> Guiding you through inspections,
                  financing, and closing
                </li>
              </ul>
            </Section>

            <Heading as="h3" style={subheading}>
              For Everyone
            </Heading>

            <Section style={serviceBox}>
              <ul style={serviceList}>
                <li style={serviceItem}>
                  <strong>Market Information:</strong> Stay informed about values
                  and trends in your area
                </li>
                <li style={serviceItem}>
                  <strong>Professional Network:</strong> Referrals to trusted
                  lenders, inspectors, contractors, and attorneys
                </li>
                <li style={serviceItem}>
                  <strong>Honest Advice:</strong> Even if it's not what you want
                  to hear - I'd rather be helpful than just agreeable
                </li>
              </ul>
            </Section>

            <Section style={highlightBox}>
              <Text style={highlightTitle}>No Pressure, Ever</Text>
              <Text style={highlightText}>
                I'm not interested in pushing anyone into decisions they're not
                ready for. My job is to provide information and guidance so you
                can make the right choice for your situation - whether that
                happens now, in six months, or in two years.
              </Text>
            </Section>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Let's Talk About Your Goals
              </Button>
            </Section>

            <Text style={paragraph}>
              In my next email, I'll wrap things up with an open invitation to
              connect whenever you're ready. No pressure, just an offer to help.
            </Text>

            <Text style={signature}>
              Here when you need me,
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

const serviceBox: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  padding: "20px",
  borderRadius: "8px",
  marginBottom: "20px",
};

const serviceList: React.CSSProperties = {
  paddingLeft: "20px",
  margin: "0",
};

const serviceItem: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.7",
  color: "#333",
  marginBottom: "10px",
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

export default GeneralServicesEmail;
