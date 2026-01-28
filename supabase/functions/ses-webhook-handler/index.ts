/**
 * SES Webhook Handler Edge Function
 *
 * Handles AWS SES delivery events via SNS notifications:
 * - Delivery: Email was delivered to recipient's mail server
 * - Bounce: Email bounced (hard or soft)
 * - Complaint: Recipient marked as spam
 * - Open: Recipient opened the email (if tracking enabled)
 * - Click: Recipient clicked a link (if tracking enabled)
 *
 * For bounces and complaints, the lead status is updated and
 * pending emails are cancelled.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Types for SES events
interface SESMailObject {
  messageId: string;
  timestamp: string;
  source: string;
  destination: string[];
}

interface SESBounce {
  bounceType: "Permanent" | "Transient" | "Undetermined";
  bounceSubType: string;
  bouncedRecipients: Array<{
    emailAddress: string;
    action?: string;
    status?: string;
    diagnosticCode?: string;
  }>;
  timestamp: string;
}

interface SESComplaint {
  complaintFeedbackType: string;
  complainedRecipients: Array<{
    emailAddress: string;
  }>;
  timestamp: string;
}

interface SESDelivery {
  timestamp: string;
  processingTimeMillis: number;
  recipients: string[];
  smtpResponse: string;
}

interface SESOpen {
  timestamp: string;
  userAgent: string;
  ipAddress: string;
}

interface SESClick {
  timestamp: string;
  link: string;
  userAgent: string;
  ipAddress: string;
}

interface SESEventRecord {
  eventType: "Send" | "Delivery" | "Bounce" | "Complaint" | "Open" | "Click";
  mail: SESMailObject;
  bounce?: SESBounce;
  complaint?: SESComplaint;
  delivery?: SESDelivery;
  open?: SESOpen;
  click?: SESClick;
}

interface SNSNotification {
  Type: "SubscriptionConfirmation" | "Notification" | "UnsubscribeConfirmation";
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SubscribeURL?: string;
  Token?: string;
}

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Helper: Map SES event type to email status
function mapEventTypeToStatus(
  eventType: string
): "delivered" | "opened" | "clicked" | "bounced" | "complained" | null {
  switch (eventType) {
    case "Delivery":
      return "delivered";
    case "Open":
      return "opened";
    case "Click":
      return "clicked";
    case "Bounce":
      return "bounced";
    case "Complaint":
      return "complained";
    default:
      return null;
  }
}

// Helper: Confirm SNS subscription
async function confirmSubscription(subscribeUrl: string): Promise<void> {
  try {
    const response = await fetch(subscribeUrl);
    if (response.ok) {
      console.log("SNS subscription confirmed successfully");
    } else {
      console.error("Failed to confirm SNS subscription:", response.status);
    }
  } catch (error) {
    console.error("Error confirming SNS subscription:", error);
  }
}

// Process bounce event
async function processBounce(event: SESEventRecord): Promise<void> {
  const bounce = event.bounce!;
  const sesMessageId = event.mail.messageId;

  console.log(`Processing bounce for message ${sesMessageId}:`, bounce.bounceType);

  // Find the scheduled email by SES message ID
  const { data: scheduledEmail } = await supabase
    .from("scheduled_emails")
    .select("id, lead_id")
    .eq("ses_message_id", sesMessageId)
    .single();

  if (!scheduledEmail) {
    console.warn(`No scheduled email found for SES message ID: ${sesMessageId}`);
    return;
  }

  // Insert bounce event
  await supabase.from("email_events").insert({
    scheduled_email_id: scheduledEmail.id,
    ses_message_id: sesMessageId,
    event_type: "BOUNCE",
    event_timestamp: bounce.timestamp,
    bounce_type: bounce.bounceType,
    bounce_subtype: bounce.bounceSubType,
    raw_event: event,
  });

  // Update scheduled email status
  await supabase
    .from("scheduled_emails")
    .update({ status: "bounced" })
    .eq("id", scheduledEmail.id);

  // For permanent bounces, update lead status and cancel pending emails
  if (bounce.bounceType === "Permanent") {
    console.log(`Permanent bounce - marking lead ${scheduledEmail.lead_id} as bounced`);

    // Update lead status
    await supabase
      .from("leads")
      .update({ status: "bounced" })
      .eq("id", scheduledEmail.lead_id);

    // Cancel all pending emails for this lead
    await supabase
      .from("scheduled_emails")
      .update({
        status: "failed",
        error_message: "Cancelled due to permanent bounce",
      })
      .eq("lead_id", scheduledEmail.lead_id)
      .eq("status", "pending");
  }
}

// Process complaint event
async function processComplaint(event: SESEventRecord): Promise<void> {
  const complaint = event.complaint!;
  const sesMessageId = event.mail.messageId;

  console.log(`Processing complaint for message ${sesMessageId}:`, complaint.complaintFeedbackType);

  // Find the scheduled email by SES message ID
  const { data: scheduledEmail } = await supabase
    .from("scheduled_emails")
    .select("id, lead_id")
    .eq("ses_message_id", sesMessageId)
    .single();

  if (!scheduledEmail) {
    console.warn(`No scheduled email found for SES message ID: ${sesMessageId}`);
    return;
  }

  // Insert complaint event
  await supabase.from("email_events").insert({
    scheduled_email_id: scheduledEmail.id,
    ses_message_id: sesMessageId,
    event_type: "COMPLAINT",
    event_timestamp: complaint.timestamp,
    complaint_type: complaint.complaintFeedbackType,
    raw_event: event,
  });

  // Update scheduled email status
  await supabase
    .from("scheduled_emails")
    .update({ status: "complained" })
    .eq("id", scheduledEmail.id);

  // Update lead status and cancel pending emails
  console.log(`Complaint received - marking lead ${scheduledEmail.lead_id} as unsubscribed`);

  await supabase
    .from("leads")
    .update({
      status: "unsubscribed",
      unsubscribed_at: new Date().toISOString(),
    })
    .eq("id", scheduledEmail.lead_id);

  // Cancel all pending emails
  await supabase
    .from("scheduled_emails")
    .update({
      status: "failed",
      error_message: "Cancelled due to spam complaint",
    })
    .eq("lead_id", scheduledEmail.lead_id)
    .eq("status", "pending");
}

// Process delivery event
async function processDelivery(event: SESEventRecord): Promise<void> {
  const delivery = event.delivery!;
  const sesMessageId = event.mail.messageId;

  // Find the scheduled email by SES message ID
  const { data: scheduledEmail } = await supabase
    .from("scheduled_emails")
    .select("id")
    .eq("ses_message_id", sesMessageId)
    .single();

  if (!scheduledEmail) {
    console.warn(`No scheduled email found for SES message ID: ${sesMessageId}`);
    return;
  }

  // Insert delivery event
  await supabase.from("email_events").insert({
    scheduled_email_id: scheduledEmail.id,
    ses_message_id: sesMessageId,
    event_type: "DELIVERY",
    event_timestamp: delivery.timestamp,
    raw_event: event,
  });

  // Update scheduled email status
  await supabase
    .from("scheduled_emails")
    .update({
      status: "delivered",
      delivered_at: delivery.timestamp,
    })
    .eq("id", scheduledEmail.id);
}

// Process open event
async function processOpen(event: SESEventRecord): Promise<void> {
  const open = event.open!;
  const sesMessageId = event.mail.messageId;

  // Find the scheduled email by SES message ID
  const { data: scheduledEmail } = await supabase
    .from("scheduled_emails")
    .select("id")
    .eq("ses_message_id", sesMessageId)
    .single();

  if (!scheduledEmail) {
    console.warn(`No scheduled email found for SES message ID: ${sesMessageId}`);
    return;
  }

  // Insert open event
  await supabase.from("email_events").insert({
    scheduled_email_id: scheduledEmail.id,
    ses_message_id: sesMessageId,
    event_type: "OPEN",
    event_timestamp: open.timestamp,
    user_agent: open.userAgent,
    ip_address: open.ipAddress,
    raw_event: event,
  });

  // Update scheduled email (only if not already clicked - click is higher priority)
  const { data: currentEmail } = await supabase
    .from("scheduled_emails")
    .select("status")
    .eq("id", scheduledEmail.id)
    .single();

  if (currentEmail && currentEmail.status !== "clicked") {
    await supabase
      .from("scheduled_emails")
      .update({
        status: "opened",
        opened_at: open.timestamp,
      })
      .eq("id", scheduledEmail.id);
  }
}

// Process click event
async function processClick(event: SESEventRecord): Promise<void> {
  const click = event.click!;
  const sesMessageId = event.mail.messageId;

  // Find the scheduled email by SES message ID
  const { data: scheduledEmail } = await supabase
    .from("scheduled_emails")
    .select("id")
    .eq("ses_message_id", sesMessageId)
    .single();

  if (!scheduledEmail) {
    console.warn(`No scheduled email found for SES message ID: ${sesMessageId}`);
    return;
  }

  // Insert click event
  await supabase.from("email_events").insert({
    scheduled_email_id: scheduledEmail.id,
    ses_message_id: sesMessageId,
    event_type: "CLICK",
    event_timestamp: click.timestamp,
    link_url: click.link,
    user_agent: click.userAgent,
    ip_address: click.ipAddress,
    raw_event: event,
  });

  // Update scheduled email
  await supabase
    .from("scheduled_emails")
    .update({
      status: "clicked",
      clicked_at: click.timestamp,
    })
    .eq("id", scheduledEmail.id);
}

// Main handler
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // SNS sends notifications as text, but we need to parse it
    const body = await req.text();
    let notification: SNSNotification;

    try {
      notification = JSON.parse(body);
    } catch {
      console.error("Failed to parse SNS notification body");
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Received SNS notification type: ${notification.Type}`);

    // Handle subscription confirmation
    if (notification.Type === "SubscriptionConfirmation") {
      console.log("Confirming SNS subscription...");
      if (notification.SubscribeURL) {
        await confirmSubscription(notification.SubscribeURL);
      }
      return new Response(JSON.stringify({ success: true, message: "Subscription confirmed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle unsubscribe confirmation
    if (notification.Type === "UnsubscribeConfirmation") {
      console.log("SNS unsubscribe confirmation received");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle actual notification
    if (notification.Type === "Notification") {
      let sesEvent: SESEventRecord;

      try {
        sesEvent = JSON.parse(notification.Message);
      } catch {
        console.error("Failed to parse SES event from SNS message");
        return new Response(JSON.stringify({ error: "Invalid SES event" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      console.log(`Processing SES event: ${sesEvent.eventType} for message ${sesEvent.mail.messageId}`);

      // Process based on event type
      switch (sesEvent.eventType) {
        case "Bounce":
          await processBounce(sesEvent);
          break;

        case "Complaint":
          await processComplaint(sesEvent);
          break;

        case "Delivery":
          await processDelivery(sesEvent);
          break;

        case "Open":
          await processOpen(sesEvent);
          break;

        case "Click":
          await processClick(sesEvent);
          break;

        case "Send":
          // Send events are informational only - we already track this in the sender
          console.log(`Send event received for message ${sesEvent.mail.messageId}`);
          break;

        default:
          console.log(`Unknown event type: ${sesEvent.eventType}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          eventType: sesEvent.eventType,
          messageId: sesEvent.mail.messageId,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Unknown notification type
    console.warn(`Unknown SNS notification type: ${notification.Type}`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing SES webhook:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
