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

interface BothCoordinationEmailProps {
  name: string;
  town: string;
  unsubscribeUrl?: string;
}

export const BothCoordinationEmail: React.FC<BothCoordinationEmailProps> = ({
  name = "Homeowner",
  town = "Burlington",
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
              Coordinating Your Buy & Sell Transaction
            </Heading>

            <Text style={paragraph}>Hi {name},</Text>

            <Text style={paragraph}>
              The logistics of buying and selling simultaneously can feel
              overwhelming. But with proper coordination, I've helped many
              families in {town} make smooth transitions. Here's how it works.
            </Text>

            <Heading as="h3" style={subheading}>
              The Coordination Playbook
            </Heading>

            <Section style={timelineBox}>
              <div style={timelineItem}>
                <div style={timelineDot}></div>
                <div style={timelineContent}>
                  <Text style={timelineTitle}>Contract Alignment</Text>
                  <Text style={timelineText}>
                    We work to get both contracts signed with closing dates that
                    work together - ideally your sale closes in the morning and
                    purchase in the afternoon of the same day.
                  </Text>
                </div>
              </div>

              <div style={timelineItem}>
                <div style={timelineDot}></div>
                <div style={timelineContent}>
                  <Text style={timelineTitle}>Contingency Management</Text>
                  <Text style={timelineText}>
                    Your purchase offer may include a home sale contingency. We
                    structure this to protect you while remaining attractive to
                    sellers.
                  </Text>
                </div>
              </div>

              <div style={timelineItem}>
                <div style={timelineDot}></div>
                <div style={timelineContent}>
                  <Text style={timelineTitle}>Rent-Back Options</Text>
                  <Text style={timelineText}>
                    If timing doesn't align perfectly, we can negotiate a
                    rent-back agreement - staying in your current home briefly
                    after closing while your purchase completes.
                  </Text>
                </div>
              </div>

              <div style={timelineItem}>
                <div style={timelineDot}></div>
                <div style={timelineContent}>
                  <Text style={timelineTitle}>Moving Day Planning</Text>
                  <Text style={timelineText}>
                    We coordinate with title companies, movers, and both parties
                    to ensure keys are handed over and you can move directly from
                    one home to the next.
                  </Text>
                </div>
              </div>
            </Section>

            <Heading as="h3" style={subheading}>
              Backup Plans (Just in Case)
            </Heading>

            <Text style={paragraph}>
              Even with careful planning, timing can shift. Here are contingency
              options:
            </Text>

            <Section style={backupCard}>
              <Text style={backupTitle}>Short-Term Housing</Text>
              <Text style={backupText}>
                If there's a gap, furnished rentals or extended-stay options can
                bridge the time. I can provide local recommendations.
              </Text>
            </Section>

            <Section style={backupCard}>
              <Text style={backupTitle}>Storage Solutions</Text>
              <Text style={backupText}>
                If closing dates end up a few days apart, PODs or local storage
                can hold your belongings temporarily.
              </Text>
            </Section>

            <Section style={backupCard}>
              <Text style={backupTitle}>Bridge Financing</Text>
              <Text style={backupText}>
                If you need to close on your purchase before your sale, bridge
                loans can cover the gap. Talk to your lender about options.
              </Text>
            </Section>

            <Section style={highlightBox}>
              <Text style={highlightTitle}>The Advantage of One Agent</Text>
              <Text style={highlightText}>
                When I represent you on both sides of the transaction, I can
                coordinate everything seamlessly. I know the exact status of
                your sale when negotiating your purchase, and I can adjust
                timelines in real-time as things develop. Many of the potential
                pitfalls disappear when one person is managing the whole picture.
              </Text>
            </Section>

            <Section style={ctaSection}>
              <Button href="https://stevenfrato.com/contact/">
                Let's Coordinate Your Move
              </Button>
            </Section>

            <Text style={paragraph}>
              In my final email tomorrow, I'll extend a personal invitation to
              meet and put all of this planning into action.
            </Text>

            <Text style={signature}>
              Here to make your move seamless,
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

const timelineBox: React.CSSProperties = {
  margin: "25px 0",
  paddingLeft: "20px",
  borderLeft: "2px solid #C99C33",
};

const timelineItem: React.CSSProperties = {
  position: "relative" as const,
  paddingLeft: "25px",
  paddingBottom: "25px",
};

const timelineDot: React.CSSProperties = {
  position: "absolute" as const,
  left: "-31px",
  top: "0",
  width: "12px",
  height: "12px",
  backgroundColor: "#C99C33",
  borderRadius: "50%",
  border: "3px solid #ffffff",
};

const timelineContent: React.CSSProperties = {};

const timelineTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 5px",
};

const timelineText: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  margin: "0",
  lineHeight: "1.5",
};

const backupCard: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  padding: "15px 20px",
  borderRadius: "8px",
  marginBottom: "15px",
};

const backupTitle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: "600",
  color: "#1a1a1a",
  margin: "0 0 5px",
};

const backupText: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  margin: "0",
  lineHeight: "1.5",
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

export default BothCoordinationEmail;
