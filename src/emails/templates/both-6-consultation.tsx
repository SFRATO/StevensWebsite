import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Link,
} from "@react-email/components";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { Button } from "../components/Button";

interface BothConsultationEmailProps {
  name: string;
  town: string;
  county: string;
  marketType?: "seller" | "buyer" | "balanced";
  unsubscribeUrl?: string;
}

export const BothConsultationEmail: React.FC<BothConsultationEmailProps> = ({
  name = "Homeowner",
  town = "Burlington",
  county = "Burlington County",
  marketType = "balanced",
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
              Let's Plan Your {town} Move Together
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              Over the past two weeks, I've shared strategies for timing,
              valuation, home searching, and coordinating buy-sell transactions
              in {county}. Now I'd like to put it all together with a
              personalized plan for your situation.
            </Text>

            <Section style={invitationBox}>
              <Heading as="h3" style={invitationTitle}>
                Free Buy-Sell Strategy Session
              </Heading>
              <Text style={invitationText}>
                In this no-obligation consultation, we'll create your personalized
                plan:
              </Text>
              <ul style={invitationList}>
                <li>Assess your current home's market value</li>
                <li>Determine the best timing approach for your situation</li>
                <li>Review your financing options and buying power</li>
                <li>Discuss what you're looking for in your next home</li>
                <li>Map out a realistic timeline for both transactions</li>
                <li>Answer all your questions about the process</li>
              </ul>
            </Section>

            <Text style={paragraph}>
              Buying and selling simultaneously is one of the more complex real
              estate scenarios - but it doesn't have to be stressful. With the
              right plan and an experienced agent coordinating both sides, it can
              actually be quite smooth.
            </Text>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Schedule Your Strategy Session
              </Button>
            </Section>

            <Heading as="h3" style={subheading}>
              Reach Me Directly
            </Heading>

            <Section style={contactBox}>
              <table style={contactTable}>
                <tbody>
                  <tr>
                    <td style={contactLabel}>Phone:</td>
                    <td style={contactValue}>
                      <Link href="tel:6097890126" style={contactLink}>
                        (609) 789-0126
                      </Link>
                    </td>
                  </tr>
                  <tr>
                    <td style={contactLabel}>Email:</td>
                    <td style={contactValue}>
                      <Link href="mailto:sf@stevenfrato.com" style={contactLink}>
                        sf@stevenfrato.com
                      </Link>
                    </td>
                  </tr>
                  <tr>
                    <td style={contactLabel}>Text:</td>
                    <td style={contactValue}>Same number - I respond quickly!</td>
                  </tr>
                </tbody>
              </table>
            </Section>

            <Section style={testimonialBox}>
              <Text style={testimonialQuote}>
                "Steven coordinated the sale of our home and purchase of our new
                one seamlessly. We closed on both the same day and moved directly
                from one house to the other. What could have been incredibly
                stressful was actually smooth and well-organized."
              </Text>
              <Text style={testimonialAuthor}>— Recent {county} Client</Text>
            </Section>

            <Text style={paragraph}>
              Whether you're ready to start the process now or just want to
              understand your options, I'm here to help - at whatever pace feels
              right for you.
            </Text>

            <Text style={signature}>
              Looking forward to helping you make your move,
              <br />
              <br />
              <strong>Steven Frato</strong>
              <br />
              Century 21
              <br />
              Your {town} Real Estate Expert
            </Text>

            <Section style={psSection}>
              <Text style={psText}>
                <strong>P.S.</strong> Every month that passes, your situation
                could change - market conditions shift, interest rates move, and
                your home's value fluctuates. Even if you're not ready to list
                today, a strategy session now can help you plan for whenever the
                time is right. I'm here when you're ready.
              </Text>
            </Section>
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

const invitationBox: React.CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%)",
  padding: "25px",
  borderRadius: "8px",
  borderLeft: "4px solid #C99C33",
  margin: "25px 0",
};

const invitationTitle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 15px",
};

const invitationText: React.CSSProperties = {
  fontSize: "15px",
  color: "#333",
  margin: "0 0 10px",
};

const invitationList: React.CSSProperties = {
  paddingLeft: "20px",
  margin: "0",
  lineHeight: "1.8",
};

const contactBox: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  padding: "20px",
  borderRadius: "8px",
  margin: "20px 0",
};

const contactTable: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse" as const,
};

const contactLabel: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  padding: "8px 0",
  width: "80px",
};

const contactValue: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "500",
  color: "#1a1a1a",
  padding: "8px 0",
};

const contactLink: React.CSSProperties = {
  color: "#C99C33",
  textDecoration: "none",
};

const testimonialBox: React.CSSProperties = {
  backgroundColor: "#1a1a1a",
  padding: "25px",
  borderRadius: "8px",
  margin: "25px 0",
};

const testimonialQuote: React.CSSProperties = {
  fontSize: "15px",
  fontStyle: "italic",
  color: "#ffffff",
  lineHeight: "1.6",
  margin: "0 0 15px",
};

const testimonialAuthor: React.CSSProperties = {
  fontSize: "13px",
  color: "#C99C33",
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

const psSection: React.CSSProperties = {
  marginTop: "25px",
  paddingTop: "20px",
  borderTop: "1px solid #eee",
};

const psText: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  lineHeight: "1.6",
  margin: "0",
};

export default BothConsultationEmail;
