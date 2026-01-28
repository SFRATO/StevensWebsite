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

interface InvestorTaxEmailProps {
  name: string;
  town: string;
  county: string;
  unsubscribeUrl?: string;
}

export const InvestorTaxEmail: React.FC<InvestorTaxEmailProps> = ({
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
              Tax Considerations for {county} Investors
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              Smart investing isn't just about finding good deals - it's about
              keeping more of what you earn. Today I'll cover key tax
              considerations for real estate investors in New Jersey.
            </Text>

            <Section style={disclaimerBox}>
              <Text style={disclaimerText}>
                <strong>Note:</strong> This is general information, not tax
                advice. Always consult with a qualified tax professional for your
                specific situation.
              </Text>
            </Section>

            <Heading as="h3" style={subheading}>
              Key Tax Benefits of Real Estate Investing
            </Heading>

            <Section style={benefitCard}>
              <Text style={benefitTitle}>Depreciation</Text>
              <Text style={benefitText}>
                Even while your property appreciates in value, you can deduct
                depreciation from your taxable income. For residential properties,
                you can depreciate the building (not land) over 27.5 years.
              </Text>
              <Text style={benefitExample}>
                Example: A $300K property with $60K land value = $240K depreciable
                basis = ~$8,700/year deduction
              </Text>
            </Section>

            <Section style={benefitCard}>
              <Text style={benefitTitle}>Operating Expense Deductions</Text>
              <Text style={benefitText}>
                Mortgage interest, property taxes, insurance, repairs,
                maintenance, property management fees, and travel to manage your
                property are all deductible against rental income.
              </Text>
            </Section>

            <Section style={benefitCard}>
              <Text style={benefitTitle}>1031 Exchanges</Text>
              <Text style={benefitText}>
                When you sell an investment property, you can defer capital gains
                taxes by reinvesting in a "like-kind" property within specific
                timeframes. This allows you to grow your portfolio tax-efficiently.
              </Text>
            </Section>

            <Section style={benefitCard}>
              <Text style={benefitTitle}>Pass-Through Deduction (QBI)</Text>
              <Text style={benefitText}>
                Many rental property owners qualify for a 20% qualified business
                income deduction under current tax law, further reducing your tax
                burden.
              </Text>
            </Section>

            <Heading as="h3" style={subheading}>
              New Jersey-Specific Considerations
            </Heading>

            <ul style={list}>
              <li style={listItem}>
                <strong>Property taxes:</strong> NJ has some of the highest
                property taxes in the nation. Factor this into your investment
                analysis - it significantly impacts cash flow.
              </li>
              <li style={listItem}>
                <strong>State income tax:</strong> Rental income is subject to NJ
                state income tax (1.4% - 10.75% depending on total income).
              </li>
              <li style={listItem}>
                <strong>Exit tax:</strong> When selling NJ property, 8.97% of the
                gain or 2% of the sale price (whichever is higher) may be withheld
                for estimated taxes.
              </li>
              <li style={listItem}>
                <strong>LLC considerations:</strong> Many investors hold
                properties in LLCs for liability protection. NJ has a $150 annual
                LLC fee plus $250 in annual reports.
              </li>
            </ul>

            <Section style={highlightBox}>
              <Text style={highlightTitle}>Build Your Team</Text>
              <Text style={highlightText}>
                Successful real estate investors work with professionals who
                understand investment properties. I can connect you with CPAs and
                attorneys who specialize in real estate investing and understand
                the New Jersey landscape.
              </Text>
            </Section>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Get Professional Recommendations
              </Button>
            </Section>

            <Text style={paragraph}>
              In my final email, I'll extend an invitation to discuss your
              specific investment goals and how I can help you find the right
              opportunities in {county}.
            </Text>

            <Text style={signature}>
              Helping you invest smarter,
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

const disclaimerBox: React.CSSProperties = {
  backgroundColor: "#fff3cd",
  padding: "15px 20px",
  borderRadius: "8px",
  margin: "20px 0",
  borderLeft: "4px solid #ffc107",
};

const disclaimerText: React.CSSProperties = {
  fontSize: "14px",
  color: "#856404",
  margin: "0",
  lineHeight: "1.5",
};

const benefitCard: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  padding: "20px",
  borderRadius: "8px",
  marginBottom: "15px",
  borderLeft: "3px solid #C99C33",
};

const benefitTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 8px",
};

const benefitText: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  margin: "0",
  lineHeight: "1.5",
};

const benefitExample: React.CSSProperties = {
  fontSize: "13px",
  color: "#C99C33",
  marginTop: "10px",
  fontStyle: "italic",
};

const list: React.CSSProperties = {
  paddingLeft: "20px",
  margin: "0 0 20px",
};

const listItem: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "1.8",
  color: "#333",
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

export default InvestorTaxEmail;
