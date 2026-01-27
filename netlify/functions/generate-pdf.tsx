/**
 * Generate PDF Market Report
 *
 * Creates a personalized PDF market report for a specific location.
 * Uses @react-pdf/renderer to generate the PDF.
 *
 * Supports both:
 * - POST requests from form handler (generates and stores PDF)
 * - GET requests from email links (returns PDF for download)
 */

import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

// Import zipcode data at build time
import zipcodesData from "../../data/processed/zipcodes.json";

interface ZipData {
  zipcode: string;
  region: string;
  city: string;
  county: string;
  state: string;
  state_code: string;
  period_end: string;
  last_updated: string;
  median_sale_price: number | null;
  median_sale_price_yoy: number | null;
  median_list_price: number | null;
  median_list_price_yoy: number | null;
  inventory: number | null;
  inventory_yoy: number | null;
  months_of_supply: number | null;
  months_of_supply_yoy: number | null;
  median_dom: number | null;
  median_dom_yoy: number | null;
  homes_sold: number | null;
  homes_sold_yoy: number | null;
  sold_above_list_pct: number | null;
  price_drops_pct: number | null;
  market_type: "seller" | "buyer" | "balanced";
  trend_direction: "up" | "down" | "stable";
  nearby_zips: string[];
  ai_insight?: string;
}

interface PDFRequest {
  location: string;
  email: string;
  name: string;
  address: string;
  town: string;
  zipcode: string;
}

