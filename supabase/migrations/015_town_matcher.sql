-- =============================================================================
-- 015: South Jersey Town Matcher (/town-matcher) questionnaire
-- =============================================================================
-- Mirrors the decision made in 011 for the seller funnel: the mapped answers go
-- into real `leads` columns (name, email, phone, town, timeline, property_type,
-- utm_*, fbclid), and the funnel-specific answers go into one JSONB column
-- rather than inventing a dozen columns only this funnel will ever use.
--
-- Traffic here is ORGANIC — Instagram and Facebook content, not paid ads — but
-- attribution still matters, because Steven links the same form from different
-- posts, Reels and his bio. utm_* and fbclid already exist from 011.
-- =============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS town_matcher JSONB;

COMMENT ON COLUMN public.leads.town_matcher IS
'The /town-matcher questionnaire, verbatim: budget, bedrooms, property_type,
current_town, current_state, commute_matters, commute_destination,
commute_frequency, priorities (array), timeline, rent_or_own, needs_to_sell.
Written by the send-town-matcher edge function.

needs_to_sell is the commercially significant one: a "yes" turns a buyer lead
into a probable listing as well, so it is surfaced in the agent notification
rather than left to be discovered here.

FAIR HOUSING: `priorities` describes PLACE and PROPERTY attributes only. School
quality is deliberately absent from the option set — it is a well-documented
familial-status proxy, and these answers are used to steer someone toward
specific towns. Do not add it.';
