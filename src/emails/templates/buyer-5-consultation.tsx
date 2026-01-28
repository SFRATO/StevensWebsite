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

interface BuyerConsultationEmailProps {
  name: string;
  town: string;
  county: string;
  marketType?: "seller" | "buyer" | "balanced";
  unsubscribeUrl?: string;
}

export const BuyerConsultationEmail: React.FC<BuyerConsultationEmailProps> = ({
  name = "Homebuyer",
  town = "Burlington",
  county = "Burlington County",
  marketType = "balanced",
  unsubscribeUrl,
}) => {
  const marketTypeLabel =
    marketType === "seller"
      ? "seller's market"
      : marketType === "buyer"
      ? "buyer's market"
      : "balanced market";

  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Header />

          <Section style={content}>
            <Heading style={heading}>
              Let's Find Your Perfect {town} Home
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              Over the past two weeks, I've shared neighborhood insights, buying
              strategies, and financing options for {county}. Now I'd like to
              offer something more personal.
            </Text>

            <Section style={invitationBox}>
              <Heading as="h3" style={invitationTitle}>
                Free Buyer Consultation
              </Heading>
              <Text style={invitationText}>
                In this no-obligation meeting, we can:
              </Text>
              <ul style={invitationList}>
                <li>Discuss what you're looking for in your next home</li>
                <li>Review current listings that match your criteria</li>
                <li>Answer any questions about the buying process</li>
                <li>Create a personalized search strategy</li>
                <li>Connect you with trusted lenders if needed</li>
              </ul>
            </Section>

            <Text style={paragraph}>
              Whether you're ready to start touring homes or just beginning to
              explore your options, I'm here to help - at whatever pace feels
              right for you.
            </Text>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Schedule Your Free Consultation
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

            <Text style={paragraph}>
              I know buying a home is a big decision. My job is to make the
              process as smooth and stress-free as possible while helping you find
              a home you'll love.
            </Text>

            <Text style={signature}>
              Looking forward to helping you find home,
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
                <strong>P.S.</strong> {town}'s {marketTypeLabel} conditions create
                unique opportunities.{" "}
                {marketType === "buyer"
                  ? "With more inventory available, now is a great time to find your ideal home."
                  : marketType === "seller"
                  ? "Having a knowledgeable agent on your side is essential in today's competitive environment."
                  : "The balanced market means good options without excessive pressure - a favorable time to buy."}{" "}
                I'm here when you're ready.
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

export default BuyerConsultationEmail;
