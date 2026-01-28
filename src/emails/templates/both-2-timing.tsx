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

interface BothTimingEmailProps {
  name: string;
  town: string;
  marketType?: "seller" | "buyer" | "balanced";
  medianDom?: number;
  unsubscribeUrl?: string;
}

export const BothTimingEmail: React.FC<BothTimingEmailProps> = ({
  name = "Homeowner",
  town = "Burlington",
  marketType = "balanced",
  medianDom = 30,
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
              Timing Your Move: Buy First or Sell First?
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              One of the biggest questions when buying and selling simultaneously
              is timing. Should you sell first, buy first, or try to do both at
              once? Each approach has pros and cons.
            </Text>

            <Section style={statBox}>
              <Text style={statNumber}>{medianDom}</Text>
              <Text style={statLabel}>
                Average days on market in {town}
              </Text>
              <Text style={statNote}>
                This helps estimate how long your sale might take
              </Text>
            </Section>

            <Heading as="h3" style={subheading}>
              Option 1: Sell First
            </Heading>

            <Section style={optionBox}>
              <Text style={proConTitle}>Advantages:</Text>
              <ul style={proConList}>
                <li>You know exactly how much you have for your next home</li>
                <li>No risk of carrying two mortgages</li>
                <li>Stronger position when making offers (no sale contingency)</li>
              </ul>
              <Text style={proConTitle}>Challenges:</Text>
              <ul style={proConList}>
                <li>May need temporary housing between homes</li>
                <li>Pressure to find something quickly</li>
                <li>Potential for two moves (current home → temp → new home)</li>
              </ul>
            </Section>

            <Heading as="h3" style={subheading}>
              Option 2: Buy First
            </Heading>

            <Section style={optionBox}>
              <Text style={proConTitle}>Advantages:</Text>
              <ul style={proConList}>
                <li>You can take your time finding the right home</li>
                <li>Only one move required</li>
                <li>Can stage your current home while living elsewhere</li>
              </ul>
              <Text style={proConTitle}>Challenges:</Text>
              <ul style={proConList}>
                <li>Carrying costs of two homes</li>
                <li>May need bridge financing</li>
                <li>Your current home must sell before you overextend</li>
              </ul>
            </Section>

            <Heading as="h3" style={subheading}>
              Option 3: Simultaneous Transactions
            </Heading>

            <Section style={optionBox}>
              <Text style={proConTitle}>Advantages:</Text>
              <ul style={proConList}>
                <li>Seamless transition from one home to the next</li>
                <li>No temporary housing or bridge loans needed</li>
                <li>Only one move</li>
              </ul>
              <Text style={proConTitle}>Challenges:</Text>
              <ul style={proConList}>
                <li>Requires careful coordination of closings</li>
                <li>Sale contingency may weaken your buying position</li>
                <li>More stressful - many moving parts</li>
              </ul>
            </Section>

            <Section style={highlightBox}>
              <Text style={highlightTitle}>My Recommendation for {town}</Text>
              <Text style={highlightText}>
                {marketType === "seller"
                  ? "In the current seller's market, your home should sell quickly. Consider listing first to lock in a strong price, then use that momentum to negotiate favorable terms on your purchase - possibly with a rent-back agreement."
                  : marketType === "buyer"
                  ? "With more inventory available, you have time to find the right next home. Consider buying first if your finances allow, or coordinate both transactions with sale contingencies that buyers may accept in this market."
                  : "The balanced market gives you flexibility. I often recommend listing your home and starting your search simultaneously, then coordinating the closings. This works well when neither party has all the leverage."}
              </Text>
            </Section>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Let's Plan Your Timeline
              </Button>
            </Section>

            <Text style={paragraph}>
              Next time, I'll help you understand what your current home might be
              worth in today's market - essential information for planning your
              budget.
            </Text>

            <Text style={signature}>
              Here to help coordinate your move,
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

const statBox: React.CSSProperties = {
  backgroundColor: "#1a1a1a",
  padding: "25px",
  borderRadius: "8px",
  textAlign: "center" as const,
  margin: "25px 0",
};

const statNumber: React.CSSProperties = {
  fontSize: "48px",
  fontWeight: "bold",
  color: "#C99C33",
  margin: "0",
  lineHeight: "1",
};

const statLabel: React.CSSProperties = {
  fontSize: "14px",
  color: "#ffffff",
  margin: "10px 0 5px",
};

const statNote: React.CSSProperties = {
  fontSize: "12px",
  color: "#999",
  margin: "0",
};

const optionBox: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  padding: "20px",
  borderRadius: "8px",
  marginBottom: "20px",
};

const proConTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 8px",
};

const proConList: React.CSSProperties = {
  paddingLeft: "20px",
  margin: "0 0 15px",
  fontSize: "14px",
  color: "#666",
  lineHeight: "1.6",
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
  fontSize: "15px",
  color: "#333",
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

export default BothTimingEmail;
