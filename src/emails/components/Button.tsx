import * as React from "react";
import { Button as EmailButton } from "@react-email/components";

interface ButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}

export const Button: React.FC<ButtonProps> = ({
  href,
  children,
  variant = "primary",
}) => {
  const styles = variant === "primary" ? primaryButton : secondaryButton;

  return (
    <EmailButton href={href} style={styles}>
      {children}
    </EmailButton>
  );
};

const baseButton: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 30px",
  borderRadius: "6px",
  fontWeight: "600",
  fontSize: "16px",
  textDecoration: "none",
  textAlign: "center" as const,
};

const primaryButton: React.CSSProperties = {
  ...baseButton,
  backgroundColor: "#C99C33",
  color: "#ffffff",
};

const secondaryButton: React.CSSProperties = {
  ...baseButton,
  backgroundColor: "#f5f5f5",
  color: "#1a1a1a",
  border: "1px solid #ddd",
};

export default Button;
