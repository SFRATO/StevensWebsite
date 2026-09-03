-- =============================================================================
-- 016: Voice of Customer research
-- =============================================================================
-- Every Town Matcher submission produces two assets: a real estate lead (leads)
-- and a piece of market research (this table). The research is what eventually
-- answers "why are people actually considering South Jersey, and in what words".
--
-- WHY A SEPARATE TABLE RATHER THAN MORE COLUMNS ON leads
-- ------------------------------------------------------
-- VOC observations will come from Instagram DMs, Reddit threads, YouTube
-- comments, client conversations and Steven's own notes. None of those have a
-- lead, an email or a phone number. A row here must stand on its own, so
-- lead_id is nullable and the structured context is COPIED rather than joined.
--
-- THE RAW LANGUAGE IS THE POINT
-- -----------------------------
-- "We had our second kid and this rowhome is just starting to feel too cramped"
-- is worth more than a `needs_more_space` boolean. Nothing in the write path
-- rewrites, summarises, normalises or classifies these strings — they are stored
-- exactly as typed, capped only for length. `themes` exists for LATER manual or
-- batch tagging and is deliberately left empty for now.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.voice_of_customer (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ON DELETE SET NULL, not CASCADE: deleting a lead for privacy or cleanup
  -- must not destroy the research, which is the durable asset here.
  lead_id       UUID REFERENCES public.leads(id) ON DELETE SET NULL,

  -- Where this observation came from. 'town-matcher' today; 'instagram-dm',
  -- 'reddit', 'youtube-comment', 'client-conversation', 'manual' later.
  source        TEXT NOT NULL DEFAULT 'town-matcher',
  source_detail TEXT,
  source_url    TEXT,

  -- --- the customer's own words -------------------------------------------
  reason_for_moving TEXT,
  hoped_difference  TEXT,
  -- For non-form sources: a quote lifted verbatim from a DM, comment or call.
  exact_quote       TEXT,

  -- --- manual research fields, all nullable and all filled in by hand ------
  pain_point      TEXT,
  desired_outcome TEXT,
  objection       TEXT,
  trigger_event   TEXT,
  town_mentioned  TEXT,
  notes           TEXT,
  -- Later tagging: 'more-space', 'yard', 'taxes', 'commute', 'schools' ...
  -- NOTHING writes to this automatically. No AI classification at this stage.
  themes          TEXT[] NOT NULL DEFAULT '{}',

  -- --- structured context, copied so a row reads standalone ----------------
  first_name TEXT, last_name TEXT, email TEXT, phone TEXT,
  current_town TEXT, current_state TEXT,
  budget TEXT, bedrooms TEXT, property_type TEXT,
  commute_matters TEXT, commute_destination TEXT, commute_frequency TEXT,
  priorities TEXT[] NOT NULL DEFAULT '{}',
  timeline TEXT, rent_or_own TEXT, needs_to_sell TEXT,

  -- --- attribution ---------------------------------------------------------
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
  utm_content TEXT, utm_term TEXT, fbclid TEXT,
  referrer TEXT, landing_url TEXT,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.voice_of_customer IS
'Market research captured alongside (not instead of) real estate leads. Rows may
originate from the Town Matcher form or from manual observation — Instagram DMs,
Reddit, YouTube comments, client conversations. lead_id is nullable for that
reason. Free-text answers are stored VERBATIM: never rewrite, summarise or
normalise them.';

COMMENT ON COLUMN public.voice_of_customer.themes IS
'Reserved for later manual/batch tagging (more-space, yard, taxes, commute,
schools, ...). Nothing writes to this automatically — raw language first.';

-- Reviewing is always "newest first, optionally filtered", so index for that.
CREATE INDEX IF NOT EXISTS voc_submitted_idx ON public.voice_of_customer (submitted_at DESC);
CREATE INDEX IF NOT EXISTS voc_source_idx    ON public.voice_of_customer (source, submitted_at DESC);
CREATE INDEX IF NOT EXISTS voc_lead_idx      ON public.voice_of_customer (lead_id);
-- Partial: rows with actual prose are the ones worth scanning.
CREATE INDEX IF NOT EXISTS voc_has_words_idx ON public.voice_of_customer (submitted_at DESC)
  WHERE reason_for_moving IS NOT NULL OR hoped_difference IS NOT NULL OR exact_quote IS NOT NULL;

-- --- RLS: same shape as crm_interactions in 005 ------------------------------
-- This is private research containing names, emails and phone numbers. Anon has
-- no access at all; the edge function writes with the service role, which
-- bypasses RLS exactly as it already does for leads.
ALTER TABLE public.voice_of_customer ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.voice_of_customer FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.voice_of_customer TO authenticated;

DROP POLICY IF EXISTS voice_of_customer_admin ON public.voice_of_customer;
CREATE POLICY voice_of_customer_admin ON public.voice_of_customer
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
