import * as React from "react";
import { Section, Text, Link, Hr } from "@react-email/components";
import { AGENT_NAME, PHONE, EMAIL, LICENSE_LINE, MAILING_ADDRESS } from "../../data/contact";

interface FooterProps {
  unsubscribeUrl?: string;
}

export const Footer: React.FC<FooterProps> = ({ unsubscribeUrl }) => {
  return (
    <Section style={footer}>
      <Hr style={divider} />
      {/* CAN-SPAM requires a physical postal address. MAILING_ADDRESS is empty
          until Steven supplies one — the line is omitted rather than rendered
          blank. See the TODO in src/data/contact.ts. */}
      <Text style={contact}>
        <strong>{AGENT_NAME}</strong>
        <br />
        {MAILING_ADDRESS && (
          <>
            {MAILING_ADDRESS}
            <br />
          </>
        )}
        {PHONE} | {EMAIL}
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
        stevenfrato.com.
        <br />
        {LICENSE_LINE} Equal Housing Opportunity.
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
