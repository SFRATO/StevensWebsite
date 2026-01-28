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

interface InvestorRoiEmailProps {
  name: string;
  town: string;
  county: string;
  medianPrice?: string;
  unsubscribeUrl?: string;
}

export const InvestorRoiEmail: React.FC<InvestorRoiEmailProps> = ({
  name = "Investor",
  town = "Burlington",
  county = "Burlington County",
  medianPrice = "$385,000",
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
              ROI Analysis: What to Expect in {town}
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              Before investing in any property, you need to understand the numbers.
              Today I'll walk you through the ROI framework I use when evaluating
              investment properties in {county}.
            </Text>

            <Heading as="h3" style={subheading}>
              Key Metrics for {county} Investors
            </Heading>

            <Section style={metricCard}>
              <Text style={metricTitle}>Cap Rate</Text>
              <Text style={metricDescription}>
                (Annual Net Operating Income / Property Value) x 100
              </Text>
              <Text style={metricInsight}>
                In {county}, typical cap rates for single-family rentals range
                from 5-8%. Multi-family properties may offer slightly higher
                rates due to economies of scale.
              </Text>
            </Section>

            <Section style={metricCard}>
              <Text style={metricTitle}>Cash-on-Cash Return</Text>
              <Text style={metricDescription}>
                (Annual Pre-Tax Cash Flow / Total Cash Invested) x 100
              </Text>
              <Text style={metricInsight}>
                This measures your actual return on the cash you've invested,
                accounting for financing. A strong deal in this market typically
                yields 8-12% cash-on-cash.
              </Text>
            </Section>

            <Section style={metricCard}>
              <Text style={metricTitle}>The 1% Rule (Quick Screen)</Text>
              <Text style={metricDescription}>
                Monthly Rent / Purchase Price = 1% or higher
              </Text>
              <Text style={metricInsight}>
                A {medianPrice} property should ideally rent for{" "}
                {(() => {
                  const price = parseInt(medianPrice.replace(/[^0-9]/g, ""));
                  return new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  }).format(price * 0.01);
                })()}
                /month or more. In {county}, this can be challenging at median
                prices but achievable with below-market opportunities.
              </Text>
            </Section>

            <Heading as="h3" style={subheading}>
              Sample Investment Analysis
            </Heading>

            <Section style={analysisBox}>
              <Text style={analysisTitle}>
                Hypothetical Single-Family Rental in {town}
              </Text>
              <table style={analysisTable}>
                <tbody>
                  <tr>
                    <td style={analysisLabel}>Purchase Price:</td>
                    <td style={analysisValue}>{medianPrice}</td>
                  </tr>
                  <tr>
                    <td style={analysisLabel}>Down Payment (25%):</td>
                    <td style={analysisValue}>
                      {(() => {
                        const price = parseInt(medianPrice.replace(/[^0-9]/g, ""));
                        return new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        }).format(price * 0.25);
                      })()}
                    </td>
                  </tr>
                  <tr>
                    <td style={analysisLabel}>Est. Monthly Rent:</td>
                    <td style={analysisValue}>
                      {(() => {
                        const price = parseInt(medianPrice.replace(/[^0-9]/g, ""));
                        return new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        }).format(price * 0.007);
                      })()}
                    </td>
                  </tr>
                  <tr>
                    <td style={analysisLabel}>Est. Monthly Expenses:</td>
                    <td style={analysisValue}>
                      {(() => {
                        const price = parseInt(medianPrice.replace(/[^0-9]/g, ""));
                        return new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        }).format(price * 0.005);
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>
              <Text style={analysisNote}>
                *Expenses include mortgage, taxes, insurance, maintenance reserves,
                and property management
              </Text>
            </Section>

            <Section style={highlightBox}>
              <Text style={highlightTitle}>The Numbers Tell Part of the Story</Text>
              <Text style={highlightText}>
                ROI calculations are essential, but they don't capture everything.
                Tenant quality, property condition, location within the market,
                and your management approach all impact actual returns. I can help
                you evaluate both the numbers and the intangibles.
              </Text>
            </Section>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Analyze Specific Properties Together
              </Button>
            </Section>

            <Text style={paragraph}>
              Next time, I'll highlight specific areas within {county} that are
              attracting investor interest - and why.
            </Text>

            <Text style={signature}>
              Here to help you invest with confidence,
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

const metricCard: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  padding: "20px",
  borderRadius: "8px",
  marginBottom: "15px",
  borderLeft: "3px solid #C99C33",
};

const metricTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 5px",
};

const metricDescription: React.CSSProperties = {
  fontSize: "13px",
  color: "#C99C33",
  fontFamily: "monospace",
  margin: "0 0 10px",
};

const metricInsight: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  margin: "0",
  lineHeight: "1.5",
};

const analysisBox: React.CSSProperties = {
  backgroundColor: "#1a1a1a",
  padding: "25px",
  borderRadius: "8px",
  margin: "25px 0",
};

const analysisTitle: React.CSSProperties = {
  fontSize: "14px",
  color: "#C99C33",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 20px",
};

const analysisTable: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse" as const,
};

const analysisLabel: React.CSSProperties = {
  fontSize: "14px",
  color: "#999",
  padding: "8px 0",
};

const analysisValue: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#ffffff",
  textAlign: "right" as const,
  padding: "8px 0",
};

const analysisNote: React.CSSProperties = {
  fontSize: "12px",
  color: "#666",
  fontStyle: "italic",
  margin: "15px 0 0",
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

export default InvestorRoiEmail;
