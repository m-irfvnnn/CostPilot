-- CostPilot RevOps hardening — persisted external-action idempotency.
-- Prevents duplicate HubSpot/Slack actions for the same stable signal_key.

alter table public.revops_signals
    add column if not exists hubspot_action_claimed_at timestamptz,
    add column if not exists hubspot_action_claimed_by text,
    add column if not exists slack_action_claimed_at timestamptz,
    add column if not exists slack_action_claimed_by text;

create index if not exists revops_signals_external_claims_idx
    on public.revops_signals (signal_key, hubspot_deal_id, slack_notified_at, status);

create or replace function public.claim_revops_signal_step(
    p_signal_key text,
    p_step text,
    p_workflow_execution_id text default null,
    p_claim_ttl_minutes integer default 15
)
returns table (
    id uuid,
    signal_key text,
    status text,
    step text,
    should_execute boolean,
    skip_reason text,
    hubspot_deal_id text,
    slack_notified boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_signal public.revops_signals%rowtype;
    v_now timestamptz := now();
    v_ttl interval := make_interval(mins => greatest(coalesce(p_claim_ttl_minutes, 15), 1));
begin
    if nullif(btrim(coalesce(p_signal_key, '')), '') is null then
        raise exception 'p_signal_key is required';
    end if;

    if p_step not in ('hubspot', 'slack') then
        raise exception 'unsupported revops signal step: %', p_step;
    end if;

    select *
    into v_signal
    from public.revops_signals rs
    where rs.signal_key = p_signal_key
    for update;

    if not found then
        return query select null::uuid, p_signal_key, null::text, p_step, false, 'signal_not_found', null::text, false;
        return;
    end if;

    if p_step = 'hubspot' then
        if v_signal.hubspot_deal_id is not null then
            return query select v_signal.id, v_signal.signal_key, v_signal.status, p_step, false, 'hubspot_already_completed', v_signal.hubspot_deal_id, v_signal.slack_notified_at is not null;
            return;
        end if;

        if v_signal.hubspot_action_claimed_at is not null and v_signal.hubspot_action_claimed_at > v_now - v_ttl then
            return query select v_signal.id, v_signal.signal_key, v_signal.status, p_step, false, 'hubspot_claim_in_progress', v_signal.hubspot_deal_id, v_signal.slack_notified_at is not null;
            return;
        end if;

        update public.revops_signals rs
        set
            status = case when rs.status = 'completed' then rs.status else 'processing' end,
            hubspot_action_claimed_at = v_now,
            hubspot_action_claimed_by = p_workflow_execution_id,
            workflow_execution_id = coalesce(p_workflow_execution_id, rs.workflow_execution_id),
            updated_at = v_now
        where rs.id = v_signal.id
        returning * into v_signal;

        return query select v_signal.id, v_signal.signal_key, v_signal.status, p_step, true, null::text, v_signal.hubspot_deal_id, v_signal.slack_notified_at is not null;
        return;
    end if;

    if v_signal.slack_notified_at is not null then
        return query select v_signal.id, v_signal.signal_key, v_signal.status, p_step, false, 'slack_already_completed', v_signal.hubspot_deal_id, true;
        return;
    end if;

    if v_signal.slack_action_claimed_at is not null and v_signal.slack_action_claimed_at > v_now - v_ttl then
        return query select v_signal.id, v_signal.signal_key, v_signal.status, p_step, false, 'slack_claim_in_progress', v_signal.hubspot_deal_id, false;
        return;
    end if;

    update public.revops_signals rs
    set
        status = case when rs.status = 'completed' then rs.status else 'processing' end,
        slack_action_claimed_at = v_now,
        slack_action_claimed_by = p_workflow_execution_id,
        workflow_execution_id = coalesce(p_workflow_execution_id, rs.workflow_execution_id),
        updated_at = v_now
    where rs.id = v_signal.id
    returning * into v_signal;

    return query select v_signal.id, v_signal.signal_key, v_signal.status, p_step, true, null::text, v_signal.hubspot_deal_id, false;
end;
$$;

grant execute on function public.claim_revops_signal_step(text, text, text, integer) to service_role;

create or replace function public.record_revops_hubspot_step(
    p_signal_key text,
    p_hubspot_deal_id text,
    p_workflow_execution_id text default null
)
returns table (
    id uuid,
    signal_key text,
    status text,
    hubspot_deal_id text
)
language plpgsql
security definer
set search_path = public
as $$
begin
    if nullif(btrim(coalesce(p_hubspot_deal_id, '')), '') is null then
        raise exception 'p_hubspot_deal_id is required';
    end if;

    return query
    update public.revops_signals rs
    set
        status = case when rs.status = 'completed' then rs.status else 'processing' end,
        hubspot_deal_id = coalesce(rs.hubspot_deal_id, p_hubspot_deal_id),
        hubspot_action_claimed_at = null,
        hubspot_action_claimed_by = null,
        outcome_status = 'created',
        workflow_execution_id = coalesce(p_workflow_execution_id, rs.workflow_execution_id),
        updated_at = now()
    where rs.signal_key = p_signal_key
    returning rs.id, rs.signal_key, rs.status, rs.hubspot_deal_id;
end;
$$;

grant execute on function public.record_revops_hubspot_step(text, text, text) to service_role;

create or replace function public.record_revops_slack_step(
    p_signal_key text,
    p_workflow_execution_id text default null
)
returns table (
    id uuid,
    signal_key text,
    status text,
    slack_notified_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
    return query
    update public.revops_signals rs
    set
        status = case when rs.status = 'completed' then rs.status else 'processing' end,
        slack_notified_at = coalesce(rs.slack_notified_at, now()),
        slack_action_claimed_at = null,
        slack_action_claimed_by = null,
        outcome_status = 'notified',
        workflow_execution_id = coalesce(p_workflow_execution_id, rs.workflow_execution_id),
        updated_at = now()
    where rs.signal_key = p_signal_key
    returning rs.id, rs.signal_key, rs.status, rs.slack_notified_at;
end;
$$;

grant execute on function public.record_revops_slack_step(text, text) to service_role;
