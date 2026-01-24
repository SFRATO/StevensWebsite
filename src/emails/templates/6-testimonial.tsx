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

interface TestimonialEmailProps {
  location: string;
}

export const TestimonialEmail: React.FC<TestimonialEmailProps> = ({
  location = "Burlington County",
}) => {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Header />

          <Section style={content}>
            <Heading style={heading}>
              "Steven made selling our home effortless"
            </Heading>

            <Text style={paragraph}>
              I wanted to share some feedback from recent clients who've worked
              with me on their {location} home sales. Their experiences
              illustrate the kind of service I strive to provide.
            </Text>

            <Section style={testimonialBox}>
              <Text style={testimonialQuote}>
                "As first-time home sellers, we had no idea what to expect.
                Steven walked us through every step, from pricing strategy to
                closing. His market knowledge in {location} was invaluable, and
                we ended up selling faster and for more than we anticipated."
              </Text>
              <Section style={testimonialAuthor}>
                <Text style={authorName}>Mike & Sarah T.</Text>
                <Text style={authorLocation}>{location} Sellers</Text>
              </Section>
            </Section>

            <Section style={testimonialBox}>
              <Text style={testimonialQuote}>
                "Steven's data-driven approach was refreshing. Instead of just
                guessing at a price, he showed us exactly why our home should be
                priced where it was. The result? Multiple offers in the first
                week."
              </Text>
              <Section style={testimonialAuthor}>
                <Text style={authorName}>Jennifer R.</Text>
                <Text style={authorLocation}>{location} Seller</Text>
              </Section>
            </Section>

            <Section style={testimonialBox}>
              <Text style={testimonialQuote}>
                "What impressed me most was Steven's communication. I never had
                to wonder what was happening with my sale—he kept me informed at
                every stage and was always available when I had questions."
              </Text>
              <Section style={testimonialAuthor}>
                <Text style={authorName}>David M.</Text>
                <Text style={authorLocation}>{location} Seller</Text>
              </Section>
            </Section>

            <Text style={paragraph}>
              I'm committed to providing this level of service to every client,
              regardless of their home's price point. If you're considering
              selling, I'd love to show you how I can help.
            </Text>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Let's Start a Conversation
              </Button>
            </Section>

            <Text style={signature}>
              Warm regards,
              <br />
              <strong>Steven</strong>
            </Text>
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
  margin: "0 0 25px",
};

const testimonialBox: React.CSSProperties = {
  backgroundColor: "#fafafa",
  borderRadius: "8px",
  padding: "25px",
  marginBottom: "20px",
  borderLeft: "3px solid #C99C33",
};

const testimonialQuote: React.CSSProperties = {
  fontSize: "16px",
  fontStyle: "italic",
  lineHeight: "1.6",
  color: "#333",
  margin: "0 0 15px",
};

const testimonialAuthor: React.CSSProperties = {
  borderTop: "1px solid #e0e0e0",
  paddingTop: "15px",
};

const authorName: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 3px",
};

const authorLocation: React.CSSProperties = {
  fontSize: "13px",
  color: "#666",
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

export default TestimonialEmail;
