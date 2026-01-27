import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Hr,
  Link,
} from "@react-email/components";

interface LeadNotificationEmailProps {
  name: string;
  email: string;
  phone?: string;
  address: string;
  town: string;
  zipcode: string;
  sourceUrl?: string;
  submittedAt?: string;
}

export const LeadNotificationEmail: React.FC<LeadNotificationEmailProps> = ({
  name = "John Doe",
  email = "john@example.com",
  phone,
  address = "123 Main Street",
  town = "Burlington",
  zipcode = "08016",
  sourceUrl = "https://stevenfrato.com/market/08016/",
  submittedAt = new Date().toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  }),
}) => {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={alertBadge}>NEW LEAD</Text>
            <Heading style={heading}>Market Report Request</Heading>
            <Text style={timestamp}>{submittedAt}</Text>
          </Section>

          <Hr style={divider} />

          <Section style={content}>
            <Heading as="h3" style={sectionHeading}>
              Contact Information
            </Heading>

            <table style={table}>
              <tbody>
                <tr>
                  <td style={labelCell}>Name:</td>
                  <td style={valueCell}>{name}</td>
                </tr>
                <tr>
                  <td style={labelCell}>Email:</td>
                  <td style={valueCell}>
                    <Link href={`mailto:${email}`} style={link}>
                      {email}
                    </Link>
                  </td>
                </tr>
                {phone && (
                  <tr>
                    <td style={labelCell}>Phone:</td>
                    <td style={valueCell}>
                      <Link href={`tel:${phone}`} style={link}>
                        {phone}
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <Hr style={sectionDivider} />

            <Heading as="h3" style={sectionHeading}>
              Property Details
            </Heading>

            <table style={table}>
              <tbody>
                <tr>
                  <td style={labelCell}>Address:</td>
                  <td style={valueCell}>{address}</td>
                </tr>
                <tr>
                  <td style={labelCell}>Town:</td>
                  <td style={valueCell}>{town}</td>
                </tr>
                <tr>
                  <td style={labelCell}>Zip Code:</td>
                  <td style={valueCell}>{zipcode}</td>
                </tr>
              </tbody>
            </table>

            <Hr style={sectionDivider} />

            <Heading as="h3" style={sectionHeading}>
              Source
            </Heading>

            <table style={table}>
              <tbody>
                <tr>
                  <td style={labelCell}>Page:</td>
                  <td style={valueCell}>
                    <Link href={sourceUrl} style={link}>
                      {sourceUrl}
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>
              This is an automated notification from stevenfrato.com
            </Text>
          </Section>
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

const header: React.CSSProperties = {
  textAlign: "center" as const,
  padding: "20px 0",
};

const alertBadge: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#4CAF50",
  color: "#ffffff",
  padding: "6px 16px",
  borderRadius: "20px",
  fontSize: "12px",
  fontWeight: "bold",
  letterSpacing: "1px",
  margin: "0 0 15px",
};

const heading: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: "bold",
  color: "#1a1a1a",
  margin: "0 0 10px",
};

const timestamp: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  margin: "0",
};

const divider: React.CSSProperties = {
  borderTop: "2px solid #C99C33",
  margin: "20px 0",
};

const sectionDivider: React.CSSProperties = {
  borderTop: "1px solid #e0e0e0",
  margin: "20px 0",
};

const content: React.CSSProperties = {
  padding: "10px 0",
};

const sectionHeading: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#C99C33",
  margin: "0 0 15px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse" as const,
};

const labelCell: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  padding: "8px 0",
  width: "100px",
  verticalAlign: "top" as const,
};

const valueCell: React.CSSProperties = {
  fontSize: "16px",
  color: "#1a1a1a",
  fontWeight: "500",
  padding: "8px 0",
};

const link: React.CSSProperties = {
  color: "#C99C33",
  textDecoration: "none",
};

const footer: React.CSSProperties = {
  padding: "10px 0",
  textAlign: "center" as const,
};

const footerText: React.CSSProperties = {
  fontSize: "12px",
  color: "#999",
  margin: "0",
};

export default LeadNotificationEmail;
