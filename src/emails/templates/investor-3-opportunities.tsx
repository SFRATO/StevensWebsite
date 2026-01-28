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

interface InvestorOpportunitiesEmailProps {
  name: string;
  town: string;
  county: string;
  unsubscribeUrl?: string;
}

export const InvestorOpportunitiesEmail: React.FC<InvestorOpportunitiesEmailProps> = ({
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
              Investment Hotspots in {county}
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              Not all areas within {county} offer the same investment potential.
              Today I'll share where experienced investors are finding
              opportunities - and what makes each area attractive.
            </Text>

            <Heading as="h3" style={subheading}>
              What Smart Investors Look For
            </Heading>

            <Section style={criteriaGrid}>
              <Section style={criteriaBox}>
                <Text style={criteriaIcon}>📈</Text>
                <Text style={criteriaTitle}>Growth Indicators</Text>
                <Text style={criteriaText}>
                  New businesses, infrastructure improvements, and population
                  influx signal future appreciation
                </Text>
              </Section>

              <Section style={criteriaBox}>
                <Text style={criteriaIcon}>🏢</Text>
                <Text style={criteriaTitle}>Employment Centers</Text>
                <Text style={criteriaText}>
                  Proximity to major employers creates consistent rental demand
                  and tenant stability
                </Text>
              </Section>

              <Section style={criteriaBox}>
                <Text style={criteriaIcon}>🏫</Text>
                <Text style={criteriaTitle}>School Quality</Text>
                <Text style={criteriaText}>
                  Good schools attract families willing to pay premium rents for
                  family-friendly neighborhoods
                </Text>
              </Section>

              <Section style={criteriaBox}>
                <Text style={criteriaIcon}>🚂</Text>
                <Text style={criteriaTitle}>Transit Access</Text>
                <Text style={criteriaText}>
                  NJ Transit connections expand your tenant pool to Philadelphia
                  and NYC commuters
                </Text>
              </Section>
            </Section>

            <Heading as="h3" style={subheading}>
              Types of Investment Opportunities
            </Heading>

            <Section style={opportunityCard}>
              <Text style={opportunityTitle}>Single-Family Rentals</Text>
              <Text style={opportunityText}>
                Lower barrier to entry, easier to manage, and strong tenant
                demand from families. Look for homes in established neighborhoods
                with good schools.
              </Text>
              <Text style={opportunityMetric}>
                Typical entry: $250K - $400K
              </Text>
            </Section>

            <Section style={opportunityCard}>
              <Text style={opportunityTitle}>Multi-Family Properties</Text>
              <Text style={opportunityText}>
                Duplexes and small apartment buildings offer better cash flow per
                dollar invested. Some areas of {county} have excellent 2-4 unit
                opportunities.
              </Text>
              <Text style={opportunityMetric}>
                Typical entry: $350K - $700K
              </Text>
            </Section>

            <Section style={opportunityCard}>
              <Text style={opportunityTitle}>Value-Add Opportunities</Text>
              <Text style={opportunityText}>
                Properties needing work can be purchased below market, renovated,
                and either rented at higher rates or flipped. Requires more
                capital and expertise.
              </Text>
              <Text style={opportunityMetric}>
                Returns: Higher risk, higher potential
              </Text>
            </Section>

            <Section style={highlightBox}>
              <Text style={highlightTitle}>Off-Market Opportunities</Text>
              <Text style={highlightText}>
                Some of the best investment deals never hit the MLS. Through my
                network of property owners, estate attorneys, and other agents, I
                often hear about opportunities before they go public. If you're
                a serious investor, I can keep you informed of these situations.
              </Text>
            </Section>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Get Notified of Investment Opportunities
              </Button>
            </Section>

            <Text style={paragraph}>
              Next time, I'll cover tax considerations for {county} investors -
              including strategies to maximize your after-tax returns.
            </Text>

            <Text style={signature}>
              Helping you find the right opportunities,
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

const criteriaGrid: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "15px",
  margin: "20px 0",
};

const criteriaBox: React.CSSProperties = {
  flex: "1 1 calc(50% - 15px)",
  minWidth: "200px",
  backgroundColor: "#f9f9f9",
  padding: "20px",
  borderRadius: "8px",
  textAlign: "center" as const,
};

const criteriaIcon: React.CSSProperties = {
  fontSize: "24px",
  margin: "0 0 10px",
};

const criteriaTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 8px",
};

const criteriaText: React.CSSProperties = {
  fontSize: "13px",
  color: "#666",
  margin: "0",
  lineHeight: "1.4",
};

const opportunityCard: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  padding: "20px",
  borderRadius: "8px",
  marginBottom: "15px",
  borderLeft: "3px solid #C99C33",
};

const opportunityTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 8px",
};

const opportunityText: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  margin: "0 0 10px",
  lineHeight: "1.5",
};

const opportunityMetric: React.CSSProperties = {
  fontSize: "13px",
  color: "#C99C33",
  fontWeight: "600",
  margin: "0",
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

export default InvestorOpportunitiesEmail;
