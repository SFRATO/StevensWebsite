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

interface BuyerFinancingEmailProps {
  name: string;
  town: string;
  county: string;
  medianPrice?: string;
  unsubscribeUrl?: string;
}

export const BuyerFinancingEmail: React.FC<BuyerFinancingEmailProps> = ({
  name = "Homebuyer",
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
              Maximizing Your Buying Power in {county}
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              Understanding your financing options can mean the difference between
              stretching your budget and comfortably affording your dream home.
              Today I want to share some insights that can help maximize your
              buying power.
            </Text>

            <Section style={priceBox}>
              <Text style={priceLabel}>Median Home Price in {town}</Text>
              <Text style={priceValue}>{medianPrice}</Text>
            </Section>

            <Heading as="h3" style={subheading}>
              Financing Options to Explore
            </Heading>

            <Section style={optionCard}>
              <Text style={optionTitle}>Conventional Loans</Text>
              <Text style={optionText}>
                Traditional mortgages with competitive rates. If you can put down
                20%, you'll avoid private mortgage insurance (PMI). But many
                lenders offer conventional loans with as little as 3% down.
              </Text>
            </Section>

            <Section style={optionCard}>
              <Text style={optionTitle}>FHA Loans</Text>
              <Text style={optionText}>
                Government-backed loans with lower credit score requirements and
                down payments as low as 3.5%. Great for first-time buyers or those
                rebuilding credit.
              </Text>
            </Section>

            <Section style={optionCard}>
              <Text style={optionTitle}>VA Loans</Text>
              <Text style={optionText}>
                If you're a veteran or active military, VA loans offer 0% down
                payment and no PMI. One of the best financing options available.
              </Text>
            </Section>

            <Section style={optionCard}>
              <Text style={optionTitle}>NJHMFA Programs</Text>
              <Text style={optionText}>
                New Jersey Housing and Mortgage Finance Agency offers down payment
                assistance and special programs for first-time buyers. Worth
                exploring if you qualify.
              </Text>
            </Section>

            <Heading as="h3" style={subheading}>
              Ways to Increase Your Budget
            </Heading>

            <ul style={list}>
              <li style={listItem}>
                <strong>Improve your credit score</strong> - Even 20-40 points can
                significantly impact your rate
              </li>
              <li style={listItem}>
                <strong>Pay down debt</strong> - Lowering your debt-to-income ratio
                can increase your approval amount
              </li>
              <li style={listItem}>
                <strong>Shop multiple lenders</strong> - Rates vary; getting 3-4
                quotes can save you thousands
              </li>
              <li style={listItem}>
                <strong>Consider a co-signer</strong> - A qualified co-signer can
                help you qualify for more
              </li>
              <li style={listItem}>
                <strong>Ask about seller concessions</strong> - In some markets,
                sellers may help with closing costs
              </li>
            </ul>

            <Section style={highlightBox}>
              <Text style={highlightTitle}>Need a Lender Recommendation?</Text>
              <Text style={highlightText}>
                I work with several trusted local lenders who know the {county}{" "}
                market well. They can often find creative solutions and competitive
                rates. Happy to make an introduction if you'd like.
              </Text>
            </Section>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Get Lender Recommendations
              </Button>
            </Section>

            <Text style={paragraph}>
              In my final email, I'll extend a personal invitation to meet and
              discuss your home buying goals - no pressure, just helpful
              information.
            </Text>

            <Text style={signature}>
              Helping you buy smarter,
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

const priceBox: React.CSSProperties = {
  backgroundColor: "#1a1a1a",
  padding: "25px",
  borderRadius: "8px",
  textAlign: "center" as const,
  margin: "25px 0",
};

const priceLabel: React.CSSProperties = {
  fontSize: "12px",
  color: "#999",
  textTransform: "uppercase" as const,
  letterSpacing: "1px",
  margin: "0 0 10px",
};

const priceValue: React.CSSProperties = {
  fontSize: "36px",
  fontWeight: "bold",
  color: "#C99C33",
  margin: "0",
};

const optionCard: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  padding: "20px",
  borderRadius: "8px",
  marginBottom: "15px",
  borderLeft: "3px solid #C99C33",
};

const optionTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 8px",
};

const optionText: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  margin: "0",
  lineHeight: "1.5",
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

export default BuyerFinancingEmail;
