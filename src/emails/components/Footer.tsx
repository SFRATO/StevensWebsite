import * as React from "react";
import { Section, Text, Link, Hr } from "@react-email/components";

interface FooterProps {
  unsubscribeUrl?: string;
}

export const Footer: React.FC<FooterProps> = ({ unsubscribeUrl }) => {
  return (
    <Section style={footer}>
      <Hr style={divider} />
      <Text style={contact}>
        <strong>Steven Frato</strong>
        <br />
        Century 21
        <br />
        136 Farnsworth Ave, Bordentown, NJ 08505
        <br />
        (609) 789-0126 | sf@stevenfrato.com
      </Text>
      <Text style={links}>
        <Link href="https://stevenfrato.com" style={link}>
          Website
        </Link>
        {" | "}
        <Link href="https://stevenfrato.com/market/" style={link}>
          Market Data
        </Link>
        {" | "}
        <Link href="https://stevenfrato.com/contact/" style={link}>
          Contact
        </Link>
      </Text>
      <Text style={disclaimer}>
        You're receiving this email because you requested a market report from
        stevenfrato.com. Each office is independently owned and operated.
      </Text>
      {unsubscribeUrl && (
        <Text style={unsubscribe}>
          <Link href={unsubscribeUrl} style={unsubscribeLink}>
            Unsubscribe
          </Link>
        </Text>
      )}
    </Section>
  );
};

const footer: React.CSSProperties = {
  padding: "20px 0",
};

const divider: React.CSSProperties = {
  borderTop: "1px solid #e0e0e0",
  margin: "0 0 20px",
};

const contact: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  lineHeight: "1.6",
  textAlign: "center" as const,
  margin: "0 0 15px",
};

const links: React.CSSProperties = {
  fontSize: "14px",
  textAlign: "center" as const,
  margin: "0 0 15px",
};

const link: React.CSSProperties = {
  color: "#C99C33",
  textDecoration: "none",
};

const disclaimer: React.CSSProperties = {
  fontSize: "12px",
  color: "#999",
  textAlign: "center" as const,
  margin: "0 0 10px",
};

const unsubscribe: React.CSSProperties = {
  fontSize: "12px",
  textAlign: "center" as const,
  margin: "0",
};

const unsubscribeLink: React.CSSProperties = {
  color: "#999",
  textDecoration: "underline",
};

export default Footer;
