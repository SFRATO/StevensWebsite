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

interface ConsultationCtaEmailProps {
  location: string;
  recipientName?: string;
}

export const ConsultationCtaEmail: React.FC<ConsultationCtaEmailProps> = ({
  location = "Burlington County",
  recipientName,
}) => {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Header />

          <Section style={content}>
            <Heading style={heading}>Ready to Discuss Your Options?</Heading>

            <Text style={paragraph}>
              {recipientName ? `Hi ${recipientName},` : "Hello,"}
            </Text>

            <Text style={paragraph}>
              Over the past few weeks, I've shared insights about the {location}{" "}
              market, pricing strategies, and what buyers are looking for. Now
              I'd like to offer something more personalized.
            </Text>

            <Text style={paragraph}>
              I'm inviting you to a free, no-obligation consultation where we
              can discuss your specific situation and goals.
            </Text>

            <Section style={meetingBox}>
              <Heading as="h3" style={meetingTitle}>
                What We'll Cover:
              </Heading>

              <Section style={checkItem}>
                <Text style={checkIcon}>✓</Text>
                <Text style={checkText}>
                  <strong>Your Timeline:</strong> Whether you're ready to sell
                  now or just planning ahead, we'll align our approach with your
                  schedule.
                </Text>
              </Section>

              <Section style={checkItem}>
                <Text style={checkIcon}>✓</Text>
                <Text style={checkText}>
                  <strong>Your Home's Value:</strong> I'll provide a detailed
                  market analysis based on current {location} conditions and
                  recent comparable sales.
                </Text>
              </Section>

              <Section style={checkItem}>
                <Text style={checkIcon}>✓</Text>
                <Text style={checkText}>
                  <strong>Your Questions:</strong> From staging to negotiations,
                  I'll answer any questions you have about the selling process.
                </Text>
              </Section>

              <Section style={checkItem}>
                <Text style={checkIcon}>✓</Text>
                <Text style={checkText}>
                  <strong>Your Options:</strong> We'll explore different
                  scenarios so you can make the best decision for your family.
                </Text>
              </Section>
            </Section>

            <Text style={paragraph}>
              This consultation is completely free and comes with no pressure or
              obligation. If we're a good fit, great. If not, you'll walk away
              with valuable information about your home's market position.
            </Text>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Schedule Your Free Consultation
              </Button>
              <Text style={ctaSubtext}>
                Or call me directly: (609) 789-0126
              </Text>
            </Section>

            <Text style={paragraph}>
              Thank you for following along with my market updates. I hope
              they've been helpful as you consider your next steps. I'd love the
              opportunity to help you achieve your real estate goals.
            </Text>

            <Text style={signature}>
              Looking forward to connecting,
              <br />
              <strong>Steven Frato</strong>
              <br />
              Century 21
              <br />
              (609) 789-0126
            </Text>

            <Section style={psSection}>
              <Text style={psText}>
                <strong>P.S.</strong> Even if you're not ready to sell right
                now, a consultation can help you understand what you'd need to
                do to maximize your home's value when the time is right.
              </Text>
            </Section>
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
  margin: "0 0 15px",
};

const meetingBox: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  border: "1px solid #e0e0e0",
  borderRadius: "8px",
  padding: "25px",
  margin: "25px 0",
};

const meetingTitle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 20px",
};

const checkItem: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  marginBottom: "15px",
};

const checkIcon: React.CSSProperties = {
  color: "#C99C33",
  fontSize: "18px",
  fontWeight: "bold",
  margin: "0",
  lineHeight: "1.5",
};

const checkText: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.5",
  color: "#333",
  margin: "0",
  flex: "1",
};

const ctaSection: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "35px 0",
  padding: "25px",
  backgroundColor: "#fafafa",
  borderRadius: "8px",
};

const ctaSubtext: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  margin: "15px 0 0",
};

const signature: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#333",
  margin: "30px 0 0",
};

const psSection: React.CSSProperties = {
  marginTop: "30px",
  paddingTop: "20px",
  borderTop: "1px solid #e0e0e0",
};

const psText: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "1.6",
  color: "#666",
  fontStyle: "italic",
  margin: "0",
};

export default ConsultationCtaEmail;
