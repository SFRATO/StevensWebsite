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

interface InvestorConsultationEmailProps {
  name: string;
  town: string;
  county: string;
  unsubscribeUrl?: string;
}

export const InvestorConsultationEmail: React.FC<InvestorConsultationEmailProps> = ({
  name = "Investor",
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
              Let's Discuss Your Investment Strategy
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              Over the past two weeks, I've shared market data, ROI frameworks,
              investment hotspots, and tax considerations for {county}. Now I'd
              like to offer something more personalized.
            </Text>

            <Section style={invitationBox}>
              <Heading as="h3" style={invitationTitle}>
                Free Investor Consultation
              </Heading>
              <Text style={invitationText}>
                In this no-obligation meeting, we can discuss:
              </Text>
              <ul style={invitationList}>
                <li>Your investment goals and criteria</li>
                <li>Current opportunities that match your parameters</li>
                <li>ROI analysis on specific properties</li>
                <li>Market trends and timing considerations</li>
                <li>Professional referrals (CPAs, attorneys, lenders)</li>
                <li>Property management options if needed</li>
              </ul>
            </Section>

            <Text style={paragraph}>
              I work with investors at all levels - from those purchasing their
              first rental property to experienced investors expanding their
              portfolios. Whatever your situation, I can provide honest insights
              and help you find opportunities that meet your criteria.
            </Text>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Schedule Your Investor Consultation
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

            <Heading as="h3" style={subheading}>
              What I Bring to Investor Clients
            </Heading>

            <Section style={valueGrid}>
              <Section style={valueItem}>
                <Text style={valueTitle}>Market Knowledge</Text>
                <Text style={valueText}>
                  Deep understanding of {county}'s neighborhoods, values, and
                  rental rates
                </Text>
              </Section>
              <Section style={valueItem}>
                <Text style={valueTitle}>Deal Analysis</Text>
                <Text style={valueText}>
                  Help you run the numbers and identify properties worth pursuing
                </Text>
              </Section>
              <Section style={valueItem}>
                <Text style={valueTitle}>Off-Market Access</Text>
                <Text style={valueText}>
                  Network connections that surface opportunities before they hit
                  the MLS
                </Text>
              </Section>
              <Section style={valueItem}>
                <Text style={valueTitle}>Investor Focus</Text>
                <Text style={valueText}>
                  I understand investors think differently than homebuyers - ROI
                  matters
                </Text>
              </Section>
            </Section>

            <Text style={signature}>
              Looking forward to helping you build your portfolio,
              <br />
              <br />
              <strong>Steven Frato</strong>
              <br />
              Century 21
              <br />
              Your {county} Investment Property Specialist
            </Text>

            <Section style={psSection}>
              <Text style={psText}>
                <strong>P.S.</strong> Real estate investing rewards those who
                take informed action. While others wait for the "perfect" time,
                successful investors are steadily building portfolios and cash
                flow. If you've been considering investment properties, let's
                talk about what makes sense for your goals. I'm here when you're
                ready.
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

const valueGrid: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "15px",
  margin: "20px 0",
};

const valueItem: React.CSSProperties = {
  flex: "1 1 calc(50% - 15px)",
  minWidth: "200px",
  backgroundColor: "#f9f9f9",
  padding: "15px",
  borderRadius: "8px",
};

const valueTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 5px",
};

const valueText: React.CSSProperties = {
  fontSize: "13px",
  color: "#666",
  margin: "0",
  lineHeight: "1.4",
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

export default InvestorConsultationEmail;
