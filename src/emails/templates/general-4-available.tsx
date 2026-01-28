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

interface GeneralAvailableEmailProps {
  name: string;
  town: string;
  county: string;
  unsubscribeUrl?: string;
}

export const GeneralAvailableEmail: React.FC<GeneralAvailableEmailProps> = ({
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
              I'm Here When You're Ready
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              This is the last email in this series, and I want to leave you with
              a simple message: whenever you have real estate questions or needs,
              I'm here to help.
            </Text>

            <Section style={openInvitation}>
              <Heading as="h3" style={invitationTitle}>
                An Open Invitation
              </Heading>
              <Text style={invitationText}>
                Whether it's next week, next year, or five years from now -
                whenever real estate comes up in your life, feel free to reach
                out. I'm happy to:
              </Text>
              <ul style={invitationList}>
                <li>Answer questions about the market</li>
                <li>Provide a home value estimate</li>
                <li>Discuss your options with no pressure</li>
                <li>Connect you with professionals I trust</li>
                <li>Just chat about real estate in general</li>
              </ul>
            </Section>

            <Heading as="h3" style={subheading}>
              How to Reach Me
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
                    <td style={contactValue}>Same number - often the fastest way!</td>
                  </tr>
                  <tr>
                    <td style={contactLabel}>Website:</td>
                    <td style={contactValue}>
                      <Link href="https://stevenfrato.com" style={contactLink}>
                        stevenfrato.com
                      </Link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Get in Touch Anytime
              </Button>
            </Section>

            <Section style={thanksBox}>
              <Text style={thanksText}>
                Thank you for taking the time to learn a bit about {county} real
                estate and what I do. Even if we never work together directly, I
                hope the information has been helpful. If you ever need anything
                real estate related - or know someone who does - please don't
                hesitate to reach out.
              </Text>
            </Section>

            <Text style={signature}>
              Wishing you all the best,
              <br />
              <br />
              <strong>Steven Frato</strong>
              <br />
              Century 21
              <br />
              Your {county} Real Estate Resource
            </Text>

            <Section style={psSection}>
              <Text style={psText}>
                <strong>P.S.</strong> If you found this information helpful and
                know someone else who might benefit, feel free to share my contact
                information. Referrals are the greatest compliment I can receive,
                and I promise to take excellent care of anyone you send my way.
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

const openInvitation: React.CSSProperties = {
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
  lineHeight: "1.6",
};

const invitationList: React.CSSProperties = {
  paddingLeft: "20px",
  margin: "0",
  lineHeight: "1.8",
  color: "#333",
};

const contactBox: React.CSSProperties = {
  backgroundColor: "#1a1a1a",
  padding: "25px",
  borderRadius: "8px",
  margin: "20px 0",
};

const contactTable: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse" as const,
};

const contactLabel: React.CSSProperties = {
  fontSize: "14px",
  color: "#999",
  padding: "10px 0",
  width: "80px",
};

const contactValue: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "500",
  color: "#ffffff",
  padding: "10px 0",
};

const contactLink: React.CSSProperties = {
  color: "#C99C33",
  textDecoration: "none",
};

const thanksBox: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  padding: "20px",
  borderRadius: "8px",
  margin: "25px 0",
};

const thanksText: React.CSSProperties = {
  fontSize: "15px",
  color: "#666",
  margin: "0",
  lineHeight: "1.6",
  fontStyle: "italic",
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

export default GeneralAvailableEmail;
