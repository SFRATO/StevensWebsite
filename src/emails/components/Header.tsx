import * as React from "react";
import { Section, Text, Hr } from "@react-email/components";

export const Header: React.FC = () => {
  return (
    <Section style={header}>
      <Text style={logoName}>Steven Frato</Text>
      <Text style={logoCompany}>CENTURY 21 Action Plus Realty</Text>
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

// N.J.A.C. 11:5-6.1(b)1/(j)1: broker's regular business name given co-equal weight.
const logoCompany: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "bold",
  color: "#C99C33",
  margin: "5px 0 0",
  letterSpacing: "0.5px",
};

const divider: React.CSSProperties = {
  borderTop: "2px solid #C99C33",
  margin: "20px 0 0",
};

export default Header;
