import * as React from "react";
import { Section, Text, Hr } from "@react-email/components";

export const Header: React.FC = () => {
  return (
    <Section style={header}>
      <Text style={logoName}>Steven Frato</Text>
      <Text style={logoTagline}>NJ Real Estate</Text>
      <Hr style={divider} />
    </Section>
  );
};

const header: React.CSSProperties = {
  textAlign: "center" as const,
  padding: "20px 0",
};

const logoName: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "bold",
  color: "#1a1a1a",
  margin: "0",
};

const logoTagline: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#666",
  margin: "5px 0 0",
  letterSpacing: "1px",
};

const divider: React.CSSProperties = {
  borderTop: "2px solid #C99C33",
  margin: "20px 0 0",
};

export default Header;
