-- CostPilot Phase 7.1 — assign an owner when product behavior creates a PQL signal.
-- This does not change lead qualification or SQL status.

create or replace function public.assign_pql_sales_owner(
    p_signal_key text,
    p_lead_id bigint,
    p_signal_type text,
    p_trigger text default 'pql_product_trigger'
) returns table (
    lead_id bigint,
    assignment_id uuid,
    current_rep_id uuid,
    current_owner_type text,
    routing_status text,
    routing_reason text,
    reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
    existing_assignment public.sales_assignments%rowtype;
    selected_rep public.sales_reps%rowtype;
    new_assignment uuid;
begin
    if p_signal_key is null or btrim(p_signal_key) = '' then
        raise exception 'invalid_signal_key';
    end if;
    if p_lead_id is null then
        return query select null::bigint, null::uuid, null::uuid, null::text,
            'not_applicable'::text, 'pql_signal_without_lead'::text, false;
        return;
    end if;

    if p_signal_type not in ('PQL_REACHED', 'UPGRADE_INTENT') then
        return query select p_lead_id, null::uuid, null::uuid, null::text,
            'not_applicable'::text, 'signal_type_not_sales_handoff'::text, false;
        return;
    end if;

    select * into existing_assignment
    from public.sales_assignments
    where sales_assignments.lead_id = p_lead_id;

    if found and existing_assignment.current_rep_id is not null
       and existing_assignment.routing_status in ('assigned', 'handed_off', 'manually_overridden') then
        return query select p_lead_id, existing_assignment.id, existing_assignment.current_rep_id,
            existing_assignment.current_owner_type, existing_assignment.routing_status,
            coalesce(existing_assignment.routing_reason, 'existing_owner_reused'), true;
        return;
    end if;

    select * into selected_rep
    from public.sales_reps rep
    left join lateral (
        select count(*)::integer as active_load
        from public.sales_assignments a
        where a.current_rep_id = rep.id
          and a.routing_status in ('assigned', 'handoff_pending', 'handed_off', 'manually_overridden')
    ) load on true
    where rep.active = true
      and rep.role = 'sdr'
      and coalesce(load.active_load, 0) < rep.capacity
    order by coalesce(load.active_load, 0), rep.created_at, rep.rep_code
    limit 1;

    if selected_rep.id is null then
        return query select p_lead_id, existing_assignment.id,
            existing_assignment.current_rep_id, existing_assignment.current_owner_type,
            'retry_required'::text, 'no_available_sdr'::text, false;
        return;
    end if;

    insert into public.sales_assignments (
        lead_id, current_rep_id, current_owner_type,
        routing_status, routing_reason, eligible_for_sales
    )
    values (p_lead_id, selected_rep.id, 'sdr', 'assigned', p_trigger, false)
    on conflict (lead_id) do update set
        current_rep_id = excluded.current_rep_id,
        current_owner_type = excluded.current_owner_type,
        routing_status = 'assigned',
        routing_reason = excluded.routing_reason;

    select id into new_assignment from public.sales_assignments where sales_assignments.lead_id = p_lead_id;
    return query select p_lead_id, new_assignment, selected_rep.id, 'sdr',
        'assigned'::text, p_trigger, false;
end;
$$;

grant execute on function public.assign_pql_sales_owner(text, bigint, text, text) to service_role;
