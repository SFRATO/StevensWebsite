/**
 * Database Types for Email Campaign System
 *
 * These types match the Supabase database schema defined in
 * supabase/migrations/001_email_campaign_schema.sql
 */

// =============================================================================
// ENUMS
// =============================================================================

export type InterestType =
  | "selling"
  | "buying"
  | "both"
  | "investment"
  | "consultation";

export type LeadStatus =
  | "active"
  | "paused"
  | "unsubscribed"
  | "bounced"
  | "converted";

export type EmailStatus =
  | "pending"
  | "sending"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed";

export type MarketType = "seller" | "buyer" | "balanced";

// =============================================================================
// TABLE TYPES
// =============================================================================

export interface Campaign {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  interest_types: InterestType[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CampaignStep {
  id: string;
  campaign_id: string;
  step_number: number;
  template_id: string;
  subject_template: string;
  delay_days: number;
  send_hour: number;
  description: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  address: string | null;
  town: string | null;
  zipcode: string | null;
  county: string | null;
  interest_type: InterestType;
  campaign_id: string | null;
  current_step: number;
  status: LeadStatus;
  next_email_at: string | null;
  source_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
  updated_at: string;
  converted_at: string | null;
  unsubscribed_at: string | null;
}

export interface ScheduledEmail {
  id: string;
  lead_id: string;
  campaign_step_id: string;
  scheduled_for: string;
  status: EmailStatus;
  attempts: number;
  max_attempts: number;
  ses_message_id: string | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  failed_at: string | null;
  error_message: string | null;
}

export interface EmailEvent {
  id: string;
  scheduled_email_id: string | null;
  ses_message_id: string | null;
  event_type: string;
  event_timestamp: string;
  bounce_type: string | null;
  bounce_subtype: string | null;
  complaint_type: string | null;
  link_url: string | null;
  user_agent: string | null;
  ip_address: string | null;
  raw_event: Record<string, unknown> | null;
  created_at: string;
}

export interface ZipcodeData {
  zipcode: string;
  town: string | null;
  county: string | null;
  state: string;
  median_sale_price: number | null;
  median_sale_price_yoy: number | null;
  median_list_price: number | null;
  inventory: number | null;
  inventory_yoy: number | null;
  median_dom: number | null;
  median_dom_yoy: number | null;
  homes_sold: number | null;
  homes_sold_yoy: number | null;
  sold_above_list_pct: number | null;
  months_of_supply: number | null;
  market_type: MarketType;
  trend_direction: string | null;
  ai_insight: string | null;
  nearby_zips: string[];
  period_end: string | null;
  last_updated: string;
  created_at: string;
}

// =============================================================================
// INSERT TYPES (for creating new records)
// =============================================================================

export interface LeadInsert {
  email: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  town?: string | null;
  zipcode?: string | null;
  county?: string | null;
  interest_type?: InterestType;
  source_url?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
}

export interface ScheduledEmailInsert {
  lead_id: string;
  campaign_step_id: string;
  scheduled_for: string;
  status?: EmailStatus;
}

export interface EmailEventInsert {
  scheduled_email_id?: string | null;
  ses_message_id?: string | null;
  event_type: string;
  event_timestamp: string;
  bounce_type?: string | null;
  bounce_subtype?: string | null;
  complaint_type?: string | null;
  link_url?: string | null;
  user_agent?: string | null;
  ip_address?: string | null;
  raw_event?: Record<string, unknown> | null;
}

export interface ZipcodeDataInsert {
  zipcode: string;
  town?: string | null;
  county?: string | null;
  median_sale_price?: number | null;
  median_sale_price_yoy?: number | null;
  median_list_price?: number | null;
  inventory?: number | null;
  inventory_yoy?: number | null;
  median_dom?: number | null;
  median_dom_yoy?: number | null;
  homes_sold?: number | null;
  homes_sold_yoy?: number | null;
  sold_above_list_pct?: number | null;
  months_of_supply?: number | null;
  market_type?: MarketType;
  trend_direction?: string | null;
  ai_insight?: string | null;
  nearby_zips?: string[];
  period_end?: string | null;
}

// =============================================================================
// UPDATE TYPES
// =============================================================================

export interface LeadUpdate {
  email?: string;
  name?: string;
  phone?: string | null;
  address?: string | null;
  town?: string | null;
  zipcode?: string | null;
  county?: string | null;
  interest_type?: InterestType;
  campaign_id?: string | null;
  current_step?: number;
  status?: LeadStatus;
  next_email_at?: string | null;
  converted_at?: string | null;
  unsubscribed_at?: string | null;
}

export interface ScheduledEmailUpdate {
  status?: EmailStatus;
  attempts?: number;
  ses_message_id?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  failed_at?: string | null;
  error_message?: string | null;
}

// =============================================================================
// JOIN/COMPOSITE TYPES (for queries with relations)
// =============================================================================

export interface LeadWithCampaign extends Lead {
  campaign: Campaign | null;
}

export interface LeadWithZipcode extends Lead {
  zipcode_data: ZipcodeData | null;
}

export interface ScheduledEmailWithDetails extends ScheduledEmail {
  lead: Lead;
  campaign_step: CampaignStep;
}

export interface CampaignWithSteps extends Campaign {
  steps: CampaignStep[];
}

// =============================================================================
// EMAIL PERSONALIZATION TYPES
// =============================================================================

export interface EmailPersonalization {
  // Lead info
  name: string;
  email: string;

  // Location info
  town: string;
  zipcode: string;
  county: string;
  address: string;

  // Market data (formatted for display)
  median_sale_price: string; // "$450,000"
  median_sale_price_yoy: string; // "+5.2%"
  median_list_price: string;
  median_dom: number;
  inventory: number;
  sold_above_list_pct: number;
  market_type: MarketType;
  market_type_label: string; // "Seller's Market", "Buyer's Market", "Balanced Market"
  ai_insight: string;

  // Nearby comparison data
  nearby_zips: ZipcodeData[];

  // URLs
  unsubscribe_url: string;
  pdf_url: string;
  market_page_url: string;
}

// =============================================================================
// FORM SUBMISSION TYPES
// =============================================================================

export interface FormSubmissionPayload {
  // Required fields
  email: string;
  name: string;

  // Location fields
  address?: string;
  town?: string;
  zipcode?: string;

  // Optional fields
  phone?: string;
  interest?: InterestType;
  "source-location"?: string;

  // UTM parameters (extracted from URL)
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

// =============================================================================
// SES EVENT TYPES
// =============================================================================

export interface SESEventRecord {
  eventType: "Send" | "Delivery" | "Bounce" | "Complaint" | "Open" | "Click";
  mail: {
    messageId: string;
    timestamp: string;
    source: string;
    destination: string[];
  };
  bounce?: {
    bounceType: "Permanent" | "Transient" | "Undetermined";
    bounceSubType: string;
    bouncedRecipients: Array<{
      emailAddress: string;
      action?: string;
      status?: string;
      diagnosticCode?: string;
    }>;
  };
  complaint?: {
    complaintFeedbackType: string;
    complainedRecipients: Array<{
      emailAddress: string;
    }>;
  };
  open?: {
    timestamp: string;
    userAgent: string;
    ipAddress: string;
  };
  click?: {
    timestamp: string;
    link: string;
    userAgent: string;
    ipAddress: string;
  };
}

export interface SNSNotification {
  Type: "SubscriptionConfirmation" | "Notification" | "UnsubscribeConfirmation";
  MessageId: string;
  TopicArn: string;
  Message: string; // JSON string of SESEventRecord
  Timestamp: string;
  SubscribeURL?: string; // For SubscriptionConfirmation
  Token?: string;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LeadCreatedResponse {
  lead_id: string;
  campaign_slug: string;
  emails_scheduled: number;
  welcome_email_sent: boolean;
}

export interface EmailSentResponse {
  emails_processed: number;
  emails_sent: number;
  emails_failed: number;
  errors: string[];
}