// Helper functions
const formatCurrency = (value: number | null): string => {
  if (value === null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number | null): string => {
  if (value === null) return "N/A";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const getMarketLabel = (type: string): string => {
  const labels: Record<string, string> = {
    seller: "Seller's Market",
    buyer: "Buyer's Market",
    balanced: "Balanced Market",
  };
  return labels[type] || "Unknown";
};

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: "#333333",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 3,
    borderBottomColor: "#C99C33",
  },
  logo: {
    flexDirection: "column",
  },
  logoName: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  logoCompany: {
    fontSize: 12,
    color: "#C99C33",
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    marginTop: 4,
  },
  reportDate: {
    fontSize: 10,
    color: "#666666",
    textAlign: "right",
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 25,
  },
  propertyBox: {
    backgroundColor: "#f5f5f5",
    padding: 15,
    marginBottom: 25,
    borderRadius: 4,
  },
  propertyLabel: {
    fontSize: 10,
    color: "#666666",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  propertyAddress: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#C99C33",
    marginTop: 20,
    marginBottom: 15,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  metricCard: {
    width: "48%",
    marginRight: "2%",
    marginBottom: 15,
    padding: 15,
    backgroundColor: "#fafafa",
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: "#C99C33",
  },
  metricLabel: {
    fontSize: 10,
    color: "#666666",
    marginBottom: 5,
    textTransform: "uppercase",
  },
  metricValue: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  metricChange: {
    fontSize: 10,
    marginTop: 4,
  },
  changePositive: {
    color: "#4CAF50",
  },
  changeNegative: {
    color: "#E53935",
  },
  marketBadge: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 15,
  },
  badgeSeller: {
    backgroundColor: "rgba(76, 175, 80, 0.15)",
  },
  badgeBuyer: {
    backgroundColor: "rgba(229, 57, 53, 0.15)",
  },
  badgeBalanced: {
    backgroundColor: "rgba(201, 156, 51, 0.15)",
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  badgeTextSeller: {
    color: "#4CAF50",
  },
  badgeTextBuyer: {
    color: "#E53935",
  },
  badgeTextBalanced: {
    color: "#C99C33",
  },
  insightBox: {
    backgroundColor: "rgba(201, 156, 51, 0.1)",
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: "#C99C33",
    marginTop: 15,
    marginBottom: 20,
  },
  insightText: {
    fontSize: 11,
    color: "#333333",
    lineHeight: 1.6,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  footerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerContact: {
    fontSize: 10,
    color: "#666666",
  },
  footerContactBold: {
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  footerDisclaimer: {
    fontSize: 8,
    color: "#999999",
    marginTop: 10,
    textAlign: "center",
  },
  ctaBox: {
    backgroundColor: "#1a1a1a",
    padding: 20,
    marginTop: 20,
    borderRadius: 4,
  },
  ctaTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  ctaText: {
    fontSize: 11,
    color: "#cccccc",
    marginBottom: 10,
  },
  ctaContact: {
    fontSize: 12,
    color: "#C99C33",
    fontFamily: "Helvetica-Bold",
  },
});

// PDF Document Component
const MarketReportPDF = ({
  zipData,
  address,
  town,
  name,
}: {
  zipData: ZipData;
  address: string;
  town: string;
  name: string;
}) => {
  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const dataDate = formatDate(zipData.period_end);

  const getBadgeStyle = () => {
    switch (zipData.market_type) {
      case "seller":
        return [styles.marketBadge, styles.badgeSeller];
      case "buyer":
        return [styles.marketBadge, styles.badgeBuyer];
      default:
        return [styles.marketBadge, styles.badgeBalanced];
    }
  };

  const getBadgeTextStyle = () => {
    switch (zipData.market_type) {
      case "seller":
        return [styles.badgeText, styles.badgeTextSeller];
      case "buyer":
        return [styles.badgeText, styles.badgeTextBuyer];
      default:
        return [styles.badgeText, styles.badgeTextBalanced];
    }
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoName}>Steven Frato</Text>
            <Text style={styles.logoCompany}>CENTURY 21</Text>
          </View>
          <View>
            <Text style={styles.reportDate}>Report Generated: {currentDate}</Text>
            <Text style={styles.reportDate}>Data as of: {dataDate}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{town} Market Report</Text>
        <Text style={styles.subtitle}>
          {zipData.zipcode} | {zipData.county}
        </Text>

        {/* Property Address */}
        <View style={styles.propertyBox}>
          <Text style={styles.propertyLabel}>Prepared for</Text>
          <Text style={styles.propertyAddress}>{name}</Text>
          <Text style={styles.propertyAddress}>
            {address}, {town}, NJ {zipData.zipcode}
          </Text>
        </View>

        {/* Market Type Badge */}
        <View style={getBadgeStyle()}>
          <Text style={getBadgeTextStyle()}>
            {getMarketLabel(zipData.market_type)}
          </Text>
        </View>

        {/* Market Metrics */}
        <Text style={styles.sectionTitle}>Market Snapshot</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Median Sale Price</Text>
            <Text style={styles.metricValue}>
              {formatCurrency(zipData.median_sale_price)}
            </Text>
            {zipData.median_sale_price_yoy !== null && (
              <Text
                style={[
                  styles.metricChange,
                  zipData.median_sale_price_yoy >= 0
                    ? styles.changePositive
                    : styles.changeNegative,
                ]}
              >
                {formatPercent(zipData.median_sale_price_yoy)} vs last year
              </Text>
            )}
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Days on Market</Text>
            <Text style={styles.metricValue}>
              {zipData.median_dom !== null
                ? `${Math.round(zipData.median_dom)} days`
                : "N/A"}
            </Text>
            {zipData.median_dom_yoy !== null && (
              <Text
                style={[
                  styles.metricChange,
                  zipData.median_dom_yoy <= 0
                    ? styles.changePositive
                    : styles.changeNegative,
                ]}
              >
                {zipData.median_dom_yoy > 0 ? "+" : ""}
                {Math.round(zipData.median_dom_yoy / 100)} days vs last year
              </Text>
            )}
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Active Listings</Text>
            <Text style={styles.metricValue}>
              {zipData.inventory !== null ? zipData.inventory : "N/A"}
            </Text>
            {zipData.inventory_yoy !== null && (
              <Text
                style={[
                  styles.metricChange,
                  zipData.inventory_yoy <= 0
                    ? styles.changePositive
                    : styles.changeNegative,
                ]}
              >
                {formatPercent(zipData.inventory_yoy)} vs last year
              </Text>
            )}
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Sold Above List</Text>
            <Text style={styles.metricValue}>
              {zipData.sold_above_list_pct !== null
                ? `${zipData.sold_above_list_pct.toFixed(0)}%`
                : "N/A"}
            </Text>
            <Text style={styles.metricChange}>of homes selling above asking</Text>
          </View>
        </View>

        {/* AI Insight */}
        {zipData.ai_insight && (
          <>
            <Text style={styles.sectionTitle}>Market Insight</Text>
            <View style={styles.insightBox}>
              <Text style={styles.insightText}>{zipData.ai_insight}</Text>
            </View>
          </>
        )}

        {/* CTA Box */}
        <View style={styles.ctaBox}>
          <Text style={styles.ctaTitle}>Ready to Learn More?</Text>
          <Text style={styles.ctaText}>
            I'd love to provide you with a personalized home value assessment and
            discuss your selling options.
          </Text>
          <Text style={styles.ctaContact}>
            Call (609) 789-0126 or email sf@stevenfrato.com
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerContent}>
            <View>
              <Text style={styles.footerContact}>
                <Text style={styles.footerContactBold}>Steven Frato</Text> |
                Century 21
              </Text>
              <Text style={styles.footerContact}>
                136 Farnsworth Ave, Bordentown, NJ 08505
              </Text>
              <Text style={styles.footerContact}>
                (609) 789-0126 | sf@stevenfrato.com
              </Text>
            </View>
            <View>
              <Text style={styles.footerContact}>stevenfrato.com</Text>
            </View>
          </View>
          <Text style={styles.footerDisclaimer}>
            Data sourced from Redfin. This report is for informational purposes
            only and does not constitute an official appraisal. Market conditions
            change frequently; contact Steven for the most current information.
          </Text>
        </View>
      </Page>
    </Document>
  );
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle both GET (download link from email) and POST (initial generation)
  const isGetRequest = event.httpMethod === "GET";
  const isPostRequest = event.httpMethod === "POST";

  if (!isGetRequest && !isPostRequest) {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    let zipcode: string;
    let name: string;
    let address: string;
    let town: string;

    if (isGetRequest) {
      // Parse query parameters for GET request (from email link)
      const params = event.queryStringParameters || {};
      zipcode = params.zipcode || "";
      name = params.name || "Homeowner";
      address = params.address || "";
      town = params.town || "";

      if (!zipcode) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Missing zipcode parameter" }),
        };
      }
    } else {
      // Parse body for POST request
      const body = JSON.parse(event.body || "{}") as PDFRequest;
      zipcode = body.zipcode || "";
      name = body.name || "Homeowner";
      address = body.address || "";
      town = body.town || "";

      if (!zipcode) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Missing required fields" }),
        };
      }
    }

    // Find zip code data
    const allZipcodes = zipcodesData as ZipData[];
    const zipData = allZipcodes.find((z) => z.zipcode === zipcode);

    if (!zipData) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Data not found for zipcode ${zipcode}` }),
      };
    }

    // Use city from zip data if town not provided
    if (!town) {
      town = zipData.city || zipData.region || zipcode;
    }

    console.log("Generating PDF for:", { zipcode, name, town });

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      <MarketReportPDF
        zipData={zipData}
        address={address}
        town={town}
        name={name}
      />
    );

    // Return PDF
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${town.replace(/[^a-zA-Z0-9]/g, "-")}-Market-Report.pdf"`,
        "Cache-Control": "no-cache",
      },
      body: pdfBuffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("Error generating PDF:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to generate PDF",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};

export { handler };
